import { brandProfileInputSchema } from "@haben/core";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "../middleware.ts";
import {
  brandBankAccounts,
  listBrandProfiles,
  MAX_BACKGROUND_BYTES,
  saveBrandImage,
  saveBrandProfile,
  setBrandProfileArchived,
} from "../modules/stammdaten/index.ts";

export const getBrandProfiles = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => ({ profiles: await listBrandProfiles(), bankAccounts: await brandBankAccounts() }));

export const storeBrandProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.uuid().nullable(), profile: brandProfileInputSchema }))
  .handler(({ data, context }) => saveBrandProfile(context.user.id, data.id, data.profile));

export const archiveBrandProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.uuid(), archived: z.boolean() }))
  .handler(async ({ data, context }) => {
    await setBrandProfileArchived(context.user.id, data.id, data.archived);
    return { ok: true };
  });

export const uploadBrandImage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.uuid(), kind: z.enum(["logo", "background"]), base64: z.string().max(Math.ceil((MAX_BACKGROUND_BYTES * 4) / 3) + 16) }))
  .handler(async ({ data, context }) => {
    await saveBrandImage(context.user.id, data.id, data.kind, new Uint8Array(Buffer.from(data.base64, "base64")));
    return { ok: true };
  });

export const removeBrandImage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.uuid(), kind: z.enum(["logo", "background"]) }))
  .handler(async ({ data, context }) => {
    await saveBrandImage(context.user.id, data.id, data.kind, null);
    return { ok: true };
  });
