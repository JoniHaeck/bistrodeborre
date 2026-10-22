"use client";

import { useEffect } from "react";

/** Meldt de hoogte van de inhoud aan de ouderpagina zodat embed.js de iframe kan aanpassen. */
export function WidgetResizer() {
  useEffect(() => {
    if (window.parent === window) return;
    const stuur = () =>
      window.parent.postMessage(
        { type: "bistro-widget-hoogte", hoogte: document.documentElement.scrollHeight },
        "*",
      );
    const observer = new ResizeObserver(stuur);
    observer.observe(document.body);
    stuur();
    // Escape in de iframe moet ook de popup van de ouderpagina kunnen sluiten.
    const toets = (e: KeyboardEvent) => {
      if (e.key === "Escape") window.parent.postMessage({ type: "bistro-widget-sluit" }, "*");
    };
    document.addEventListener("keydown", toets);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", toets);
    };
  }, []);
  return null;
}
