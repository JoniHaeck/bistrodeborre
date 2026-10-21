import { z } from "zod";

const tekst = (max: number) => z.string().trim().min(1, "Verplicht veld.").max(max, "Te lang.");

export const reservatieSchema = z.object({
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige datum."),
  tijdslot: z.string().regex(/^\d{2}:\d{2}$/, "Ongeldig tijdstip."),
  aantal: z.number().int("Ongeldig aantal.").min(1, "Ongeldig aantal.").max(100, "Ongeldig aantal."),
  voornaam: tekst(80),
  naam: tekst(80),
  email: z.string().trim().toLowerCase().max(254, "Te lang.").email("Ongeldig e-mailadres."),
  telefoon: z
    .string()
    .trim()
    .regex(/^[+0-9 ()./-]{8,20}$/, "Ongeldig telefoonnummer."),
  opmerking: z
    .string()
    .trim()
    .max(500, "Maximaal 500 tekens.")
    .optional()
    .transform((v) => (v ? v : null)),
  menu: z.boolean(),
  // Honeypot: echte gebruikers laten dit leeg.
  website: z.string().max(200).optional(),
});

export type ReservatieInput = z.infer<typeof reservatieSchema>;
