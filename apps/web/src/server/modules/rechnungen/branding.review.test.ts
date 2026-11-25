import { brandProfileInputSchema } from "@haben/core";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { leeren, setupTestDb, testDatabaseUrl } from "../../test-db.ts";

describe.skipIf(!testDatabaseUrl)("Wirksame Markenangaben beim Festschreiben (Postgres)", () => {
  let invoices: typeof import("./invoices.ts");
  let quotes: typeof import("./quotes.ts");
  let brands: typeof import("../stammdaten/brand-profiles.ts");
  let sql: postgres.Sql;
  let contactId: string;
  let brandProfileId: string;
  const actor = "test-user";
  const email = "marke@example.invalid";
  const iban = "DE12500105170648489890";
  const draft = () => ({
    contactId,
    brandProfileId,
    issueDate: "2026-10-02",
    serviceFrom: "2026-09-01",
    serviceTo: "2026-09-30",
    paymentTermDays: 14,
    format: "zugferd" as const,
    note: "",
    lines: [{ description: "Beratung", quantity: 1000, unit: "Std.", unitPrice: 10000, taxRate: 1900 as const }],
  });

  beforeAll(async () => {
    sql = await setupTestDb();
    invoices = await import("./invoices.ts");
    quotes = await import("./quotes.ts");
    brands = await import("../stammdaten/brand-profiles.ts");
  }, 120_000);
  afterAll(async () => {
    await sql?.end();
  });
  beforeEach(async () => {
    await leeren(sql)`truncate journal_lines, journal_entries, invoices, invoice_number_counters, quotes, quote_number_counters,
      contact_versions, contacts, letterhead_profiles, bank_accounts, company cascade`;
    await sql`insert into company (id, name, strasse, plz, ort, email, telefon, steuernummer, ust_id, bundesland, iban, bic, bank)
      values (1, 'Beispielfirma GmbH', 'Musterstraße 1', '93047', 'Regensburg', 'zentrale@example.invalid', '030 1234',
              '198/113/10010', 'DE123456789', 'BY', 'DE89370400440532013000', 'COBADEFFXXX', 'Beispielbank')`;
    const [contact] = await sql`insert into contacts (name, strasse, plz, ort, email, kundennummer)
      values ('Beispielkunde', 'Hafenstraße 5', '20457', 'Hamburg', 'kunde@example.invalid', '10001') returning id`;
    contactId = contact!.id;
    const [account] = await sql`insert into bank_accounts (name, iban) values ('Firmenkonto der Marke', ${iban}) returning id`;
    brandProfileId = (await brands.saveBrandProfile(actor, null, brandProfileInputSchema.parse({ name: "HKMcore", email, bankAccountId: account!.id }))).id;
  });

  it.each(["email", "iban"] as const)("schreibt eine Rechnung mit Markenangaben trotz leerem Firmenfeld %s fest", async (field) => {
    await sql`update company set ${sql(field)} = '' where id = 1`;
    const created = await invoices.createDraft(actor, draft());

    expect(await invoices.finalizeIssues(created.id)).toEqual([]);
    const finalized = await invoices.finalizeInvoice(actor, created.id);
    expect(finalized).toMatchObject({ status: "final", seller: { name: "Beispielfirma GmbH", brand: "HKMcore", email, iban } });
    expect(finalized.pdf?.length).toBeGreaterThan(0);
    expect(finalized.xml).toContain(email);
    expect(finalized.xml).toContain(iban);
  });

  it.each(["email", "iban"] as const)("schreibt ein Angebot mit Markenangaben trotz leerem Firmenfeld %s fest", async (field) => {
    await sql`update company set ${sql(field)} = '' where id = 1`;
    const created = await quotes.createQuoteDraft(actor, { ...draft(), validUntil: "2026-10-31" });

    expect(await quotes.quoteIssues(created.id)).toEqual([]);
    const finalized = await quotes.finalizeQuote(actor, created.id);
    expect(finalized).toMatchObject({ status: "final", seller: { name: "Beispielfirma GmbH", brand: "HKMcore", email, iban } });
    expect(finalized.pdf?.length).toBeGreaterThan(0);
  });
});
