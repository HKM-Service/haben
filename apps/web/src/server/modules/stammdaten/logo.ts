import { UserError } from "../../errors.ts";
import { MAX_LOGO_BYTES } from "@haben/core";
import { logoFormat, type Logo } from "@haben/einvoice";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { withActor } from "../../db/actor.ts";
import { db, schema, type Tx } from "../../db/index.ts";

/** Firmenlogo für den Briefkopf von Rechnungen, Angeboten und Mahnungen */

export class LogoError extends UserError {}

export { MAX_LOGO_BYTES };

export async function loadLogo(): Promise<Logo | undefined> {
  const [row] = await db.select({ logo: schema.companyLogo.logo, format: schema.companyLogo.format }).from(schema.companyLogo);
  return row ? { data: new Uint8Array(row.logo), format: row.format } : undefined;
}

export async function logoInfo(): Promise<{ format: "png" | "jpg"; sha256: string; createdAt: Date } | null> {
  const [row] = await db
    .select({ format: schema.companyLogo.format, sha256: schema.companyLogo.sha256, createdAt: schema.companyLogo.createdAt })
    .from(schema.companyLogo);
  return row ?? null;
}

/** Prüft ein Logo und liefert die Werte zum Speichern; für das Firmenlogo (putLogo) und das einer Marke (brand-assets.ts) */
export function prepareLogo(data: Uint8Array) {
  if (data.length === 0) throw new LogoError("Die Datei ist leer.");
  if (data.length > MAX_LOGO_BYTES) throw new LogoError("Das Logo darf höchstens 1 MB groß sein.");
  const format = logoFormat(data);
  if (!format) throw new LogoError("Als Logo gehen PNG und JPEG.");
  return { logo: Buffer.from(data), format, sha256: createHash("sha256").update(data).digest("hex"), createdAt: new Date() };
}

export async function saveLogo(actor: string, data: Uint8Array): Promise<void> {
  await withActor(actor, (tx) => putLogo(tx, data));
}

/** saveLogo in der Transaktion des Aufrufers */
export async function putLogo(tx: Tx, data: Uint8Array): Promise<void> {
  const values = prepareLogo(data);
  await tx
    .insert(schema.companyLogo)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: schema.companyLogo.id, set: values });
}

export async function removeLogo(actor: string): Promise<void> {
  await withActor(actor, (tx) => tx.delete(schema.companyLogo).where(eq(schema.companyLogo.id, 1)));
}
