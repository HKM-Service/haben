import { and, eq, gt, like, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, schema, type Tx } from "./db/index.ts";

const PREFIX = "first-passkey-session:";
type SetupSession = { id: string; userId: string; expiresAt: Date };

/** Nur die tatsächlich mit Einmalcode ausgestellte Sitzung steuert den Einrichtungsablauf; keine URL-Parameter. */
export async function markFirstPasskeySession(tx: Tx, session: SetupSession) {
  await tx.insert(schema.verification).values({ id: randomUUID(), identifier: PREFIX + session.id, value: session.userId, expiresAt: session.expiresAt });
}

/**
 * Die Marke gilt, solange ihre Sitzung gilt. Better Auth verlängert eine genutzte Sitzung (updateAge), die Marke behält
 * aber das erste Ende; maßgeblich ist deshalb das Ende der Sitzung in der Datenbank, nicht das der Marke.
 */
export async function isFirstPasskeySession(session: SetupSession): Promise<boolean> {
  const [marker] = await db
    .select({ id: schema.verification.id })
    .from(schema.verification)
    .innerJoin(schema.session, eq(schema.session.id, session.id))
    .where(
      and(
        eq(schema.verification.identifier, PREFIX + session.id),
        eq(schema.verification.value, session.userId),
        eq(schema.session.userId, session.userId),
        gt(schema.session.expiresAt, sql`clock_timestamp()`),
      ),
    )
    .limit(1);
  return !!marker;
}

export async function clearFirstPasskeySessions(tx: Tx, userId: string) {
  await tx.delete(schema.verification).where(and(eq(schema.verification.value, userId), like(schema.verification.identifier, `${PREFIX}%`)));
}
