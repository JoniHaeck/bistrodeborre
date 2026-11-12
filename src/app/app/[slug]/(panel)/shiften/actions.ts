"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActieState } from "@/components/admin/ActieFormulier";
import { adminContext } from "@/lib/admin/auth";
import { voegDagenToe, weekdagVan } from "@/lib/availability";
import { vandaagIn } from "@/lib/time";

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

export async function bewaarShift(slug: string, formData: FormData): Promise<ActieState> {
  const { db, restaurant } = await adminContext(slug);
  const parsed = shiftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fout: parsed.error.issues[0]?.message ?? "Controleer de gegevens." };
  const s = parsed.data;
  if (s.eind_tijd <= s.start_tijd) return { fout: "Het einduur moet na het startuur liggen." };

  if (s.id && s.bevestig !== "ja") {
    const [{ data: inst }, { data: toekomst }] = await Promise.all([
      db.from("settings").select("standaard_capaciteit").eq("restaurant_id", restaurant.id).single(),
      db
        .from("reservations")
        .select("datum, tijdslot, aantal_personen")
        .eq("restaurant_id", restaurant.id)
        .eq("shift_template_id", s.id)
        .gte("datum", vandaagIn(restaurant.tijdzone))
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
    restaurant_id: restaurant.id,
    weekdag: s.weekdag,
    naam: s.naam,
    start_tijd: s.start_tijd,
    eind_tijd: s.eind_tijd,
    capaciteit_per_slot: s.capaciteit,
    actief: s.actief,
  };
  const { error } = s.id ? await db.from("shift_templates").update(rij).eq("restaurant_id", restaurant.id).eq("id", s.id) : await db.from("shift_templates").insert(rij);
  if (error) {
    console.error("Shift opslaan mislukt", error);
    return { fout: "Opslaan mislukt." };
  }
  revalidatePath(`/app/${slug}/shiften`);
  return { ok: s.id ? "Shift opgeslagen." : "Shift toegevoegd." };
}

export async function verwijderShift(slug: string, id: string): Promise<ActieState> {
  const { db, restaurant } = await adminContext(slug);
  const { error } = await db.from("shift_templates").delete().eq("restaurant_id", restaurant.id).eq("id", id);
  if (error) {
    return { fout: "Verwijderen kan niet: er zijn reservaties aan deze shift gekoppeld. Zet de shift op inactief." };
  }
  revalidatePath(`/app/${slug}/shiften`);
  return { ok: "Shift verwijderd." };
}

const uitzonderingSchema = z.object({
  datum: z.iso.date("Kies een geldige begindatum."),
  einddatum: z.union([z.iso.date("Kies een geldige einddatum."), z.literal("")]).optional(),
  shift: z.string().max(50).optional(),
  shift_id: z.string().uuid().optional(),
  soort: z.enum(["gesloten", "geblokkeerd", "slots", "capaciteit"]),
  tijdsloten: z.string().max(300).optional(),
  capaciteit: z.preprocess(leegNaarNull, z.coerce.number().int().min(0).max(500).nullable()),
  opmerking: z.string().trim().max(200).optional(),
  bevestig: z.string().optional(),
});

export async function maakUitzondering(slug: string, formData: FormData): Promise<ActieState> {
  const { db, restaurant } = await adminContext(slug);
  const parsed = uitzonderingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fout: parsed.error.issues[0]?.message ?? "Controleer de gegevens." };
  const u = parsed.data;
  const einddatum = u.einddatum || u.datum;
  if (einddatum < u.datum) return { fout: "De einddatum mag niet vóór de begindatum liggen." };
  if (einddatum > voegDagenToe(u.datum, 729)) return { fout: "Een periode mag maximaal 730 dagen omvatten." };
  if (u.shift_id && einddatum !== u.datum) return { fout: "Een specifieke shift kan alleen voor één dag worden gesloten." };
  const datums: string[] = [];
  for (let datum = u.datum; datum <= einddatum; datum = voegDagenToe(datum, 1)) datums.push(datum);

  const shiftsPerDag = new Map<number, string>();
  if (u.shift || u.shift_id) {
    let query = db
      .from("shift_templates")
      .select("id, weekdag")
      .eq("restaurant_id", restaurant.id);
    query = u.shift_id ? query.eq("id", u.shift_id) : query.eq("naam", u.shift!);
    const { data, error } = await query;
    if (error) {
      console.error("Shift zoeken mislukt", error);
      return { fout: "Shift opzoeken mislukt. Controleer of de shiftnaam uniek is." };
    }
    for (const shift of data) {
      if (shiftsPerDag.has(shift.weekdag)) return { fout: "De shiftnaam komt meermaals voor op een weekdag. Geef de shiften eerst een unieke naam." };
      shiftsPerDag.set(shift.weekdag, shift.id);
    }
  }
  const dagen = datums.flatMap((datum) => {
    const shiftId = u.shift || u.shift_id ? shiftsPerDag.get(weekdagVan(datum)) : null;
    return shiftId === undefined ? [] : [{ datum, shiftId }];
  });
  if (!dagen.length) return { fout: "Er is geen overeenkomstige shift in deze periode." };

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
    const reservaties: { datum: string; tijdslot: string; aantal_personen: number; shift_template_id: string | null }[] = [];
    const paginagrootte = 1000;
    for (let offset = 0; ; offset += paginagrootte) {
      let q = db
        .from("reservations")
        .select("datum, tijdslot, aantal_personen, shift_template_id")
        .eq("restaurant_id", restaurant.id)
        .gte("datum", u.datum)
        .lte("datum", einddatum)
        .in("status", nietGeannuleerd.split(",") as never);
      if (u.shift || u.shift_id) q = q.in("shift_template_id", [...shiftsPerDag.values()]);
      const { data, error } = await q.order("id").range(offset, offset + paginagrootte - 1);
      if (error) {
        console.error("Bestaande reservaties controleren mislukt", error);
        return { fout: "Bestaande reservaties konden niet gecontroleerd worden. Probeer opnieuw." };
      }
      reservaties.push(...data);
      if (data.length < paginagrootte) break;
    }
    const gekozenDagen = new Map(dagen.map((dag) => [dag.datum, dag.shiftId]));
    const rijen = reservaties.filter((r) =>
      gekozenDagen.has(r.datum) && (gekozenDagen.get(r.datum) === null || gekozenDagen.get(r.datum) === r.shift_template_id),
    );
    let geraakt = 0;
    if (u.soort === "gesloten" || u.soort === "geblokkeerd") geraakt = rijen.length;
    else if (u.soort === "slots") geraakt = rijen.filter((r) => sloten.includes(r.tijdslot.slice(0, 5))).length;
    else {
      const perSlot = new Map<string, number>();
      for (const r of rijen) {
        const sleutel = `${r.datum}|${r.tijdslot}`;
        perSlot.set(sleutel, (perSlot.get(sleutel) ?? 0) + r.aantal_personen);
      }
      geraakt = [...perSlot.values()].filter((n) => n > (u.capaciteit ?? 0)).length;
    }
    if (geraakt > 0) {
      return {
        waarschuwing: `Let op: ${geraakt} bestaande reservatie(s)/kwartier(en) in de gekozen periode worden geraakt. Ze blijven behouden en worden niet automatisch geannuleerd of verwittigd.`,
      };
    }
  }

  const periodeId = einddatum !== u.datum ? crypto.randomUUID() : null;
  const { error } = await db.from("date_exceptions").insert(dagen.map(({ datum, shiftId }) => ({
    restaurant_id: restaurant.id,
    datum,
    shift_template_id: shiftId,
    periode_id: periodeId,
    gesloten: u.soort === "gesloten",
    geblokkeerd: u.soort === "geblokkeerd",
    geblokkeerde_tijdsloten: sloten,
    afwijkende_capaciteit: u.soort === "capaciteit" ? u.capaciteit : null,
    opmerking: u.opmerking || null,
  })));
  if (error) {
    console.error("Uitzondering opslaan mislukt", error);
    return { fout: "Opslaan mislukt." };
  }
  revalidatePath(`/app/${slug}`, "layout");
  const overgeslagen = datums.length - dagen.length;
  return { ok: `Uitzondering toegevoegd voor ${dagen.length} dag(en).${overgeslagen ? ` ${overgeslagen} dag(en) zonder de gekozen shift overgeslagen.` : ""}` };
}

export async function verwijderUitzonderingsperiode(slug: string, periodeId: string, formData: FormData): Promise<ActieState> {
  const { db, restaurant } = await adminContext(slug);
  if (!z.string().uuid().safeParse(periodeId).success) return { fout: "Ongeldige periode." };
  if (formData.get("bevestig") !== "ja") {
    return { waarschuwing: "Alle uitzonderingen in deze periode worden verwijderd. De betrokken dagen of shiften kunnen daardoor opnieuw boekbaar worden." };
  }
  const { error } = await db.from("date_exceptions").delete().eq("restaurant_id", restaurant.id).eq("periode_id", periodeId);
  if (error) {
    console.error("Uitzonderingsperiode verwijderen mislukt", error);
    return { fout: "De periode kon niet verwijderd worden." };
  }
  revalidatePath(`/app/${slug}`, "layout");
  return { ok: "Uitzonderingsperiode verwijderd." };
}

export async function verwijderUitzondering(slug: string, id: string): Promise<ActieState> {
  const { db, restaurant } = await adminContext(slug);
  const { error } = await db.from("date_exceptions").delete().eq("restaurant_id", restaurant.id).eq("id", id);
  if (error) return { fout: "Verwijderen mislukt." };
  revalidatePath(`/app/${slug}`, "layout");
  return { ok: "Uitzondering verwijderd." };
}
