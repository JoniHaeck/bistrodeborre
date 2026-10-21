import { connection } from "next/server";
import { ReservatieFormulier } from "@/components/public/ReservatieFormulier";
import { getBeschikbareDagen } from "@/lib/availability";
import { laadAvailabilityContext, laadPubliekeInstellingen } from "@/lib/availability-data";

const STANDAARD_AANTAL = 2;
const KLEUR = /^#[0-9a-fA-F]{6}$/;
const LETTERTYPE = /^[\w ,'"-]{1,100}$/;

/** Geeft de waarde terug als ze veilig is om in CSS te gebruiken, anders de fallback. */
export function veiligeKleur(waarde: string | undefined | null, fallback: string) {
  return waarde && KLEUR.test(waarde) ? waarde : fallback;
}
export function veiligLettertype(waarde: string | undefined | null, fallback: string) {
  return waarde && LETTERTYPE.test(waarde) ? waarde : fallback;
}

/** Laadt beschikbaarheid + instellingen en toont het formulier. Optioneel met stijl-overrides (widget). */
export async function FormulierLader({ kleur, lettertype }: { kleur?: string; lettertype?: string }) {
  await connection();
  let data;
  try {
    const [ctx, instellingen] = await Promise.all([laadAvailabilityContext(), laadPubliekeInstellingen()]);
    data = { dagen: getBeschikbareDagen(STANDAARD_AANTAL, ctx), instellingen };
  } catch (e) {
    console.error("Formulier laden mislukt", e);
  }

  if (!data) {
    return (
      <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-red-900">
        Reserveren is momenteel niet mogelijk. Probeer het later opnieuw of bel ons.
      </p>
    );
  }

  const { instellingen } = data;
  return (
    <div
      style={
        {
          "--kleur-primair": veiligeKleur(kleur, veiligeKleur(instellingen.widget_primaire_kleur, "#7a1f2b")),
          fontFamily: veiligLettertype(lettertype, veiligLettertype(instellingen.widget_lettertype, "system-ui, sans-serif")),
        } as React.CSSProperties
      }
    >
      <ReservatieFormulier
        initieleDagen={data.dagen}
        initieelAantal={STANDAARD_AANTAL}
        maxGroepsgrootte={instellingen.max_groepsgrootte}
        menuLink={instellingen.menu_link}
      />
    </div>
  );
}
