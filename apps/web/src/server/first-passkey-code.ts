import { and, eq, gt, isNull, like, sql } from "drizzle-orm";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { withActor } from "./db/actor.ts";
import { schema, type Tx } from "./db/index.ts";
import { UserError } from "./errors.ts";
import { ssoOnly } from "./sso-policy.ts";

/** Eigener Namensraum: weder Einladungen noch WebAuthn-Challenges werden verändert. */
const PREFIX = "first-passkey-code:";
export const FIRST_PASSKEY_CODE_MINUTES = 15;

/** Der Code steht nur beim Betreiber und im Eingabefeld, nie im Klartext in der Datenbank. */
export const firstPasskeyCodeIdentifier = (code: string) => PREFIX + createHash("sha256").update(code.trim()).digest("hex");

async function hasPasskey(tx: Tx, userId: string): Promise<boolean> {
  const [existing] = await tx.select({ id: schema.passkey.id }).from(schema.passkey).where(eq(schema.passkey.userId, userId)).limit(1);
  return !!existing;
}

/** Nur per Betreiberbefehl: ein kurzlebiger Zugang zum bestehenden lokalen Inhaber vor dessen erstem Passkey. */
export async function issueFirstPasskeyCode() {
  if (ssoOnly()) throw new UserError("Im SSO-Modus gibt es keine Einrichtung per Einmalcode.");
  return withActor("system:passkey-einmalcode", async (tx) => {
    // Ausgabe und Verbrauch sperren zuerst dieselbe Kontozeile. Eine Neuausgabe entwertet die vorige.
    const [owner] = await tx
      .select()
      .from(schema.user)
      .where(and(eq(schema.user.role, "inhaber"), isNull(schema.user.lockedAt)))
      .for("update");
    if (!owner) throw new UserError("Es gibt keinen ungesperrten lokalen Inhaber.");
    if (await hasPasskey(tx, owner.id))
      throw new UserError("Der Inhaber hat bereits einen Passkey. Weitere Passkeys lassen sich nach der Anmeldung hinzufügen.");
    await tx.delete(schema.verification).where(and(eq(schema.verification.value, owner.id), like(schema.verification.identifier, `${PREFIX}%`)));
    const code = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + FIRST_PASSKEY_CODE_MINUTES * 60_000);
    await tx.insert(schema.verification).values({ id: randomUUID(), identifier: firstPasskeyCodeIdentifier(code), value: owner.id, expiresAt });
    return { code, expiresAt, email: owner.email };
  });
}

/** Verbrauch, erneute Berechtigung, Sitzung und Anmeldeprotokoll laufen in derselben Transaktion. */
export async function claimFirstPasskeyCode(tx: Tx, code: string) {
  if (ssoOnly()) return null;
  const identifier = firstPasskeyCodeIdentifier(code);
  const [proof] = await tx
    .select()
    .from(schema.verification)
    .where(and(eq(schema.verification.identifier, identifier), gt(schema.verification.expiresAt, sql`clock_timestamp()`)))
    .limit(1);
  if (!proof) return null;
  const [owner] = await tx
    .select()
    .from(schema.user)
    .where(and(eq(schema.user.id, proof.value), eq(schema.user.role, "inhaber"), isNull(schema.user.lockedAt)))
    .for("update");
  if (!owner || (await hasPasskey(tx, owner.id))) return null;
  const [claimed] = await tx
    .delete(schema.verification)
    .where(and(eq(schema.verification.id, proof.id), eq(schema.verification.identifier, identifier), gt(schema.verification.expiresAt, sql`clock_timestamp()`)))
    .returning({ id: schema.verification.id });
  return claimed ? owner : null;
}
