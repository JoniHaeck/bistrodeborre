"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import type { ActieState } from "@/components/admin/ActieFormulier";
import { adminDb } from "@/lib/admin/auth";
import { STATUSSEN, laadDagContext, type Status } from "@/lib/admin/data";
import { getSlotsVoorDatum, slotSleutel } from "@/lib/availability";
import { laadMailInstellingen, stuurHerinnering, stuurNieuweReservatieMails } from "@/lib/email/send";

const vinkje = z.preprocess((v) => v === "on" || v === "ja", z.boolean());
const optioneel = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

const schema = z.object({
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Kies een datum."),
  tijdslot: z.string().regex(/^\d{2}:\d{2}/, "Kies een uur.").transform((v) => v.slice(0, 5)),
  aantal: z.coerce.number().int().min(1, "Minstens 1 persoon.").max(100),
  voornaam: z.string().trim().min(1, "Voornaam is verplicht.").max(100),
  naam: z.string().trim().min(1, "Naam is verplicht.").max(100),
  email: z.string().trim().toLowerCase().email("Ongeldig e-mailadres.").max(200),
  telefoon: optioneel(40),
  opmerking: optioneel(1000),
  menu: vinkje,
  negeer_capaciteit: vinkje,
  stuur_bevestiging: vinkje,
});

type Db = Awaited<ReturnType<typeof adminDb>>;

/** Geeft een foutmelding of het slot (met shift) terug. `bestaand` = de reservatie die bewerkt wordt. */
async function controleerSlot(
  input: { datum: string; tijdslot: string; aantal: number; negeer_capaciteit: boolean },
  bestaand?: { datum: string; tijdslot: string; aantal_personen: number; status: Status },
) {
  const ctx = await laadDagContext(input.datum);
  const slot = getSlotsVoorDatum(input.datum, ctx).find((s) => s.tijdslot === input.tijdslot);
  if (!slot) return { fout: `Er is geen shift op ${input.datum} om ${input.tijdslot}. Kies een kwartier binnen een actieve shift.` };

  if (!input.negeer_capaciteit) {
    if (slot.gesloten) return { fout: `Dit slot is ${slot.gesloten}. Vink "Capaciteit en sluitingen negeren" aan om toch te boeken.` };
    let bezet = ctx.bezetting[slotSleutel(input.datum, input.tijdslot)] ?? 0;
    if (bestaand && bestaand.status !== "geannuleerd" && bestaand.datum === input.datum && bestaand.tijdslot.slice(0, 5) === input.tijdslot) {
      bezet -= bestaand.aantal_personen;
    }
    if (bezet + input.aantal > slot.capaciteit) {
      return {
        fout: `Slot volzet: ${bezet} bezet + ${input.aantal} nieuw > capaciteit ${slot.capaciteit}. Vink "Capaciteit en sluitingen negeren" aan om toch te boeken.`,
      };
    }
  }
  return { slot };
}

function leesFout(error: z.ZodError): ActieState {
  return { fout: error.issues[0]?.message ?? "Controleer de ingevoerde gegevens." };
}

export async function maakReservatie(formData: FormData): Promise<ActieState> {
  const db: Db = await adminDb();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return leesFout(parsed.error);
  const input = parsed.data;

  const controle = await controleerSlot(input);
  if ("fout" in controle) return { fout: controle.fout };

  const { data, error } = await db.rpc("create_reservation", {
    p_datum: input.datum,
    p_tijdslot: input.tijdslot,
    p_aantal_personen: input.aantal,
    p_voornaam: input.voornaam,
    p_naam: input.naam,
    p_email: input.email,
    p_telefoon: input.telefoon as string,
    p_opmerking: input.opmerking as string,
    p_menu: input.menu,
    p_shift_template_id: controle.slot!.shiftId,
    p_capaciteit: input.negeer_capaciteit ? 1000 : controle.slot!.capaciteit,
    p_bron: "telefonisch",
  });
  if (error) {
    if (error.message.includes("volzet")) return { fout: "Dit slot is net volzet geraakt." };
    console.error("Manuele reservatie mislukt", error);
    return { fout: "Opslaan mislukt. Probeer opnieuw." };
  }

  if (input.stuur_bevestiging) after(() => stuurNieuweReservatieMails(data));
  revalidatePath("/admin", "layout");
  redirect(`/admin/reservaties/${data.id}`);
}

export async function bewerkReservatie(id: string, formData: FormData): Promise<ActieState> {
  const db = await adminDb();
  if (!z.string().uuid().safeParse(id).success) return { fout: "Ongeldige reservatie." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return leesFout(parsed.error);
  const input = parsed.data;

  const { data: huidig } = await db.from("reservations").select("*").eq("id", id).single();
  if (!huidig) return { fout: "Reservatie niet gevonden." };

  const verplaatst =
    huidig.datum !== input.datum || huidig.tijdslot.slice(0, 5) !== input.tijdslot || huidig.aantal_personen !== input.aantal;
  let shiftId = huidig.shift_template_id;
  if (verplaatst) {
    const controle = await controleerSlot(input, huidig);
    if ("fout" in controle) return { fout: controle.fout };
    shiftId = controle.slot!.shiftId;
  }

  const { error } = await db
    .from("reservations")
    .update({
      datum: input.datum,
      tijdslot: input.tijdslot,
      aantal_personen: input.aantal,
      voornaam: input.voornaam,
      naam: input.naam,
      email: input.email,
      telefoon: input.telefoon,
      opmerking: input.opmerking,
      menu: input.menu,
      shift_template_id: shiftId,
    })
    .eq("id", id);
  if (error) {
    console.error("Reservatie bewerken mislukt", error);
    return { fout: "Opslaan mislukt. Probeer opnieuw." };
  }
  revalidatePath("/admin", "layout");
  return { ok: "Wijzigingen opgeslagen." };
}

export async function zetStatus(id: string, status: Status): Promise<ActieState> {
  const db = await adminDb();
  if (!z.string().uuid().safeParse(id).success || !STATUSSEN.includes(status)) return { fout: "Ongeldige aanvraag." };

  const { data: huidig } = await db.from("reservations").select("*").eq("id", id).single();
  if (!huidig) return { fout: "Reservatie niet gevonden." };

  if (huidig.status === "geannuleerd" && status !== "geannuleerd") {
    const controle = await controleerSlot(
      { datum: huidig.datum, tijdslot: huidig.tijdslot.slice(0, 5), aantal: huidig.aantal_personen, negeer_capaciteit: false },
      huidig,
    );
    if ("fout" in controle) return { fout: `Kan niet heractiveren: ${controle.fout}` };
  }

  const { error } = await db.from("reservations").update({ status }).eq("id", id);
  if (error) return { fout: "Status wijzigen mislukt." };
  revalidatePath("/admin", "layout");
  return { ok: "Status bijgewerkt." };
}

export async function stuurHerinneringAdmin(id: string): Promise<ActieState> {
  const db = await adminDb();
  const { data: r } = await db.from("reservations").select("*").eq("id", id).single();
  if (!r) return { fout: "Reservatie niet gevonden." };
  if (r.status === "geannuleerd") return { fout: "Geannuleerde reservaties krijgen geen herinnering." };
  const ok = await stuurHerinnering(r);
  revalidatePath("/admin", "layout");
  return ok ? { ok: `Herinnering verstuurd naar ${r.email}.` } : { fout: "Versturen mislukt, zie het logboek." };
}

export async function stuurShiftHerinneringen(datum: string, shiftId: string): Promise<ActieState> {
  const db = await adminDb();
  const { data } = await db
    .from("reservations")
    .select("*")
    .eq("datum", datum)
    .eq("shift_template_id", shiftId)
    .eq("status", "bevestigd");
  const { ctx } = await laadMailInstellingen();
  let verstuurd = 0;
  for (const r of data ?? []) if (await stuurHerinnering(r, ctx)) verstuurd++;
  revalidatePath("/admin", "layout");
  const totaal = data?.length ?? 0;
  return verstuurd === totaal
    ? { ok: `${verstuurd} herinnering(en) verstuurd.` }
    : { fout: `${verstuurd} van ${totaal} herinneringen verstuurd, zie de logboeken.` };
}
