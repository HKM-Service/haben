import type { Seller } from "@haben/einvoice";
import type { Db, Tx } from "../../db/index.ts";
import { db } from "../../db/index.ts";
import { BrandProfileError, brandLetterhead, brandProfile, brandSeller, type Company, loadCompany, loadLetterhead } from "../stammdaten/index.ts";
import { draftSeller } from "./invoice-document.ts";

/** Was einen Entwurf zum Beleg einer Marke macht und welches Zahlungskonto er nennt (#1887) */
export interface BrandedDraft {
  brandProfileId: string | null;
  bankverbindungId: string | null;
  paymentMethod?: string;
}

/**
 * Das Konto der Marke gilt nur, wenn der Beleg keines selbst festlegt: Ein gewähltes weiteres Zahlungskonto geht vor, und
 * eine Lastschrift zieht immer auf das Konto aus den Firmendaten ein (draftSeller).
 */
const keepsOwnBank = (draft: BrandedDraft) => draft.bankverbindungId !== null || draft.paymentMethod === "lastschrift";

/** Verkäufer des Entwurfs mit seinem Zahlungskonto, dazu die Marke; im Verkäufer bleibt immer die rechtliche Firma erhalten. */
export async function documentSeller(q: Db | Tx, company: Company, draft: BrandedDraft): Promise<Seller> {
  const seller = await draftSeller(q, company, draft);
  return draft.brandProfileId ? brandSeller(seller, await brandProfile(draft.brandProfileId, q), q, keepsOwnBank(draft)) : seller;
}

/** Firmendaten und der für diesen Beleg wirksame Aussteller; Pflichtfeld- und Formatprüfung sehen dieselben Angaben wie das Dokument. */
export async function documentIssuer(draft: BrandedDraft, q: Db | Tx = db) {
  const company = await loadCompany(q);
  const issues: string[] = [];
  try {
    return { company, seller: await documentSeller(q, company, draft), issues };
  } catch (error) {
    if (!(error instanceof BrandProfileError)) throw error;
    issues.push(error.message);
    return { company, seller: await draftSeller(q, company, draft), issues };
  }
}

/** Verkäufer und Gestaltung der Marke gemeinsam; ohne Marke das Standardprofil. */
export async function documentBranding(q: Db | Tx, company: Company, draft: BrandedDraft) {
  const seller = await draftSeller(q, company, draft);
  if (!draft.brandProfileId) return { seller, letterhead: await loadLetterhead() };
  const profile = await brandProfile(draft.brandProfileId, q);
  return { seller: await brandSeller(seller, profile, q, keepsOwnBank(draft)), letterhead: brandLetterhead(profile) };
}
