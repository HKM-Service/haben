import type { Seller } from "@haben/einvoice";
import type { Db, Tx } from "../../db/index.ts";
import { db } from "../../db/index.ts";
import { brandLetterhead, brandProfile, brandSeller, loadLetterhead } from "../stammdaten/index.ts";

/** Pflichtfeld- und Formatprüfung verwenden dieselben wirksamen Angaben wie das erzeugte Dokument. */
export async function documentSeller(seller: Seller, profileId?: string | null, q: Db | Tx = db) {
  return profileId ? brandSeller(seller, await brandProfile(profileId, q), q) : seller;
}

/** Auswahl und Gestaltung werden gemeinsam geladen; im Verkäufer bleibt immer die rechtliche Firma erhalten. */
export async function documentBranding(seller: Seller, profileId?: string | null, q: Db | Tx = db) {
  if (!profileId) return { seller, letterhead: await loadLetterhead() };
  const profile = await brandProfile(profileId, q);
  return { seller: await brandSeller(seller, profile, q), letterhead: brandLetterhead(profile) };
}
