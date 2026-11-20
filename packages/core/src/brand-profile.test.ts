import { describe, expect, it } from "vitest";
import { brandProfileInputSchema } from "./brand-profile.ts";

describe("Markenprofile derselben Firma", () => {
  it("braucht zunächst nur den Markennamen; Gestaltung und Bilder können später folgen", () => {
    expect(brandProfileInputSchema.parse({ name: " HKMcore " })).toMatchObject({
      name: "HKMcore",
      email: "",
      phone: "",
      website: "",
      bankAccountId: null,
      intro: "",
      note: "",
      defaultForNew: false,
      design: {},
    });
  });

  it("nimmt keine eigenen Rechts-, Steuer- oder Buchhaltungsdaten an", () => {
    for (const field of ["companyName", "strasse", "ustId", "steuernummer", "rechtsform", "kontenrahmen", "isDefault"]) {
      expect(brandProfileInputSchema.safeParse({ name: "HKMcore", [field]: "abweichend" }).success).toBe(false);
    }
  });

  it("prüft Namen, Kontaktangaben, Firmenkontoverweis und Gestaltung", () => {
    for (const input of [
      { name: " " },
      { name: "x".repeat(121) },
      { email: "kaputt" },
      { website: "javascript:alert(1)" },
      { website: "ftp://example.invalid" },
      { bankAccountId: "DE89370400440532013000" },
      { design: { accent: "rot" } },
      { intro: "x".repeat(2001) },
    ])
      expect(brandProfileInputSchema.safeParse({ name: "HKMcore", ...input }).success).toBe(false);
    expect(brandProfileInputSchema.safeParse({ name: "HKMcore", website: "https://example.invalid" }).success).toBe(true);
  });
});
