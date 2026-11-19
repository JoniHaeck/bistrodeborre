type Auth = {
  setSession: (tokens: { access_token: string; refresh_token: string }) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
};

type Opslag = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export async function controleerWachtwoordLink(hash: string, opslag: Opslag, auth: () => Auth): Promise<boolean> {
  const fragment = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const access_token = fragment.get("access_token");
  const refresh_token = fragment.get("refresh_token");
  const type = fragment.get("type");
  const uitnodigingId = opslag.getItem("uitnodiging-gebruiker");
  const herstelId = opslag.getItem("herstel-gebruiker");
  if (hash) {
    opslag.removeItem("uitnodiging-gebruiker");
    opslag.removeItem("herstel-gebruiker");
    if ((type !== "invite" && type !== "recovery") || !access_token || !refresh_token) return false;
    const { data, error } = await auth().setSession({ access_token, refresh_token });
    if (error || !data.user) return false;
    opslag.setItem(type === "invite" ? "uitnodiging-gebruiker" : "herstel-gebruiker", data.user.id);
    return true;
  }
  if (!uitnodigingId && !herstelId) return false;
  const { data, error } = await auth().getUser();
  return !error && !!data.user && (data.user.id === uitnodigingId || data.user.id === herstelId);
}
