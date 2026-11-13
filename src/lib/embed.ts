type EmbedResultaat =
  | { ok: true; inline: string; popup: string }
  | { ok: false; fout: string };

function attribuut(waarde: string) {
  return waarde.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function maakEmbedcodes(
  siteUrl: string | undefined,
  restaurant: { slug: string; naam: string },
  kleur: string,
  productie: boolean,
): EmbedResultaat {
  let url: URL;
  try {
    url = new URL(siteUrl ?? "");
  } catch {
    return { ok: false, fout: "De embedcode is niet beschikbaar: NEXT_PUBLIC_SITE_URL is niet correct ingesteld." };
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    (productie && url.protocol !== "https:") ||
    url.username || url.password || url.pathname !== "/" || url.search || url.hash
  ) {
    return { ok: false, fout: "De embedcode is niet beschikbaar: NEXT_PUBLIC_SITE_URL moet een geldig publiek basisadres zijn (HTTPS in productie)." };
  }
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(restaurant.slug)) {
    return { ok: false, fout: "De embedcode is niet beschikbaar: de restaurant-URL is ongeldig." };
  }
  if (!/^#[0-9a-f]{6}$/i.test(kleur)) {
    return { ok: false, fout: "De embedcode is niet beschikbaar: de opgeslagen widgetkleur is ongeldig." };
  }
  const basis = `src="${attribuut(url.origin)}/embed.js" data-restaurant="${attribuut(restaurant.slug)}"`;
  return {
    ok: true,
    inline: `<script ${basis}></script>`,
    popup: `<script ${basis} data-modus="popup" data-naam="${attribuut(restaurant.naam)}" data-kleur="${kleur}" data-knop-tekst="Reserveer een tafel"></script>`,
  };
}
