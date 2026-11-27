import { z } from "zod";
import { letterheadDesignInputSchema } from "./letterhead-design.ts";

/** Marken derselben Firma: Steuer-, Register- und sonstige rechtliche Firmendaten sind hier nicht wählbar. */
export const brandProfileInputSchema = z.strictObject({
  name: z.string().trim().min(1, "Bitte einen Markennamen eingeben.").max(120),
  email: z.union([z.literal(""), z.email().max(254)]).default(""),
  phone: z.string().trim().max(80).default(""),
  website: z.union([z.literal(""), z.url({ protocol: /^https?$/ }).max(2048)]).default(""),
  bankAccountId: z.uuid().nullable().default(null),
  intro: z.string().max(2000).default(""),
  note: z.string().max(2000).default(""),
  defaultForNew: z.boolean().default(false),
  design: letterheadDesignInputSchema.default({}),
});

export type BrandProfileInput = z.infer<typeof brandProfileInputSchema>;
