"use server";

import { verstuurContact, type ContactState } from "@/lib/contact";

export async function contactActie(_state: ContactState, formData: FormData): Promise<ContactState> {
  return verstuurContact(formData);
}
