"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";

export async function annuleerReservatie(token: string) {
  if (!z.string().uuid().safeParse(token).success) return;
  const { error } = await createServiceRoleClient().rpc("cancel_reservation", { p_token: token });
  if (error && !error.message.includes("niet gevonden")) {
    console.error("Annuleren mislukt", error);
    throw error;
  }
  revalidatePath(`/reserveren/annuleren/${token}`);
}
