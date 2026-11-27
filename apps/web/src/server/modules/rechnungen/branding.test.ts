import { brandProfileInputSchema } from "@haben/core";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { kleinunternehmerStand } from "../auswertungen/test-umsatz-stand.ts";
import { leeren, setupTestDb, testDatabaseUrl } from "../../test-db.ts";

describe.skipIf(!testDatabaseUrl)("Markenauswahl auf Belegen (Postgres)", () => {
  let invoices: typeof import("./index.ts");
  let quotes: typeof import("./quotes.ts");
  let brands: typeof import("../stammdaten/brand-profiles.ts");
  let assets: typeof import("../stammdaten/brand-assets.ts");
  let sql: postgres.Sql;
  const actor = "test-user";
  let contactId: string;
  let first: string;
  let second: string;
  const draft = () => ({
    contactId,
    issueDate: "2026-10-02",
    serviceFrom: "2026-09-01",
    serviceTo: "2026-09-30",
    paymentTermDays: 14,
    format: "zugferd" as const,
    note: "",
    lines: [{ description: "Beratung", quantity: 1000, unit: "Std.", unitPrice: 10000, taxRate: 1900 as const }],
  });
  const quoteDraft = () => ({ ...draft(), validUntil: "2026-10-31" });

  beforeAll(async () => {
    sql = await setupTestDb();
    invoices = await import("./index.ts");
    quotes = await import("./quotes.ts");
    brands = await import("../stammdaten/brand-profiles.ts");
    assets = await import("../stammdaten/brand-assets.ts");
  }, 120_000);
  afterAll(async () => {
    await sql?.end();
  });
  beforeEach(async () => {
    await leeren(sql)`truncate journal_lines, journal_entries, invoices, invoice_number_counters, quotes, quote_number_counters,
      contact_versions, contacts, letterhead_profiles, company cascade`;
    await sql`insert into company (id, name, strasse, plz, ort, email, telefon, steuernummer, ust_id, bundesland, iban, bic, bank)
      values (1, 'Beispielfirma GmbH', 'Musterstraße 1', '93047', 'Regensburg', 'zentrale@example.invalid', '030 1234',
              '198/113/10010', 'DE123456789', 'BY', 'DE89370400440532013000', 'COBADEFFXXX', 'Beispielbank')`;
    const [contact] = await sql`insert into contacts (name, strasse, plz, ort, email, kundennummer)
      values ('Beispielkunde', 'Hafenstraße 5', '20457', 'Hamburg', 'kunde@example.invalid', '10001') returning id`;
    contactId = contact!.id;
    first = (await brands.saveBrandProfile(actor, null, brandProfileInputSchema.parse({ name: "HKMcore", defaultForNew: true, intro: "Markentext" }))).id;
    second = (await brands.saveBrandProfile(actor, null, brandProfileInputSchema.parse({ name: "Zweite Marke", email: "marke@example.invalid" }))).id;
  });

  it("beachtet die Standardmarke und lässt die gemeinsame Firmengestaltung ausdrücklich wählen", async () => {
    expect(await invoices.newDraftDefaults("2026-10-02")).toMatchObject({ brandProfileId: first, intro: "Markentext" });
    expect((await invoices.createDraft(actor, draft())).brandProfileId).toBe(first);
    expect((await invoices.createDraft(actor, { ...draft(), brandProfileId: null })).brandProfileId).toBeNull();
    expect((await quotes.createQuoteDraft(actor, quoteDraft())).brandProfileId).toBe(first);
  });

  it("wechselt nur das Profil, behält Kunde und Positionen und verliert die Auswahl bei älteren API-Aufrufen nicht", async () => {
    const created = await invoices.createDraft(actor, draft());
    await invoices.updateDraft(actor, created.id, { ...draft(), brandProfileId: second });
    const unchanged = await invoices.updateDraft(actor, created.id, draft());
    expect(unchanged).toMatchObject({ contactId, brandProfileId: second, gross: 11900 });
    expect((await invoices.getInvoice(created.id))!.lines[0]).toMatchObject({ description: "Beratung", unitPrice: 10000 });
    await brands.setBrandProfileArchived(actor, second, true);
    expect((await invoices.updateDraft(actor, created.id, draft())).brandProfileId).toBe(second);
    await expect(invoices.createDraft(actor, { ...draft(), brandProfileId: second })).rejects.toThrow(/inaktiv/);
  });

  it("bewahrt PDF, XML und Verkäufer einer festgeschriebenen Rechnung bei späteren Profiländerungen", async () => {
    const created = await invoices.createDraft(actor, { ...draft(), brandProfileId: second });
    const original = await invoices.finalizeInvoice(actor, created.id, kleinunternehmerStand);
    expect(original.seller).toMatchObject({ name: "Beispielfirma GmbH", brand: "Zweite Marke", ustId: "DE123456789", email: "marke@example.invalid" });
    expect(original.xml).toContain("Beispielfirma GmbH");
    expect(original.xml).toContain("marke@example.invalid");
    await brands.saveBrandProfile(
      actor,
      second,
      brandProfileInputSchema.parse({ name: "Neuer Markenname", email: "neu@example.invalid", design: { accent: "#663399" } }),
    );
    const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));
    await assets.saveBrandImage(actor, second, "logo", png);
    const [stored] = await sql`select seller, pdf, xml, pdf_sha256, xml_sha256 from invoices where id = ${original.id}`;
    expect(stored!.seller).toEqual(original.seller);
    expect(stored!.pdf).toEqual(original.pdf);
    expect(stored!.xml).toBe(original.xml);
    expect(stored!.pdf_sha256).toBe(original.pdfSha256);
    expect(stored!.xml_sha256).toBe(original.xmlSha256);
    await expect(sql`update invoices set brand_profile_id = ${first} where id = ${original.id}`).rejects.toThrow(/festgeschrieben/);
    const [seal] =
      await sql`select digest = haben_seal_digest(table_name, row_id, columns) as intact from seals where table_name = 'invoices' and row_id = ${original.id}`;
    expect(seal!.intact).toBe(true);
  });

  it("übernimmt die Marke in Rechnung, Storno und Korrektur, auch nach dem Deaktivieren", async () => {
    const quote = await quotes.createQuoteDraft(actor, { ...quoteDraft(), brandProfileId: second });
    await quotes.finalizeQuote(actor, quote.id);
    await brands.setBrandProfileArchived(actor, second, true);
    const invoice = await quotes.quoteToInvoice(actor, quote.id, "2026-10-02");
    expect(invoice.brandProfileId).toBe(second);
    await invoices.finalizeInvoice(actor, invoice.id, kleinunternehmerStand);
    const correction = await invoices.createCorrection(actor, invoice.id, "2026-10-03");
    expect(correction.brandProfileId).toBe(second);
    await invoices.deleteDraft(actor, correction.id);
    const cancellation = await invoices.cancelInvoice(actor, invoice.id, "2026-10-04");
    expect(cancellation.brandProfileId).toBe(second);
    expect(cancellation.seller?.name).toBe("Beispielfirma GmbH");
  });
});
