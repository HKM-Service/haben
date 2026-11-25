import { brandProfileInputSchema } from "@haben/core";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { leeren, setupTestDb, testDatabaseUrl } from "../../test-db.ts";

type SourceKind = "Angebot" | "Vorlage" | "Korrektur";
type Source = { kind: SourceKind; id: string };
const sourceKinds: SourceKind[] = ["Angebot", "Vorlage", "Korrektur"];

describe.skipIf(!testDatabaseUrl)("Markenvererbung ohne ausdrückliche Profilauswahl (Postgres)", () => {
  let invoices: typeof import("./invoices.ts");
  let quotes: typeof import("./quotes.ts");
  let recurring: typeof import("./recurring.ts");
  let brands: typeof import("../stammdaten/brand-profiles.ts");
  let sql: postgres.Sql;
  let contactId: string;
  let sourceBrand: string;
  let currentDefault: string;
  const actor = "test-user";
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

  beforeAll(async () => {
    sql = await setupTestDb();
    invoices = await import("./invoices.ts");
    quotes = await import("./quotes.ts");
    recurring = await import("./recurring.ts");
    brands = await import("../stammdaten/brand-profiles.ts");
  }, 30_000);
  afterAll(async () => {
    await sql?.end();
  });
  beforeEach(async () => {
    await leeren(sql)`truncate journal_lines, journal_entries, invoices, invoice_number_counters, quotes, quote_number_counters,
      recurring_invoices, contact_versions, contacts, letterhead_profiles, company cascade`;
    await sql`insert into company (id, name, strasse, plz, ort, email, telefon, steuernummer, ust_id, bundesland, iban, bic, bank)
      values (1, 'Beispielfirma GmbH', 'Musterstraße 1', '93047', 'Regensburg', 'zentrale@example.invalid', '030 1234',
              '198/113/10010', 'DE123456789', 'BY', 'DE89370400440532013000', 'COBADEFFXXX', 'Beispielbank')`;
    const [contact] = await sql`insert into contacts (name, strasse, plz, ort, email, kundennummer)
      values ('Beispielkunde', 'Hafenstraße 5', '20457', 'Hamburg', 'kunde@example.invalid', '10001') returning id`;
    contactId = contact!.id;
    sourceBrand = (await brands.saveBrandProfile(actor, null, brandProfileInputSchema.parse({ name: "Herkunftsmarke", defaultForNew: true }))).id;
    currentDefault = (await brands.saveBrandProfile(actor, null, brandProfileInputSchema.parse({ name: "Neue Standardmarke" }))).id;
  });

  const changeDefault = () =>
    brands.saveBrandProfile(actor, currentDefault, brandProfileInputSchema.parse({ name: "Neue Standardmarke", defaultForNew: true }));

  async function source(kind: SourceKind, brandProfileId: string | null): Promise<Source> {
    const input = { ...draft(), brandProfileId };
    if (kind === "Vorlage") {
      const row = await recurring.createRecurring(actor, {
        ...input,
        name: "Monatliche Beratung",
        active: true,
        taxTreatment: "regulaer",
        exemptionReason: "",
        intervalMonths: 1,
        nextDate: "2026-10-02",
        endDate: null,
        servicePeriod: "vorher",
        mode: "entwurf",
      });
      return { kind, id: row.id };
    }
    // Synthetische Herkunftsbelege brauchen hier keinen PDF-Renderer; alle Datenbanksperren und Trigger bleiben aktiv.
    if (kind === "Angebot") {
      const row = await quotes.createQuoteDraft(actor, { ...input, validUntil: "2026-10-31" });
      await sql`update quotes set status = 'final', number = 'A-MARKEN-001', locked_at = now() where id = ${row.id}`;
      return { kind, id: row.id };
    }
    const row = await invoices.createDraft(actor, input);
    await sql`update invoices set status = 'final', number = 'RE-MARKEN-001', locked_at = now() where id = ${row.id}`;
    return { kind, id: row.id };
  }

  function inheritedDraft(from: Source, brandProfileId?: string | null) {
    // Ältere Aufrufer kennen nur den Herkunftsverweis und lassen die neue Auswahl vollständig weg.
    const input = { ...draft(), ...(brandProfileId === undefined ? {} : { brandProfileId }) };
    if (from.kind === "Angebot") return invoices.createDraft(actor, { ...input, quoteId: from.id });
    if (from.kind === "Vorlage") return invoices.createDraft(actor, input, { recurringId: from.id, recurringDate: input.issueDate });
    return invoices.createDraft(
      actor,
      { ...input, lines: input.lines.map((line) => ({ ...line, unitPrice: -line.unitPrice })) },
      { kind: "korrektur", correctsId: from.id },
    );
  }

  it.each(sourceKinds)("übernimmt die Marke aus %s statt der inzwischen gewählten Standardmarke", async (kind) => {
    const from = await source(kind, sourceBrand);
    await changeDefault();

    expect(await brands.defaultBrandProfileId()).toBe(currentDefault);
    expect((await inheritedDraft(from)).brandProfileId).toBe(sourceBrand);
  });

  it.each(sourceKinds)("übernimmt auch eine inzwischen archivierte Marke aus %s", async (kind) => {
    const from = await source(kind, sourceBrand);
    await changeDefault();
    await brands.setBrandProfileArchived(actor, sourceBrand, true);

    expect(await brands.defaultBrandProfileId()).toBe(currentDefault);
    expect((await inheritedDraft(from)).brandProfileId).toBe(sourceBrand);
  });

  it.each(sourceKinds)("behält die gemeinsame Firmengestaltung aus %s ohne Marke bei", async (kind) => {
    const from = await source(kind, null);
    await changeDefault();

    expect(await brands.defaultBrandProfileId()).toBe(currentDefault);
    expect((await inheritedDraft(from)).brandProfileId).toBeNull();
  });

  it.each(["Angebot", "Vorlage"] as const)("beachtet ausdrücklich gewählte Firmengestaltung trotz Marke am Herkunftsbeleg %s", async (kind) => {
    const from = await source(kind, sourceBrand);
    await changeDefault();

    expect((await inheritedDraft(from, null)).brandProfileId).toBeNull();
  });

  it("verwendet die Standardmarke nur für einen neuen Entwurf ohne Herkunft und ohne ausdrückliche Auswahl", async () => {
    await changeDefault();
    expect((await invoices.createDraft(actor, draft())).brandProfileId).toBe(currentDefault);
    expect((await invoices.createDraft(actor, { ...draft(), brandProfileId: null })).brandProfileId).toBeNull();
  });
});
