"use client";

import { useState, useTransition, type ReactNode } from "react";

export type ActieState = { fout?: string; ok?: string; waarschuwing?: string } | null | undefined;

type Props = {
  action: (formData: FormData) => Promise<ActieState>;
  children: ReactNode;
  className?: string;
  /** Tekst van de knop waarmee een waarschuwing bevestigd wordt. */
  bevestigLabel?: string;
};

/**
 * Formulier voor server actions dat zijn ingevoerde waarden behoudt bij een fout
 * (een gewone `<form action>` leegt het formulier na elke submit) en fouten,
 * meldingen en bevestigbare waarschuwingen toont. Een knop met name="bevestig" value="ja"
 * herhaalt de actie nadat de gebruiker een waarschuwing aanvaard heeft.
 */
export function ActieFormulier({ action, children, className, bevestigLabel = "Toch doorvoeren" }: Props) {
  const [state, setState] = useState<ActieState>(null);
  const [bezig, startTransition] = useTransition();

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        setState(null);
        startTransition(async () => setState(await action(formData)));
      }}
    >
      <fieldset disabled={bezig} className="contents">
        {children}
        <div aria-live="polite" className="mt-2 space-y-2">
          {state?.fout && (
            <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-900">
              {state.fout}
            </p>
          )}
          {state?.ok && (
            <p className="rounded-md border border-green-300 bg-green-50 p-2 text-sm text-green-900">{state.ok}</p>
          )}
          {state?.waarschuwing && (
            <div role="alert" className="rounded-md border border-amber-400 bg-amber-50 p-2 text-sm text-amber-900">
              <p>{state.waarschuwing}</p>
              <button type="submit" name="bevestig" value="ja" className="btn mt-2">
                {bevestigLabel}
              </button>
            </div>
          )}
        </div>
      </fieldset>
    </form>
  );
}
