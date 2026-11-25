import type { UnitLabel } from "@haben/core";
import { formatDate } from "./format.ts";

type DeductibleInvoice = {
  id: string;
  number: string;
  issueDate: string;
  rates: { rate: number; base: number; tax: number }[];
};

/** Negative Positionen der gewählten Abschläge, identisch zur bisherigen Vorschau im Belegeditor. */
export function deductionPreviewLines(deducted: readonly DeductibleInvoice[], grossPrices: boolean) {
  return deducted.flatMap((a) =>
    a.rates
      .filter((r) => r.base !== 0)
      .map((r) => ({
        description: `Abzüglich Abschlagsrechnung ${a.number} vom ${formatDate(a.issueDate)}`,
        quantity: 1000,
        unit: "Psch." as UnitLabel,
        unitPrice: -(grossPrices ? r.base + r.tax : r.base),
        taxRate: r.rate as 1900 | 700 | 0,
        valid: true,
        deductionOf: a.id,
      })),
  );
}
