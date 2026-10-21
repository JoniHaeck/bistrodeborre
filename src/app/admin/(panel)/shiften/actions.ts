"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActieState } from "@/components/admin/ActieFormulier";
import { adminDb } from "@/lib/admin/auth";
import { weekdagVan } from "@/lib/availability";
import { vandaagInBrussel } from "@/lib/time";

const vinkje = z.preprocess((v) => v === "on" || v === "ja", z.boolean());
const tijd = z.string().regex(/^\d{2}:\d{2}/, "Ongeldig uur.").transform((v) => v.slice(0, 5));
const leegNaarNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const shiftSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  weekdag: z.coerce.number().int().min(0).max(6),
  naam: z.string().trim().min(1, "Geef de shift een naam.").max(50),
  start_tijd: tijd,
  eind_tijd: tijd,
  capaciteit: z.preprocess(leegNaarNull, z.coerce.number().int().min(0).max(500).nullable()),
  actief: vinkje,
  bevestig: z.string().optional(),
});

const nietGeannuleerd = "bevestigd,aangekomen,no_show";

export async function bewaarShift(formData: FormData): Promise<ActieState> {
  const db = await adminDb();
  const parsed = shiftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fout: parsed.error.issues[0]?.message ?? "Controleer de gegevens." };
  const s = parsed.data;
  if (s.eind_tijd <= s.start_tijd) return { fout: "Het einduur moet na het startuur liggen." };

  if (s.id && s.bevestig !== "ja") {
    const [{ data: inst }, { data: toekomst }] = await Promise.all([
      db.from("settings").select("standaard_capaciteit").eq("id", 1).single(),
      db
        .from("reservations")
        .select("datum, tijdslot, aantal_personen")
        .eq("shift_template_id", s.id)
        .gte("datum", vandaagInBrussel())
        .in("status", nietGeannuleerd.split(",") as never),
    ]);
    const reservaties = toekomst ?? [];
    const buiten = reservaties.filter(
      (r) => !s.actief || r.tijdslot.slice(0, 5) < s.start_tijd || r.tijdslot.slice(0, 5) > s.eind_tijd,
    );
    const nieuweCap = s.capaciteit ?? inst?.standaard_capaciteit ?? 8;
    const perSlot = new Map<string, number>();
    for (const r of reservaties) {
      const k = `${r.datum}|${r.tijdslot}`;
      perSlot.set(k, (perSlot.get(k) ?? 0) + r.aantal_personen);
    }
    const overvol = [...perSlot.values()].filter((n) => n > nieuweCap).length;

    const delen: string[] = [];
    if (buiten.length) delen.push(`${buiten.length} bestaande reservatie(s) vallen buiten de nieuwe of uitgeschakelde shift`);
    if (overvol) delen.push(`${overvol} kwartier(en) hebben meer personen dan de nieuwe capaciteit (${nieuweCap})`);
    if (delen.length) {
      return {
        waarschuwing: `Let op: ${delen.join(" en ")}. Bestaande reservaties blijven behouden en worden niet automatisch geannuleerd.`,
      };
    }
  }

  const rij = {
    weekdag: s.weekdag,
    naam: s.naam,
    start_tijd: s.start_tijd,
    eind_tijd: s.eind_tijd,
    capaciteit_per_slot: s.capaciteit,
    actief: s.actief,
  };
  const { error } = s.id ? await db.from("shift_templates").update(rij).eq("id", s.id) : await db.from("shift_templates").insert(rij);
  if (error) {
    console.error("Shift opslaan mislukt", error);
    return { fout: "Opslaan mislukt." };
  }
  revalidatePath("/admin/shiften");
  return { ok: s.id ? "Shift opgeslagen." : "Shift toegevoegd." };
}

export async function verwijderShift(id: string): Promise<ActieState> {
  const db = await adminDb();
  const { error } = await db.from("shift_templates").delete().eq("id", id);
  if (error) {
    return { fout: "Verwijderen kan niet: er zijn reservaties aan deze shift gekoppeld. Zet de shift op inactief." };
  }
  revalidatePath("/admin/shiften");
  return { ok: "Shift verwijderd." };
}

const uitzonderingSchema = z.object({
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Kies een datum."),
  shift: z.string().max(50).optional(),
  soort: z.enum(["gesloten", "geblokkeerd", "slots", "capaciteit"]),
  tijdsloten: z.string().max(300).optional(),
  capaciteit: z.preprocess(leegNaarNull, z.coerce.number().int().min(0).max(500).nullable()),
  opmerking: z.string().trim().max(200).optional(),
  bevestig: z.string().optional(),
});

export async function maakUitzondering(formData: FormData): Promise<ActieState> {
  const db = await adminDb();
  const parsed = uitzonderingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fout: parsed.error.issues[0]?.message ?? "Controleer de gegevens." };
  const u = parsed.data;

  let shiftId: string | null = null;
  if (u.shift) {
    const { data } = await db
      .from("shift_templates")
      .select("id")
      .eq("naam", u.shift)
      .eq("weekdag", weekdagVan(u.datum))
      .maybeSingle();
    if (!data) return { fout: `Er is geen shift "${u.shift}" op die weekdag.` };
    shiftId = data.id;
  }

  const sloten =
    u.soort === "slots"
      ? (u.tijdsloten ?? "")
          .split(/[\s,;]+/)
          .filter(Boolean)
          .map((t) => t.padStart(5, "0"))
      : [];
  if (u.soort === "slots" && (sloten.length === 0 || sloten.some((t) => !/^\d{2}:\d{2}$/.test(t)))) {
    return { fout: "Geef de te blokkeren kwartieren op als 12:00, 12:15, …" };
  }
  if (u.soort === "capaciteit" && u.capaciteit === null) return { fout: "Geef een capaciteit op." };

  if (u.bevestig !== "ja") {
    let q = db
      .from("reservations")
      .select("tijdslot, aantal_personen")
      .eq("datum", u.datum)
      .in("status", nietGeannuleerd.split(",") as never);
    if (shiftId) q = q.eq("shift_template_id", shiftId);
    const { data } = await q;
    const rijen = data ?? [];
    let geraakt = 0;
    if (u.soort === "gesloten" || u.soort === "geblokkeerd") geraakt = rijen.length;
    else if (u.soort === "slots") geraakt = rijen.filter((r) => sloten.includes(r.tijdslot.slice(0, 5))).length;
    else {
      const perSlot = new Map<string, number>();
      for (const r of rijen) perSlot.set(r.tijdslot, (perSlot.get(r.tijdslot) ?? 0) + r.aantal_personen);
      geraakt = [...perSlot.values()].filter((n) => n > (u.capaciteit ?? 0)).length;
    }
    if (geraakt > 0) {
      return {
        waarschuwing: `Let op: ${geraakt} bestaande reservatie(s)/kwartier(en) op ${u.datum} worden geraakt. Ze blijven behouden en worden niet automatisch geannuleerd of verwittigd.`,
      };
    }
  }

  const { error } = await db.from("date_exceptions").insert({
    datum: u.datum,
    shift_template_id: shiftId,
    gesloten: u.soort === "gesloten",
    geblokkeerd: u.soort === "geblokkeerd",
    geblokkeerde_tijdsloten: sloten,
    afwijkende_capaciteit: u.soort === "capaciteit" ? u.capaciteit : null,
    opmerking: u.opmerking || null,
  });
  if (error) {
    console.error("Uitzondering opslaan mislukt", error);
    return { fout: "Opslaan mislukt." };
  }
  revalidatePath("/admin/shiften");
  return { ok: "Uitzondering toegevoegd." };
}

export async function verwijderUitzondering(id: string): Promise<ActieState> {
  const db = await adminDb();
  const { error } = await db.from("date_exceptions").delete().eq("id", id);
  if (error) return { fout: "Verwijderen mislukt." };
  revalidatePath("/admin/shiften");
  return { ok: "Uitzondering verwijderd." };
}
