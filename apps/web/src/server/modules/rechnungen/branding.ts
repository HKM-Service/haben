import type { Seller } from "@haben/einvoice";
import type { Db, Tx } from "../../db/index.ts";
import { db } from "../../db/index.ts";
import { BrandProfileError, brandLetterhead, brandProfile, brandSeller, loadCompany, loadLetterhead, sellerFrom } from "../stammdaten/index.ts";

/** Pflichtfeld- und Formatprüfung verwenden dieselben wirksamen Angaben wie das erzeugte Dokument. */
export async function documentSeller(seller: Seller, profileId?: string | null, q: Db | Tx = db) {
  return profileId ? brandSeller(seller, await brandProfile(profileId, q), q) : seller;
}

/** Gemeinsame steuerliche Firmendaten und der für diesen Beleg wirksame Aussteller. */
export async function documentIssuer(profileId?: string | null, q: Db | Tx = db) {
  const company = await loadCompany(q);
  let seller = sellerFrom(company);
  const issues: string[] = [];
  try {
    seller = await documentSeller(seller, profileId, q);
  } catch (error) {
    if (!(error instanceof BrandProfileError)) throw error;
    issues.push(error.message);
  }
  return { company, seller, issues };
}

/** Auswahl und Gestaltung werden gemeinsam geladen; im Verkäufer bleibt immer die rechtliche Firma erhalten. */
export async function documentBranding(seller: Seller, profileId?: string | null, q: Db | Tx = db) {
  if (!profileId) return { seller, letterhead: await loadLetterhead() };
  const profile = await brandProfile(profileId, q);
  return { seller: await brandSeller(seller, profile, q), letterhead: brandLetterhead(profile) };
}
