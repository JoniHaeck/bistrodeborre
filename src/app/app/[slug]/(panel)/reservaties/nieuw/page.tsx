import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { ActieFormulier } from "@/components/admin/ActieFormulier";
import { ReservatieVelden } from "@/components/admin/ReservatieVelden";
import { adminContext } from "@/lib/admin/auth";
import { vandaagIn } from "@/lib/time";
import { maakReservatie } from "../actions";

export const metadata: Metadata = { title: "Reservatie toevoegen" };

export default async function NieuweReservatiePage({ params }: PageProps<"/app/[slug]/reservaties/nieuw">) {
  await connection();
  const { slug } = await params;
  const { restaurant } = await adminContext(slug);
  return (
    <div className="max-w-2xl space-y-4">
      <Link href={`/app/${slug}/reservaties`} className="text-sm underline">
        ← Terug naar reservaties
      </Link>
      <h1 className="text-2xl font-semibold">Reservatie toevoegen</h1>
      <p className="text-sm text-neutral-700">Voor telefonische boekingen. De boeking wordt als &quot;telefonisch&quot; gemarkeerd.</p>
      <ActieFormulier action={maakReservatie.bind(null, slug)} className="rounded-lg border border-neutral-300 bg-white p-4">
        <ReservatieVelden w={{ datum: vandaagIn(restaurant.tijdzone) }} nieuw />
        <button type="submit" className="btn mt-4">
          Reservatie opslaan
        </button>
      </ActieFormulier>
    </div>
  );
}
