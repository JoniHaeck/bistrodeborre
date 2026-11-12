/**
 * Databasetests voor het multi-tenant schema (supabase/migrations + seed) in een in-memory
 * Postgres (PGlite) met een minimale Supabase-stub (rollen, auth.uid(), realtime-publicatie).
 * Belangrijkste doel: restaurants kunnen nooit elkaars data zien of wijzigen.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const A = "00000000-0000-4000-8000-000000000001"; // bistro-de-borre
const B = "00000000-0000-4000-8000-000000000002"; // demo-brasserie
const LID_A = "11111111-1111-4111-8111-111111111111";
const ZONDER_LID = "22222222-2222-4222-8222-222222222222";
const SUPERADMIN = "33333333-3333-4333-8333-333333333333";

const supabaseDir = path.resolve(__dirname, "../../supabase");
let db: PGlite;
let dag: string; // over 7 dagen
let shiftA: string;
let shiftB: string | null;

const rijen = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows;

const maak = (restaurant: string, shift: string | null, aantal: number, capaciteit: number, extra: { bron?: string; externe?: string } = {}) =>
  db.query<{ id: string; restaurant_id: string; cancel_token: string }>(
    "select * from create_reservation($1, $2, '19:00', $3, 'Jan', 'Peeters', 'jan@x.be', null, null, false, $4, $5, $6, $7)",
    [restaurant, dag, aantal, shift, capaciteit, extra.bron ?? "online", extra.externe ?? null],
  );

async function als(rol: "service_role" | "authenticated" | "anon", userId = "") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec(`set role ${rol}`);
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    create publication supabase_realtime;
  `);
  const migraties = readdirSync(path.join(supabaseDir, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const f of migraties) await db.exec(readFileSync(path.join(supabaseDir, "migrations", f), "utf8"));
  const seed = readFileSync(path.join(supabaseDir, "seed.sql"), "utf8");
  await db.exec(seed);
  await db.exec(seed); // de seed moet herhaalbaar zijn

  dag = (await rijen<{ d: string }>("select (current_date + 7)::text as d"))[0].d;
  const weekdag = new Date(`${dag}T12:00:00Z`).getUTCDay();
  shiftA = (await rijen<{ id: string }>("select id from shift_templates where restaurant_id = $1 and weekdag = $2 and naam = 'Avond'", [A, weekdag]))[0].id;
  shiftB = (await rijen<{ id: string }>("select id from shift_templates where restaurant_id = $1 and weekdag = $2", [B, weekdag]))[0]?.id ?? null;

  await db.query("insert into auth.users values ($1, 'eigenaar@a.be'), ($2, 'los@x.be'), ($3, 'super@x.be')", [LID_A, ZONDER_LID, SUPERADMIN]);
  await db.query("insert into memberships (user_id, restaurant_id, rol) values ($1, $2, 'eigenaar')", [LID_A, A]);
});

afterAll(async () => {
  await db?.close();
});

describe("seed", () => {
  it("maakt settings automatisch aan per restaurant", async () => {
    const s = await rijen<{ restaurant_id: string; max_groepsgrootte: number }>("select restaurant_id, max_groepsgrootte from settings order by restaurant_id");
    expect(s.map((r) => r.restaurant_id)).toEqual([A, B]);
    expect(s[0].max_groepsgrootte).toBe(8);
  });

  it("geeft elk restaurant eigen shiften", async () => {
    const n = await rijen<{ restaurant_id: string; n: number }>("select restaurant_id, count(*)::int as n from shift_templates group by 1 order by 1");
    expect(n).toEqual([{ restaurant_id: A, n: 14 }, { restaurant_id: B, n: 5 }]);
  });

  it("get_public_settings haalt de naam uit restaurants", async () => {
    const [p] = await rijen<{ restaurant_naam: string }>("select * from get_public_settings($1)", [A]);
    expect(p.restaurant_naam).toBe("Bistro de Borre");
  });
});

describe("create_reservation", () => {
  beforeAll(() => als("service_role"));

  it("bewaakt de capaciteit per restaurant", async () => {
    const { rows } = await maak(A, shiftA, 5, 8);
    expect(rows[0].restaurant_id).toBe(A);
    await expect(maak(A, shiftA, 4, 8)).rejects.toThrow(/volzet/);
  });

  it("telt bezetting van een ander restaurant niet mee", async () => {
    await expect(maak(B, shiftB, 8, 8)).resolves.toBeTruthy();
    const bezet = async (r: string) => Number((await rijen<{ aantal_bezet: number }>("select * from get_bezetting($1, $2, $2)", [r, dag]))[0].aantal_bezet);
    expect(await bezet(A)).toBe(5);
    expect(await bezet(B)).toBe(8);
  });

  it("weigert een shift van een ander restaurant", async () => {
    await expect(maak(B, shiftA, 1, 100)).rejects.toThrow(/foreign key/);
  });

  it("weigert een datum in het verleden en een onbekend restaurant", async () => {
    await expect(
      db.query("select * from create_reservation($1, current_date - 1, '19:00', 1, 'a', 'b', 'c@x.be', null, null, false, null, 100)", [A]),
    ).rejects.toThrow(/verleden/);
    await expect(maak("99999999-9999-4999-8999-999999999999", null, 1, 100)).rejects.toThrow(/restaurant niet gevonden/);
  });

  it("is idempotent met een externe_id", async () => {
    const een = (await maak(A, shiftA, 1, 8, { bron: "google", externe: "g-1" })).rows[0];
    const twee = (await maak(A, shiftA, 1, 8, { bron: "google", externe: "g-1" })).rows[0];
    expect(twee.id).toBe(een.id);
  });

  it("geeft log en melding het restaurant van de reservatie", async () => {
    const r = (await maak(A, shiftA, 1, 100)).rows[0];
    const [log] = await rijen<{ restaurant_id: string }>("select restaurant_id from reservation_logs where reservation_id = $1", [r.id]);
    const [melding] = await rijen<{ restaurant_id: string }>("select restaurant_id from notifications where reservation_id = $1", [r.id]);
    expect(log.restaurant_id).toBe(A);
    expect(melding.restaurant_id).toBe(A);
  });

  it("laat een reservatie niet naar een ander restaurant verhuizen", async () => {
    const r = (await maak(A, null, 1, 100)).rows[0];
    await expect(db.query("update reservations set restaurant_id = $1 where id = $2", [B, r.id])).rejects.toThrow();
  });

  it("logt het zetten van reminder_sent_at niet als wijziging", async () => {
    const r = (await maak(A, null, 1, 100)).rows[0];
    await db.query("update reservations set reminder_sent_at = now() where id = $1", [r.id]);
    const [{ n }] = await rijen<{ n: number }>("select count(*)::int as n from reservation_logs where reservation_id = $1 and actie = 'gewijzigd'", [r.id]);
    expect(n).toBe(0);
  });

  it("annuleert via de token, maar niet twee keer", async () => {
    const r = (await maak(A, null, 1, 100)).rows[0];
    const [g] = await rijen<{ status: string }>("select * from cancel_reservation($1)", [r.cancel_token]);
    expect(g.status).toBe("geannuleerd");
    await expect(db.query("select * from cancel_reservation($1)", [r.cancel_token])).rejects.toThrow(/niet gevonden/);
  });
});

describe("RLS: lid van restaurant A", () => {
  beforeAll(() => als("authenticated", LID_A));

  it.each(["restaurants", "settings", "shift_templates", "reservations", "reservation_logs", "notifications"])(
    "ziet in %s enkel data van A",
    async (tabel) => {
      const kolom = tabel === "restaurants" ? "id" : "restaurant_id";
      const zichtbaar = await rijen<{ r: string }>(`select distinct ${kolom} as r from ${tabel}`);
      expect(zichtbaar.map((x) => x.r)).toEqual([A]);
    },
  );

  it("kan niets toevoegen of wijzigen in B", async () => {
    await expect(
      db.query("insert into shift_templates (restaurant_id, weekdag, naam, start_tijd, eind_tijd) values ($1, 1, 'x', '10:00', '11:00')", [B]),
    ).rejects.toThrow(/row-level security/);
    const upd = await db.query("update settings set max_groepsgrootte = 99 where restaurant_id = $1", [B]);
    expect(upd.affectedRows).toBe(0);
    await expect(db.query("update reservations set restaurant_id = $1 where restaurant_id = $2", [B, A])).rejects.toThrow();
  });

  it("beheert de reviewlink enkel voor het eigen restaurant", async () => {
    const eigen = await db.query("update settings set google_review_url = $1 where restaurant_id = $2", ["https://g.page/r/eigen/review", A]);
    const ander = await db.query("update settings set google_review_url = $1 where restaurant_id = $2", ["https://g.page/r/ander/review", B]);
    expect(eigen.affectedRows).toBe(1);
    expect(ander.affectedRows).toBe(0);
    const zichtbaar = await rijen<{ google_review_url: string }>("select google_review_url from settings");
    expect(zichtbaar).toEqual([{ google_review_url: "https://g.page/r/eigen/review" }]);
  });

  it("kan bezetting en manuele boekingen enkel voor A gebruiken", async () => {
    await expect(maak(A, null, 1, 100)).resolves.toBeTruthy();
    await expect(db.query("select * from get_bezetting($1, $2, $2)", [A, dag])).resolves.toBeTruthy();
    await expect(maak(B, null, 1, 100)).rejects.toThrow(/geen toegang/);
    await expect(db.query("select * from get_bezetting($1, $2, $2)", [B, dag])).rejects.toThrow(/geen toegang/);
  });

  it("kan interne functies niet aanroepen en is geen superadmin", async () => {
    await expect(db.query("select controleer_toegang($1)", [A])).rejects.toThrow(/permission denied/);
    await expect(db.query("select * from log_and_notify(gen_random_uuid(), 'x', null, null)")).rejects.toThrow(/permission denied/);
    expect((await rijen<{ ok: boolean }>("select is_platform_admin() as ok"))[0].ok).toBe(false);
    expect(await rijen("select user_id from platform_admins")).toEqual([]);
  });
});

describe("RLS: superadmin", () => {
  beforeAll(async () => {
    await als("service_role");
    await db.query("insert into platform_admins (user_id) values ($1)", [SUPERADMIN]);
    await als("authenticated", SUPERADMIN);
  });

  it("ziet alle restaurants en hun reservaties", async () => {
    expect((await rijen<{ id: string }>("select id from restaurants order by id")).map((r) => r.id)).toEqual([A, B]);
    const r = await rijen<{ r: string }>("select distinct restaurant_id as r from reservations order by 1");
    expect(r.map((x) => x.r)).toEqual([A, B]);
  });

  it("ziet alle lidmaatschappen en mag in elk restaurant boeken", async () => {
    expect((await rijen("select * from memberships")).length).toBeGreaterThan(0);
    await expect(maak(B, null, 1, 100)).resolves.toBeTruthy();
    const upd = await db.query("update settings set max_groepsgrootte = 11 where restaurant_id = $1", [B]);
    expect(upd.affectedRows).toBe(1);
  });

  it("kan zichzelf of anderen geen superadmin maken", async () => {
    await expect(db.query("insert into platform_admins (user_id) values ($1)", [ZONDER_LID])).rejects.toThrow(/row-level security/);
  });
});

describe("RLS: zonder lidmaatschap en anoniem", () => {
  it("een gebruiker zonder lidmaatschap ziet niets", async () => {
    await als("authenticated", ZONDER_LID);
    expect(await rijen("select id from reservations")).toEqual([]);
    expect(await rijen("select id from restaurants")).toEqual([]);
  });

  it("anon ziet niets en kan niets aanroepen", async () => {
    await als("anon");
    expect(await rijen("select id from reservations")).toEqual([]);
    expect(await rijen("select id from shift_templates")).toEqual([]);
    await expect(maak(A, null, 1, 100)).rejects.toThrow(/permission denied/);
    await expect(db.query("select * from cancel_reservation(gen_random_uuid())")).rejects.toThrow(/permission denied/);
  });
});

describe("platformbeheer (migratie 0003)", () => {
  it("weigert gereserveerde slugs", async () => {
    await als("service_role");
    for (const slug of ["app", "api", "platform", "login", "widget", "uitnodiging"]) {
      await expect(db.query("insert into restaurants (slug, naam) values ($1, 'x')", [slug])).rejects.toThrow(/niet_gereserveerd/);
    }
    // Te kort: al geweigerd door de slug-regex.
    await expect(db.query("insert into restaurants (slug, naam) values ('w', 'x')")).rejects.toThrow(/check constraint/);
  });

  it("user_id_voor_email zoekt hoofdletterongevoelig, enkel voor de service-role", async () => {
    await als("service_role");
    const [{ id }] = await rijen<{ id: string }>("select user_id_voor_email('  Eigenaar@A.be ') as id");
    expect(id).toBe(LID_A);
    await als("authenticated", SUPERADMIN);
    await expect(db.query("select user_id_voor_email('eigenaar@a.be')")).rejects.toThrow(/permission denied/);
  });
});

describe("per-restaurant gedrag (migratie 0004)", () => {
  it("een beheerder past naam, contact en tijdzone aan, maar niet slug, status of proefperiode", async () => {
    await als("authenticated", LID_A);
    const ok = await db.query("update restaurants set naam = 'Bistro de Borre', email = 'info@a.be', tijdzone = 'Europe/Amsterdam' where id = $1", [A]);
    expect(ok.affectedRows).toBe(1);
    await expect(db.query("update restaurants set status = 'opgezegd' where id = $1", [A])).rejects.toThrow(/Enkel het platform/);
    await expect(db.query("update restaurants set slug = 'andere-slug' where id = $1", [A])).rejects.toThrow(/Enkel het platform/);
    await expect(db.query("update restaurants set proef_tot = '2099-01-01' where id = $1", [A])).rejects.toThrow(/Enkel het platform/);
  });

  it("superadmin en service-role mogen de status wel wijzigen", async () => {
    await als("service_role");
    await db.query("insert into platform_admins (user_id) values ($1) on conflict do nothing", [SUPERADMIN]);
    await als("authenticated", SUPERADMIN);
    expect((await db.query("update restaurants set status = 'achterstallig' where id = $1", [A])).affectedRows).toBe(1);
    await als("service_role");
    expect((await db.query("update restaurants set status = 'actief', tijdzone = 'Europe/Brussels' where id = $1", [A])).affectedRows).toBe(1);
  });

  it("weigert een onbekende tijdzone", async () => {
    await als("service_role");
    await expect(db.query("update restaurants set tijdzone = 'Mars/Olympus' where id = $1", [A])).rejects.toThrow(/Ongeldige tijdzone/);
    await expect(db.query("insert into restaurants (slug, naam, tijdzone) values ('tz-test', 'x', 'Europe/Brusels')")).rejects.toThrow(/Ongeldige tijdzone/);
  });
});

describe("groepsaanvragen", () => {
  let aanvraag: string;
  let geslotenAanvraag: string;
  const maakAanvraag = async (tijd: string) => {
    const [row] = await rijen<{ id: string }>(
      `insert into groepsaanvragen (restaurant_id, datum, tijdslot, shift_template_id, aantal_personen, voornaam, naam, email, telefoon)
       values ($1, $2, $3, $4, 9, 'Groep', 'Test', 'groep@example.invalid', '+32123456789') returning id`,
      [A, dag, tijd, shiftA],
    );
    return row.id;
  };
  beforeAll(async () => {
    await als("service_role");
    aanvraag = await maakAanvraag("18:30");
    geslotenAanvraag = await maakAanvraag("18:45");
    const [andereShift] = await rijen<{ id: string }>("select id from shift_templates where restaurant_id = $1 limit 1", [B]);
    await db.query(
      `insert into groepsaanvragen (restaurant_id, datum, tijdslot, shift_template_id, aantal_personen, voornaam, naam, email, telefoon)
       values ($1, $2, '18:30', $3, 13, 'Andere', 'Groep', 'groep@example.invalid', '+32123456789')`,
      [B, dag, andereShift.id],
    );
    await db.query("insert into date_exceptions (restaurant_id, datum, shift_template_id, geblokkeerde_tijdsloten) values ($1, $2, $3, array['18:45'::time])", [A, dag, shiftA]);
  });

  it("is enkel zichtbaar en te bevestigen door een lid van het restaurant", async () => {
    await als("authenticated", ZONDER_LID);
    expect(await rijen("select id from groepsaanvragen")).toEqual([]);
    await expect(db.query("select * from bevestig_groepsaanvraag($1, $2, true)", [A, aanvraag])).rejects.toThrow(/geen toegang/);
    await als("anon");
    await expect(db.query("select * from groepsaanvragen")).rejects.toThrow(/permission denied/);
    await als("authenticated", LID_A);
    expect(await rijen("select id from groepsaanvragen")).toHaveLength(2);
    await expect(db.query("select * from bevestig_groepsaanvraag($1, $2, true)", [B, aanvraag])).rejects.toThrow(/geen toegang/);
    await expect(db.query("update groepsaanvragen set status = 'bevestigd' where id = $1", [aanvraag])).rejects.toThrow(/permission denied/);
  });

  it("waarschuwt bij overcapaciteit en boekt pas na uitdrukkelijke bevestiging", async () => {
    await als("authenticated", LID_A);
    await expect(db.query("select * from bevestig_groepsaanvraag($1, $2, false)", [A, aanvraag])).rejects.toThrow(/overcapaciteit/);
    expect((await rijen<{ status: string }>("select status from groepsaanvragen where id = $1", [aanvraag]))[0].status).toBe("in_afwachting");
    const [r] = await rijen<{ id: string; aantal_personen: number }>("select * from bevestig_groepsaanvraag($1, $2, true)", [A, aanvraag]);
    expect(r.aantal_personen).toBe(9);
    const [a] = await rijen<{ status: string; reservation_id: string }>("select status, reservation_id from groepsaanvragen where id = $1", [aanvraag]);
    expect(a).toEqual({ status: "bevestigd", reservation_id: r.id });
    await expect(db.query("select * from bevestig_groepsaanvraag($1, $2, true)", [A, aanvraag])).rejects.toThrow(/al behandeld/);
    const [{ n }] = await rijen<{ n: number }>("select count(*)::int as n from reservations where id = $1", [r.id]);
    expect(n).toBe(1);
  });

  it("weigert bevestiging als het tijdstip intussen geblokkeerd is", async () => {
    await als("authenticated", LID_A);
    await expect(db.query("select * from bevestig_groepsaanvraag($1, $2, true)", [A, geslotenAanvraag])).rejects.toThrow(/tijdstip niet meer beschikbaar/);
  });
});

describe("uitzonderingsperiodes", () => {
  const periode = "44444444-4444-4444-8444-444444444444";
  it("slaat afzonderlijke dagen per restaurant op en houdt ze gescheiden via RLS", async () => {
    await als("service_role");
    await db.query(
      `insert into date_exceptions (restaurant_id, datum, gesloten, periode_id)
       values ($1, $2::date, true, $3), ($1, $2::date + 1, true, $3),
              ($4, $2::date, true, $3)`,
      [A, dag, periode, B],
    );
    await als("authenticated", LID_A);
    const rijenA = await rijen<{ datum: string }>("select datum::text as datum from date_exceptions where periode_id = $1 order by datum", [periode]);
    expect(rijenA).toHaveLength(2);
    const verwijder = await db.query("delete from date_exceptions where restaurant_id = $1 and periode_id = $2", [A, periode]);
    expect(verwijder.affectedRows).toBe(2);
    await als("service_role");
    expect(await rijen("select id from date_exceptions where restaurant_id = $1 and periode_id = $2", [B, periode])).toHaveLength(1);
  });
});

describe("verwijderen", () => {
  it("een restaurant verwijderen ruimt al zijn data op", async () => {
    await als("service_role");
    await db.query("delete from restaurants where id = $1", [B]);
    for (const tabel of ["settings", "shift_templates", "reservations", "notifications"]) {
      const [{ n }] = await rijen<{ n: number }>(`select count(*)::int as n from ${tabel} where restaurant_id = $1`, [B]);
      expect(n).toBe(0);
    }
  });
});
