import { discountFromColumns, type UnitLabel } from "@haben/core";
import { useAction } from "../lib/use-action.ts";
import type { getQuoteDetail } from "../server/functions/quotes.ts";
import { InvoiceAttachments } from "./InvoiceAttachments.tsx";
import { InvoiceEditor } from "./InvoiceEditor.tsx";

/** Gemeinsamer Belegeditor mit den gespeicherten Angaben des Angebotsentwurfs. */
export function QuoteDraftEditor({ data }: { data: Awaited<ReturnType<typeof getQuoteDetail>> }) {
  const { quote } = data;
  const draftAction = useAction();
  return (
    <InvoiceEditor
      key={`${quote.id}-${String(quote.updatedAt)}`}
      action={draftAction}
      id={quote.id}
      kind="angebot"
      initial={{
        contactId: quote.contactId,
        brandProfileId: quote.brandProfileId,
        contactPersonId: quote.contactPersonId,
        issueDate: quote.issueDate,
        validUntil: quote.validUntil,
        serviceFrom: quote.serviceFrom,
        serviceTo: quote.serviceTo,
        paymentTermDays: 0,
        format: "zugferd",
        intro: quote.intro,
        note: quote.note,
        buyerOrderReference: quote.buyerOrderReference,
        sellerOrderReference: quote.sellerOrderReference,
        despatchAdviceReference: quote.despatchAdviceReference,
        taxTreatment: quote.taxTreatment,
        taxDetails: quote.taxDetails,
        exemptionReason: quote.exemptionReason,
        priceMode: quote.priceMode,
        language: quote.language,
        discount: discountFromColumns(quote.discountPercent, quote.discountAmount),
        paymentPlan: quote.paymentPlan,
        paymentPlanInConfirmation: quote.paymentPlanInConfirmation,
        lines: data.lines.map((line) => ({
          description: line.description,
          detail: line.detail,
          itemNumber: line.itemNumber,
          quantity: line.quantity,
          unit: line.unit as UnitLabel,
          unitPrice: line.unitPrice,
          taxRate: line.taxRate as 1900 | 700 | 0,
          discount: discountFromColumns(line.discountPercent, line.discountAmount),
          kind: line.kind,
        })),
      }}
      planTemplates={data.planTemplates}
      contactPersons={data.contactPersons}
      contacts={data.contacts}
      seller={data.company}
      brandProfiles={data.brandProfiles}
      sellerIssues={data.sellerIssues}
      letterIssues={data.letterIssues}
      issues={data.issues}
      numberCounters={data.numberCounters}
      numberRunning={data.numberRunning}
      numberFormat={data.numberFormat}
      corrects={null}
      bundesland={data.bundesland}
      kleinunternehmer={data.kleinunternehmer}
      articles={data.articles}
      units={data.units}
      textBlocks={data.textBlocks}
      attachments={<InvoiceAttachments kind="angebot" ownerId={quote.id} attachments={data.attachments} editable />}
    />
  );
}
