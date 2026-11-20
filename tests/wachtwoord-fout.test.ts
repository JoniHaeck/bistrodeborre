import { AuthApiError, AuthSessionMissingError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { wachtwoordFout } from "@/lib/wachtwoord-fout";

describe("foutmeldingen bij wachtwoord instellen", () => {
  it("legt uit dat het oude wachtwoord niet opnieuw gebruikt mag worden", () => {
    expect(wachtwoordFout(new AuthApiError("same password", 422, "same_password"))).toEqual({
      bericht: "Kies een ander wachtwoord dan je vorige wachtwoord.",
      nieuweLink: false,
    });
  });
  it("vraagt een sterker wachtwoord bij een weigering door de wachtwoordregels", () => {
    const resultaat = wachtwoordFout(new AuthApiError("weak", 422, "weak_password"));
    expect(resultaat.bericht).toContain("niet sterk genoeg");
    expect(resultaat.nieuweLink).toBe(false);
  });
  it.each(["session_expired", "session_not_found", "refresh_token_already_used", "reauthentication_needed"])(
    "vraagt een nieuwe link bij %s",
    (code) => {
      expect(wachtwoordFout(new AuthApiError("expired", 401, code)).nieuweLink).toBe(true);
    },
  );
  it("herkent een ontbrekende sessie", () => {
    expect(wachtwoordFout(new AuthSessionMissingError()).nieuweLink).toBe(true);
  });
  it("toont onbekende foutcodes zonder serverfout of wachtwoord te onthullen", () => {
    const resultaat = wachtwoordFout(new AuthApiError("gevoelige fouttekst", 500, "unexpected_failure"));
    expect(resultaat.bericht).toContain("unexpected_failure");
    expect(resultaat.bericht).not.toContain("gevoelige fouttekst");
  });
  it("geeft een duidelijke melding bij een verbindingsfout", () => {
    expect(wachtwoordFout(new Error("network")).bericht).toContain("verbinding");
  });
});
