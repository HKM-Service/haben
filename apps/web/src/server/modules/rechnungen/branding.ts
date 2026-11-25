import type { Seller } from "@haben/einvoice";
import type { Db, Tx } from "../../db/index.ts";
import { db } from "../../db/index.ts";
import { brandLetterhead, brandProfile, brandSeller, loadCompany, loadLetterhead, sellerFrom } from "../stammdaten/index.ts";

/** Pflichtfeld- und Formatprüfung verwenden dieselben wirksamen Angaben wie das erzeugte Dokument. */
export async function documentSeller(seller: Seller, profileId?: string | null, q: Db | Tx = db) {
  return profileId ? brandSeller(seller, await brandProfile(profileId, q), q) : seller;
}

/** Gemeinsame steuerliche Firmendaten und der für diesen Beleg wirksame Aussteller. */
export async function documentIssuer(profileId?: string | null, q: Db | Tx = db) {
  const company = await loadCompany(q);
  return { company, seller: await documentSeller(sellerFrom(company), profileId, q) };
}

/** Auswahl und Gestaltung werden gemeinsam geladen; im Verkäufer bleibt immer die rechtliche Firma erhalten. */
export async function documentBranding(seller: Seller, profileId?: string | null, q: Db | Tx = db) {
  if (!profileId) return { seller, letterhead: await loadLetterhead() };
  const profile = await brandProfile(profileId, q);
  return { seller: await brandSeller(seller, profile, q), letterhead: brandLetterhead(profile) };
}
