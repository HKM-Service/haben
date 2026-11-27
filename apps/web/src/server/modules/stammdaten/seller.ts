import { legalInfo } from "@haben/core";
import type { Seller } from "@haben/einvoice";
import type { Company } from "./company.ts";

export function sellerFrom(company: Company): Seller {
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
    ...(company.iban ? { iban: company.iban } : {}),
    ...(company.bic ? { bic: company.bic } : {}),
    ...(company.bank ? { bank: company.bank } : {}),
    ...(company.kontoinhaber ? { kontoinhaber: company.kontoinhaber } : {}),
    ...sellerLegalInfo(company),
  };
}

/** GmbH und UG: Pflichtangaben für Geschäftsbriefe (§ 35a Abs. 1 GmbHG) aus den Firmendaten */
export function sellerLegalInfo(company: Company): Pick<Seller, "legalInfo"> {
  const info = legalInfo(company);
  return info ? { legalInfo: info } : {};
}
