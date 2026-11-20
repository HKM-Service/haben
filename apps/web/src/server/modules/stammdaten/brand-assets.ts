import { eq, sql } from "drizzle-orm";
import { withActor } from "../../db/actor.ts";
import { schema } from "../../db/index.ts";
import { prepareBackground } from "./background.ts";
import { BrandProfileError, brandProfile } from "./brand-profiles.ts";
import { prepareLogo } from "./logo.ts";

export type BrandImageKind = "logo" | "background";

export async function saveBrandImage(actor: string, id: string, kind: BrandImageKind, data: Uint8Array | null) {
  const logo = data && kind === "logo" ? prepareLogo(data) : null;
  const background = data && kind === "background" ? await prepareBackground(data) : null;
  await withActor(actor, async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('haben.brand_profiles'))`);
    const row = await brandProfile(id, tx);
    if (row.archivedAt) throw new BrandProfileError("Bitte die Marke vor dem Bearbeiten wieder aktivieren.");
    const values =
      kind === "logo"
        ? { logo: logo?.logo ?? null, logoFormat: logo?.format ?? null, logoHash: logo?.sha256 ?? null }
        : { background: background?.background ?? null, backgroundFormat: background?.format ?? null, backgroundHash: background?.sha256 ?? null };
    await tx
      .update(schema.letterheadProfiles)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(schema.letterheadProfiles.id, id));
  });
}

export async function brandImage(id: string, kind: BrandImageKind) {
  const row = await brandProfile(id);
  const data = kind === "logo" ? row.logo : row.background;
  const format = kind === "logo" ? row.logoFormat : row.backgroundFormat;
  return data && format ? { data: new Uint8Array(data), format } : null;
}
