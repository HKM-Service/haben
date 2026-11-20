import { describe, expect, it } from "vitest";
import { footerColumns } from "./pdf.ts";
import { sampleDocument, sampleSeller } from "./samples.ts";
import type { InvoiceFormat } from "./types.ts";
import { buildEInvoice } from "./xml.ts";

const seller = { ...sampleSeller, brand: "HKMcore", website: "https://example.invalid", email: "marke@example.invalid" };

describe("Marke und rechtlicher Rechnungsaussteller", () => {
  it("ergänzt die Marke und deren Website in der automatischen Fußzeile", () => {
    const columns = footerColumns(seller);
    expect(columns[0]!.slice(0, 2)).toEqual(["HKMcore", sampleSeller.name]);
    expect(columns[0]).toContain(seller.email);
    expect(columns[0]).toContain(seller.website);
  });

  it.each<InvoiceFormat>(["zugferd", "xrechnung-cii", "xrechnung-ubl"])("bewahrt den rechtlichen Verkäufer im XML (%s)", async (format) => {
    const { xml } = await buildEInvoice({ ...sampleDocument({ format }), seller });
    const party =
      format === "xrechnung-ubl"
        ? xml.match(/<cac:AccountingSupplierParty>([\s\S]*?)<\/cac:AccountingSupplierParty>/)?.[1]
        : xml.match(/<ram:SellerTradeParty>([\s\S]*?)<\/ram:SellerTradeParty>/)?.[1];
    expect(party).toContain(sampleSeller.name);
    expect(party).toContain(seller.email);
    expect(party).not.toContain("HKMcore");
  });
});
