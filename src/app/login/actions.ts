"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { heeftBeheertoegang } from "@/lib/admin/auth";
import type { ActieState } from "@/components/admin/ActieFormulier";

const schema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
  volgende: z.string().optional(),
});

export async function login(formData: FormData): Promise<ActieState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fout: "Vul een geldig e-mailadres en wachtwoord in." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) return { fout: "E-mailadres of wachtwoord klopt niet." };
  if (!(await heeftBeheertoegang(supabase))) {
    await supabase.auth.signOut();
    return { fout: "Dit account heeft geen toegang tot het beheer." };
  }

  const volgende = parsed.data.volgende ?? "";
  redirect(/^\/(app|platform)(\/|$)/.test(volgende) ? volgende : "/app");
}

export async function logout() {
  await (await createClient()).auth.signOut();
  redirect("/login");
}
