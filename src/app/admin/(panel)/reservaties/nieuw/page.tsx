import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { ActieFormulier } from "@/components/admin/ActieFormulier";
import { ReservatieVelden } from "@/components/admin/ReservatieVelden";
import { adminDb } from "@/lib/admin/auth";
import { vandaagInBrussel } from "@/lib/time";
import { maakReservatie } from "../actions";

export const metadata: Metadata = { title: "Reservatie toevoegen — Bistro de Borre" };

export default async function NieuweReservatiePage() {
  await connection();
  await adminDb();
  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/admin/reservaties" className="text-sm underline">
        ← Terug naar reservaties
      </Link>
      <h1 className="text-2xl font-semibold">Reservatie toevoegen</h1>
      <p className="text-sm text-neutral-700">Voor telefonische boekingen. De boeking wordt als &quot;telefonisch&quot; gemarkeerd.</p>
      <ActieFormulier action={maakReservatie} className="rounded-lg border border-neutral-300 bg-white p-4">
        <ReservatieVelden w={{ datum: vandaagInBrussel() }} nieuw />
        <button type="submit" className="btn mt-4">
          Reservatie opslaan
        </button>
      </ActieFormulier>
    </div>
  );
}
