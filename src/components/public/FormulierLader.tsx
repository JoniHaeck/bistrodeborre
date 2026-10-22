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
/** Zwart of wit, afhankelijk van welke het best leesbaar is op de gekozen kleur. */
export function tekstOpKleur(hex: string) {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c) : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
  const [r, g, b] = v.map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return l > 0.18 ? "#000" : "#fff";
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
  const primair = veiligeKleur(kleur, veiligeKleur(instellingen.widget_primaire_kleur, "#8b8a69"));
  return (
    <div
      style={
        {
          "--kleur-primair": primair,
          "--kleur-primair-tekst": tekstOpKleur(primair),
          fontFamily: veiligLettertype(lettertype, veiligLettertype(instellingen.widget_lettertype, "\"Open Sans\", sans-serif")),
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
