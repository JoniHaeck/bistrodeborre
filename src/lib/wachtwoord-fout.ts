import { isAuthError, isAuthSessionMissingError } from "@supabase/supabase-js";

export function wachtwoordFout(error: unknown): { bericht: string; nieuweLink: boolean } {
  if (isAuthSessionMissingError(error)) {
    return { bericht: "Je herstelsessie is verlopen. Vraag een nieuwe herstellink aan.", nieuweLink: true };
  }
  if (isAuthError(error)) {
    switch (error.code) {
      case "same_password":
        return { bericht: "Kies een ander wachtwoord dan je vorige wachtwoord.", nieuweLink: false };
      case "weak_password":
        return { bericht: "Dit wachtwoord is niet sterk genoeg. Kies een langer en uniek wachtwoord.", nieuweLink: false };
      case "reauthentication_needed":
      case "session_expired":
      case "session_not_found":
      case "refresh_token_not_found":
      case "refresh_token_already_used":
      case "bad_jwt":
        return { bericht: "Je herstelsessie is verlopen of niet meer geldig. Vraag een nieuwe herstellink aan.", nieuweLink: true };
      case "over_request_rate_limit":
        return { bericht: "Er zijn te veel pogingen gedaan. Wacht even en probeer opnieuw.", nieuweLink: false };
      default:
        if (error.code && /^[a-z0-9_]{1,60}$/.test(error.code)) {
          return { bericht: `Wachtwoord instellen mislukt. Probeer opnieuw of contacteer de platformbeheerder (foutcode: ${error.code}).`, nieuweLink: false };
        }
    }
  }
  return { bericht: "Wachtwoord instellen mislukt. Controleer je verbinding en probeer opnieuw of contacteer de platformbeheerder.", nieuweLink: false };
}
