import { createServiceRoleClient } from "@/lib/supabase/service";

type Db = ReturnType<typeof createServiceRoleClient>;

async function isPlatformbeheerder(db: Db, userId: string) {
  const { data, error } = await db.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** Alleen gebruiken nadat de aanroeper als superadmin is gecontroleerd. */
export async function laadBeheerders() {
  const db = createServiceRoleClient();
  const query = () => db.from("memberships")
    .select("user_id, restaurant_id, rol, geblokkeerd, created_at, restaurants(id, naam, slug)")
    .order("user_id").order("restaurant_id");
  type Lid = NonNullable<Awaited<ReturnType<ReturnType<typeof query>["range"]>>["data"]>[number];
  const leden: Lid[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await query().range(offset, offset + 999);
    if (error) throw error;
    leden.push(...data);
    if (data.length < 1000) break;
  }
  const ids = [...new Set(leden.map((lid) => lid.user_id))];
  const laadAccount = async (id: string) => {
    const [{ data, error: accountFout }, platformbeheerder] = await Promise.all([
      db.auth.admin.getUserById(id),
      isPlatformbeheerder(db, id),
    ]);
    if (accountFout) throw accountFout;
    if (!data.user) throw new Error("Beheerderaccount niet gevonden");
    const user = data.user;
    return {
      id, email: user.email ?? "", aangemaakt: user.created_at,
      laatstIngelogd: user.last_sign_in_at ?? null,
      uitgenodigd: user.invited_at ?? null,
      bevestigd: Boolean(user.email_confirmed_at),
      platformbeheerder,
      restaurants: leden.filter((lid) => lid.user_id === id),
    };
  };
  const accounts: Awaited<ReturnType<typeof laadAccount>>[] = [];
  for (let offset = 0; offset < ids.length; offset += 20) {
    accounts.push(...await Promise.all(ids.slice(offset, offset + 20).map(laadAccount)));
  }
  return accounts.sort((a, b) => a.email.localeCompare(b.email, "nl"));
}

export async function zetBlokkering(userId: string, restaurantId: string, geblokkeerd: boolean) {
  const db = createServiceRoleClient();
  if (await isPlatformbeheerder(db, userId)) {
    return { fout: "Een platformbeheerder heeft altijd toegang tot alle restaurants en kan hier niet geblokkeerd worden." };
  }
  const { data, error } = await db.from("memberships").update({ geblokkeerd })
    .eq("user_id", userId).eq("restaurant_id", restaurantId).select("user_id").maybeSingle();
  if (error) throw error;
  if (!data) return { fout: "Deze restaurantkoppeling bestaat niet meer." };
  return { ok: geblokkeerd ? "Toegang tot dit restaurant is geblokkeerd." : "Toegang tot dit restaurant is hersteld." };
}

export async function verwijderAccount(userId: string, huidigId: string, bevestiging: string) {
  const db = createServiceRoleClient();
  if (userId === huidigId || await isPlatformbeheerder(db, userId)) {
    return { fout: "Je eigen account en platformbeheerders kunnen hier niet worden verwijderd." };
  }
  const { count, error: lidFout } = await db.from("memberships").select("user_id", { count: "exact", head: true }).eq("user_id", userId);
  if (lidFout) throw lidFout;
  if (!count) return { fout: "Dit account is niet gekoppeld als restaurantbeheerder." };
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error) throw error;
  if (!data.user?.email || bevestiging.trim().toLowerCase() !== data.user.email.toLowerCase()) {
    return { fout: "Typ het e-mailadres van het account exact om te bevestigen." };
  }
  const { error: verwijderFout } = await db.auth.admin.deleteUser(userId);
  if (verwijderFout) throw verwijderFout;
  return { ok: "Het account en alle restaurantkoppelingen zijn definitief verwijderd." };
}
