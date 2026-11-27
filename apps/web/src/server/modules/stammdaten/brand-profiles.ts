import { brandProfileInputSchema, designWithDefaults, type BrandProfileInput } from "@haben/core";
import type { Letterhead, Seller } from "@haben/einvoice";
import { and, asc, eq, getTableColumns, isNull, ne, sql } from "drizzle-orm";
import { withActor } from "../../db/actor.ts";
import { db, schema, type Db, type Tx } from "../../db/index.ts";
import { UserError } from "../../errors.ts";

const table = schema.letterheadProfiles;
export class BrandProfileError extends UserError {}
export type BrandProfile = typeof table.$inferSelect;

/** Firmen-Standardprofil und Binärdaten werden nie an die Markenverwaltung im Browser geliefert. */
export async function listBrandProfiles(q: Db | Tx = db) {
  const { logo: _logo, background: _background, ...columns } = getTableColumns(table);
  const rows = await q
    .select({ ...columns, hasLogo: sql<boolean>`${table.logo} is not null`, hasBackground: sql<boolean>`${table.background} is not null` })
    .from(table)
    .where(eq(table.isDefault, false))
    .orderBy(asc(table.name));
  return rows.map(({ settings, ...row }) => ({
    ...row,
    design: designWithDefaults(settings),
  }));
}

export async function brandProfile(id: string, q: Db | Tx = db): Promise<BrandProfile> {
  const [row] = await q
    .select()
    .from(table)
    .where(and(eq(table.id, id), eq(table.isDefault, false)));
  if (!row) throw new BrandProfileError("Dieses Markenprofil gibt es nicht.");
  return row;
}

export async function defaultBrandProfileId(q: Db | Tx = db): Promise<string | null> {
  const [row] = await q
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.defaultForNew, true), isNull(table.archivedAt)));
  return row?.id ?? null;
}

/** Eine inaktive Marke bleibt an vorhandenen Entwürfen; sie lässt sich keinem weiteren Entwurf zuordnen. */
export async function checkedBrandProfileId(id: string | null | undefined, previous: string | null = null, q: Db | Tx = db) {
  if (!id) return null;
  const row = await brandProfile(id, q);
  if (row.archivedAt && id !== previous) throw new BrandProfileError("Diese Marke ist inaktiv. Bitte eine aktive Marke wählen.");
  return row.id;
}

export async function brandBankAccounts(q: Db | Tx = db) {
  return q
    .select({ id: schema.bankAccounts.id, name: schema.bankAccounts.name, iban: schema.bankAccounts.iban })
    .from(schema.bankAccounts)
    .where(and(ne(schema.bankAccounts.purpose, "privat"), ne(schema.bankAccounts.purpose, "zahlungsdienstleister"), isNull(schema.bankAccounts.excludedAt)))
    .orderBy(asc(schema.bankAccounts.name));
}

async function selectedBank(id: string | null, q: Db | Tx) {
  if (!id) return null;
  const account = (await brandBankAccounts(q)).find((item) => item.id === id);
  if (!account) throw new BrandProfileError("Bitte ein Bankkonto dieser Firma wählen.");
  return account;
}

/** Änderungen der Standardwahl und der aktiven Namen werden vor dem ersten Audit-Eintrag serialisiert. */
async function prepareSave(tx: Tx, input: BrandProfileInput, id?: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('haben.brand_profiles'))`);
  await assertName(tx, input.name, id);
  await selectedBank(input.bankAccountId, tx);
  if (input.defaultForNew) await tx.update(table).set({ defaultForNew: false, updatedAt: new Date() }).where(eq(table.defaultForNew, true));
}

async function assertName(tx: Tx, name: string, id?: string) {
  const [duplicate] = await tx
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.isDefault, false), isNull(table.archivedAt), sql`lower(${table.name}) = lower(${name})`, id ? ne(table.id, id) : undefined));
  if (duplicate) {
    throw new BrandProfileError("Eine aktive Marke mit diesem Namen gibt es bereits.");
  }
}

export async function saveBrandProfile(actor: string, id: string | null, raw: BrandProfileInput) {
  const input = brandProfileInputSchema.parse(raw);
  return withActor(actor, async (tx) => {
    await prepareSave(tx, input, id ?? undefined);
    const current = id ? await brandProfile(id, tx) : null;
    if (current?.archivedAt) throw new BrandProfileError("Bitte die Marke vor dem Bearbeiten wieder aktivieren.");
    const [base] = await tx.select({ settings: table.settings }).from(table).where(eq(table.isDefault, true));
    const { design, ...fields } = input;
    const values = { ...fields, settings: designWithDefaults({ ...(current?.settings ?? base?.settings), ...design }), updatedAt: new Date() };
    const [saved] = id
      ? await tx
          .update(table)
          .set(values)
          .where(and(eq(table.id, id), eq(table.isDefault, false)))
          .returning({ id: table.id })
      : await tx
          .insert(table)
          .values({ ...values, isDefault: false })
          .returning({ id: table.id });
    return saved!;
  });
}

export async function setBrandProfileArchived(actor: string, id: string, archived: boolean) {
  return withActor(actor, async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('haben.brand_profiles'))`);
    const row = await brandProfile(id, tx);
    if (!archived) await assertName(tx, row.name, id);
    await tx
      .update(table)
      .set({ archivedAt: archived ? new Date() : null, defaultForNew: false, updatedAt: new Date() })
      .where(eq(table.id, id));
  });
}

/** Alle Bild- und Gestaltungsdaten stammen aus derselben Profilzeile. */
export function brandLetterhead(row: BrandProfile): Letterhead {
  const { accent, layouts, layoutOptions, ...options } = designWithDefaults(row.settings);
  return {
    accent,
    options,
    layoutAssignments: layouts,
    layoutOptions,
    ...(row.logo && row.logoFormat ? { logo: { data: new Uint8Array(row.logo), format: row.logoFormat } } : {}),
    ...(row.background && row.backgroundFormat ? { background: { data: new Uint8Array(row.background), format: row.backgroundFormat } } : {}),
  };
}

/** § 14 Abs. 4 Nr. 1 UStG: Der Markenname ergänzt den rechtlichen Aussteller, dessen Name und Anschrift bleiben erhalten.
 * Quelle: https://www.gesetze-im-internet.de/ustg_1980/__14.html
 * Mit `keepBank` legt der Beleg sein Zahlungskonto selbst fest; dann gilt das Konto der Marke nicht. */
export async function brandSeller(
  seller: Seller,
  row: Pick<BrandProfile, "name" | "email" | "phone" | "website" | "bankAccountId">,
  q: Db | Tx = db,
  keepBank = false,
): Promise<Seller> {
  const account = keepBank ? null : await selectedBank(row.bankAccountId, q);
  return {
    ...seller,
    brand: row.name,
    email: row.email || seller.email,
    telefon: row.phone || seller.telefon,
    ...(row.website ? { website: row.website } : {}),
    ...(account?.iban ? { iban: account.iban, bank: account.name, bic: undefined, kontoinhaber: seller.name } : {}),
  };
}
