import { brandProfileInputSchema } from "@haben/core";
import type { Seller } from "@haben/einvoice";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { leeren, setupTestDb, testDatabaseUrl } from "../../test-db.ts";

describe.skipIf(!testDatabaseUrl)("Marken der gemeinsamen GmbH (Postgres)", () => {
  let brands: typeof import("./brand-profiles.ts");
  let assets: typeof import("./brand-assets.ts");
  let letterhead: typeof import("./letterhead.ts");
  let sql: postgres.Sql;
  const actor = "test-user";
  const input = (name: string, extra = {}) => brandProfileInputSchema.parse({ name, ...extra });
  const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));
  const seller: Seller = {
    legalInfo: { seat: "Regensburg", registerCourt: "Amtsgericht Regensburg", registerNumber: "HRB 99999", managingDirectors: ["Alex Beispiel"] },
    name: "Beispielfirma GmbH",
    strasse: "Musterstraße 1",
    plz: "93047",
    ort: "Regensburg",
    land: "DE",
    email: "zentrale@example.invalid",
    telefon: "030 1234",
    ustId: "DE123456789",
    steuernummer: "198/113/10010",
    iban: "DE89370400440532013000",
    bank: "Beispielbank",
    bic: "COBADEFFXXX",
  };

  beforeAll(async () => {
    sql = await setupTestDb();
    brands = await import("./brand-profiles.ts");
    assets = await import("./brand-assets.ts");
    letterhead = await import("./letterhead.ts");
  }, 120_000);
  afterAll(async () => {
    await sql?.end();
  });
  beforeEach(async () => {
    await leeren(sql)`truncate letterhead_profiles, letterhead_background, company_logo, bank_accounts, company cascade`;
    await sql`insert into company (id, name) values (1, 'Beispielfirma GmbH')`;
  });

  it("legt HKMcore ohne fertiges Design an und hält die Firmenvorgabe getrennt", async () => {
    await letterhead.saveDesign(actor, { accent: "#0055AA" });
    const first = await brands.saveBrandProfile(actor, null, input("HKMcore", { defaultForNew: true }));
    const second = await brands.saveBrandProfile(actor, null, input("Weitere Marke", { defaultForNew: true, design: { accent: "#663399" } }));
    expect(await brands.defaultBrandProfileId()).toBe(second.id);
    expect((await brands.brandProfile(first.id)).defaultForNew).toBe(false);
    expect(await letterhead.loadDesign()).toMatchObject({ accent: "#0055AA" });
    expect(await letterhead.loadDesign(undefined, second.id)).toMatchObject({ accent: "#663399" });
    expect(await brands.listBrandProfiles()).toHaveLength(2);
    await letterhead.saveDesign(actor, { accent: "#112233" });
    expect((await brands.brandProfile(first.id)).settings.accent).toBe("#0055AA");
  });

  it("verhindert doppelte aktive Namen und lässt deaktivierte Marken nur an bisherigen Entwürfen zu", async () => {
    const first = await brands.saveBrandProfile(actor, null, input("HKMcore", { defaultForNew: true }));
    await expect(brands.saveBrandProfile(actor, null, input("hkmCORE"))).rejects.toThrow(/bereits/);
    await brands.setBrandProfileArchived(actor, first.id, true);
    expect(await brands.defaultBrandProfileId()).toBeNull();
    await expect(brands.checkedBrandProfileId(first.id)).rejects.toThrow(/inaktiv/);
    expect(await brands.checkedBrandProfileId(first.id, first.id)).toBe(first.id);
    await brands.saveBrandProfile(actor, null, input("HKMcore"));
    await expect(brands.setBrandProfileArchived(actor, first.id, false)).rejects.toThrow(/bereits/);
  });

  it("hält eigene Bilder je Marke und protokolliert deren Prüfsumme ohne Binärdaten", async () => {
    const first = await brands.saveBrandProfile(actor, null, input("HKMcore"));
    const second = await brands.saveBrandProfile(actor, null, input("Weitere Marke"));
    await assets.saveBrandImage(actor, first.id, "logo", png);
    await assets.saveBrandImage(actor, second.id, "background", png);
    const a = await letterhead.loadLetterhead(first.id);
    const b = await letterhead.loadLetterhead(second.id);
    expect(a.logo?.data).toEqual(png);
    expect(a.background).toBeUndefined();
    expect(b.background?.data).toEqual(png);
    expect(b.logo).toBeUndefined();
    const listed = await brands.listBrandProfiles();
    expect(listed.find((row) => row.id === first.id)).toMatchObject({ hasLogo: true, hasBackground: false });
    expect(listed[0]).not.toHaveProperty("logo");
    const [log] =
      await sql`select new_value from audit_log where table_name = 'letterhead_profiles' and new_value->>'id' = ${first.id} order by seq desc limit 1`;
    expect(log!.new_value.logo_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(log!.new_value).not.toHaveProperty("logo");
    await assets.saveBrandImage(actor, first.id, "logo", null);
    expect(await assets.brandImage(first.id, "logo")).toBeNull();
    expect((await letterhead.loadLetterhead(second.id)).background?.data).toEqual(png);
  });

  it("übernimmt Markenkontakt und Firmenkonto, bewahrt aber den rechtlichen Rechnungsaussteller", async () => {
    const [account] = await sql`insert into bank_accounts (name, iban) values ('Zweites Firmenkonto', 'DE12500105170648489890') returning id`;
    const saved = await brands.saveBrandProfile(
      actor,
      null,
      input("HKMcore", {
        email: "marke@example.invalid",
        phone: "040 1234",
        website: "https://example.invalid",
        bankAccountId: account!.id,
      }),
    );
    const changed = await brands.brandSeller(seller, await brands.brandProfile(saved.id));
    expect(changed).toMatchObject({
      ...seller,
      brand: "HKMcore",
      email: "marke@example.invalid",
      telefon: "040 1234",
      website: "https://example.invalid",
      iban: "DE12500105170648489890",
      bank: "Zweites Firmenkonto",
      bic: undefined,
    });
    await sql`update bank_accounts set purpose = 'privat' where id = ${account!.id}`;
    await expect(brands.brandSeller(seller, await brands.brandProfile(saved.id))).rejects.toThrow(/Bankkonto/);
  });

  it("kann das Firmen-Standardprofil nicht über die Markenverwaltung verändern", async () => {
    await letterhead.saveDesign(actor, { accent: "#0055AA" });
    const [row] = await sql`select id from letterhead_profiles where is_default`;
    await expect(brands.saveBrandProfile(actor, row!.id, input("HKMcore"))).rejects.toThrow(/gibt es nicht/);
    await expect(assets.saveBrandImage(actor, row!.id, "logo", png)).rejects.toThrow(/gibt es nicht/);
    expect((await letterhead.loadDesign()).accent).toBe("#0055AA");
  });
});
