import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { adminDb } from "@/lib/admin/auth";
import { STATUSSEN, STATUS_LABEL, type Status } from "@/lib/admin/data";
import { formatDatum } from "@/lib/format";
import { vandaagInBrussel } from "@/lib/time";

export const metadata: Metadata = { title: "Reservaties — Bistro de Borre" };

type Params = Promise<Record<string, string | string[] | undefined>>;
const eerste = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ReservatiesPage({ searchParams }: { searchParams: Params }) {
  await connection();
  const db = await adminDb();
  const p = await searchParams;
  const van = eerste(p.van) || vandaagInBrussel();
  const tot = eerste(p.tot);
  const shift = eerste(p.shift);
  const status = eerste(p.status);
  const menu = eerste(p.menu);
  // Tekens met betekenis in PostgREST-filters verwijderen.
  const q = eerste(p.q).replace(/[,()*%\\]/g, " ").trim().slice(0, 100);

  let query = db.from("reservations").select("*").order("datum").order("tijdslot").limit(500);
  if (/^\d{4}-\d{2}-\d{2}$/.test(van)) query = query.gte("datum", van);
  if (/^\d{4}-\d{2}-\d{2}$/.test(tot)) query = query.lte("datum", tot);
  if ((STATUSSEN as readonly string[]).includes(status)) query = query.eq("status", status as Status);
  if (menu === "ja") query = query.eq("menu", true);
  if (menu === "nee") query = query.eq("menu", false);
  if (q) {
    const term = `%${q}%`;
    query = query.or(`voornaam.ilike.${term},naam.ilike.${term},email.ilike.${term},telefoon.ilike.${term}`);
  }
  if (shift) {
    const { data: ids } = await db.from("shift_templates").select("id").eq("naam", shift);
    query = query.in("shift_template_id", (ids ?? []).map((s) => s.id));
  }

  const [{ data: reservaties }, { data: shiftNamen }] = await Promise.all([
    query,
    db.from("shift_templates").select("naam"),
  ]);
  const namen = [...new Set((shiftNamen ?? []).map((s) => s.naam))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Reservaties</h1>
        <Link href="/admin/reservaties/nieuw" className="btn">
          Reservatie toevoegen
        </Link>
      </div>

      <form method="get" className="grid gap-3 rounded-lg border border-neutral-300 bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
        <label className="lbl">
          Van
          <input type="date" name="van" defaultValue={van} className="veld" />
        </label>
        <label className="lbl">
          Tot
          <input type="date" name="tot" defaultValue={tot} className="veld" />
        </label>
        <label className="lbl">
          Shift
          <select name="shift" defaultValue={shift} className="veld">
            <option value="">Alle</option>
            {namen.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="lbl">
          Status
          <select name="status" defaultValue={status} className="veld">
            <option value="">Alle</option>
            {STATUSSEN.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="lbl">
          Menu
          <select name="menu" defaultValue={menu} className="veld">
            <option value="">Alle</option>
            <option value="ja">Met menu</option>
            <option value="nee">Zonder menu</option>
          </select>
        </label>
        <label className="lbl">
          Zoeken
          <input type="search" name="q" defaultValue={q} placeholder="Naam, e-mail, telefoon" className="veld" />
        </label>
        <div className="flex gap-2 sm:col-span-3 lg:col-span-6">
          <button type="submit" className="btn">
            Filteren
          </button>
          <Link href="/admin/reservaties" className="btn-sec">
            Wissen
          </Link>
        </div>
      </form>

      <p className="text-sm text-neutral-700" role="status">
        {reservaties?.length ?? 0} reservatie(s)
        {(reservaties?.length ?? 0) >= 500 && " (beperkt tot de eerste 500, verfijn de filter)"}
      </p>

      <div className="overflow-x-auto rounded-lg border border-neutral-300 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-neutral-100">
            <tr>
              {["Datum", "Uur", "Naam", "Pers.", "Menu", "Telefoon", "Status"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {(reservaties ?? []).map((r) => (
              <tr key={r.id} className={r.status === "geannuleerd" ? "text-neutral-500" : ""}>
                <td className="px-3 py-2">{formatDatum(r.datum)}</td>
                <td className="px-3 py-2 tabular-nums">{r.tijdslot.slice(0, 5)}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/reservaties/${r.id}`} className="underline">
                    {r.voornaam} {r.naam}
                  </Link>
                </td>
                <td className="px-3 py-2">{r.aantal_personen}</td>
                <td className="px-3 py-2">{r.menu ? "Ja" : "Nee"}</td>
                <td className="px-3 py-2">{r.telefoon ?? "—"}</td>
                <td className="px-3 py-2">{STATUS_LABEL[r.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
