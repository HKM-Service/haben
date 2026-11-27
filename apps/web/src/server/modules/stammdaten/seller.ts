import { legalInfo } from "@haben/core";
import type { Seller } from "@haben/einvoice";
import type { Company } from "./company.ts";

/** Zahlungskonto des Belegs statt des Standards aus den Firmendaten (#1887), nur die Felder des Kontos */
type SellerBank = Pick<Company, "iban" | "bic" | "bank" | "kontoinhaber">;

/** Verkäufer aus den Firmendaten; mit `bank` das gewählte weitere Zahlungskonto statt des Standards (#1887) */
export function sellerFrom(company: Company, bank: SellerBank | null = null): Seller {
  const { iban, bic, kontoinhaber, bank: bankName } = bank ?? company;
  return {
    name: company.name,
    strasse: company.strasse,
    plz: company.plz,
    ort: company.ort,
    land: "DE",
    email: company.email,
    ...(company.telefon ? { telefon: company.telefon } : {}),
    ...(company.steuernummer ? { steuernummer: company.steuernummer } : {}),
    ...(company.ustId ? { ustId: company.ustId } : {}),
    ...(iban ? { iban } : {}),
    ...(bic ? { bic } : {}),
    ...(bankName ? { bank: bankName } : {}),
    ...(kontoinhaber ? { kontoinhaber } : {}),
    ...sellerLegalInfo(company),
  };
}

/** GmbH und UG: Pflichtangaben für Geschäftsbriefe (§ 35a Abs. 1 GmbHG) aus den Firmendaten */
export function sellerLegalInfo(company: Company): Pick<Seller, "legalInfo"> {
  const info = legalInfo(company);
  return info ? { legalInfo: info } : {};
}
