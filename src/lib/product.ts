/**
 * Naam en huisstijl van het platform zelf (niet van een restaurant).
 * "Tafelvrij" is een werknaam: hernoemen = enkel dit bestand aanpassen.
 */
export const PRODUCT_NAAM = "Tafelvrij";

/** Accentkleur van het platform (beheer, login, platformpagina's en mail-fallback). */
export const PRODUCT_KLEUR = "#2f6f5e";

/** "Reservaties — Tafelvrij" */
export const paginaTitel = (titel: string) => `${titel} — ${PRODUCT_NAAM}`;
