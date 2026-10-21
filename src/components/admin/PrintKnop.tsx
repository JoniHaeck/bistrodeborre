"use client";

export function PrintKnop() {
  return (
    <button type="button" className="btn" onClick={() => window.print()}>
      Afdrukken
    </button>
  );
}
