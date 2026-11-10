import { vandaagIn } from "@/lib/time";
import { connection } from "next/server";
import { ReservatieFormulier } from "@/components/public/ReservatieFormulier";
import { getBeschikbareDagen } from "@/lib/availability";
import { laadAvailabilityContext, laadPubliekeInstellingen } from "@/lib/availability-data";
import type { Restaurant } from "@/lib/server/restaurant";
import { PRODUCT_KLEUR } from "@/lib/product";

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
/** Enkel https-URL's als logo (geen javascript:/data:). */
export function veiligeLogoUrl(waarde: string | undefined | null): string | null {
  return waarde && /^https:\/\/[^\s"'<>]+$/i.test(waarde) ? waarde : null;
}
export function veiligLettertype(waarde: string | undefined | null, fallback: string) {
  return waarde && LETTERTYPE.test(waarde) ? waarde : fallback;
}

/**
 * Laadt beschikbaarheid + instellingen en toont het formulier in de huisstijl van het restaurant.
 * `metKop`: logo of naam erboven (boekingspagina; de widget toont geen kop). Kleur en lettertype
 * kunnen per widget overschreven worden.
 */
export async function FormulierLader({
  restaurant,
  kleur,
  lettertype,
  metKop = false,
}: {
  restaurant: Restaurant;
  kleur?: string;
  lettertype?: string;
  metKop?: boolean;
}) {
  await connection();
  let data;
  try {
    const [ctx, instellingen] = await Promise.all([
      laadAvailabilityContext(restaurant),
      laadPubliekeInstellingen(restaurant.id),
    ]);
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
  const primair = veiligeKleur(kleur, veiligeKleur(instellingen.widget_primaire_kleur, PRODUCT_KLEUR));
  const logo = veiligeLogoUrl(instellingen.logo_url);
  return (
    <div
      className="thema"
      style={
        {
          "--primair": primair,
          "--primair-tekst": tekstOpKleur(primair),
          fontFamily: veiligLettertype(lettertype, veiligLettertype(instellingen.widget_lettertype, "\"Open Sans\", sans-serif")),
        } as React.CSSProperties
      }
    >
      {metKop && (
        <header className="mb-6">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo staat in Supabase Storage, afmetingen onbekend
            <img src={logo} alt={restaurant.naam} className="mb-4 max-h-20 max-w-60 object-contain" />
          ) : null}
          <h1 className="text-3xl font-semibold">Reserveren bij {restaurant.naam}</h1>
          <p className="mt-2 text-neutral-700">
            Kies een tijdstip en laat weten of jullie het menu nemen. Zo weet de keuken op voorhand wat er aankomt.
          </p>
        </header>
      )}
      <ReservatieFormulier
        slug={restaurant.slug}
        initieleDagen={data.dagen}
        vandaag={vandaagIn(restaurant.tijdzone)}
        initieelAantal={STANDAARD_AANTAL}
        maxGroepsgrootte={instellingen.max_groepsgrootte}
        menuLink={instellingen.menu_link}
      />
    </div>
  );
}
