import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/mini";
import { InvoiceEditor } from "../../../components/InvoiceEditor.tsx";
import { customerDraft, schlussrechnungEntwurf } from "../../../lib/invoice.ts";
import { getNewInvoice } from "../../../server/functions/invoices.ts";

export const Route = createFileRoute("/_app/rechnungen/neu")({
  /** schluss: Schlussrechnung zu dieser Abschlagsrechnung vorbereiten; kunde: Entwurf für diesen Kunden (Kontaktseite, #1557) */
  validateSearch: z.object({ schluss: z.optional(z.uuid()), kunde: z.optional(z.uuid()) }),
  loader: () => getNewInvoice(),
  head: () => ({ meta: [{ title: "Neue Rechnung · Haben" }] }),
  component: NewInvoicePage,
});

function NewInvoicePage() {
  const data = Route.useLoaderData();
  const { schluss, kunde } = Route.useSearch();
  const abschlag = schluss ? data.abschlaege.find((a) => a.id === schluss) : undefined;
  // Die Schlussrechnung wählt keinen Ansprechpartner von selbst: Am Abschlag kann „Keiner“ bewusst gewählt sein (#1335)
  const withContact = customerDraft(
    data.draft,
    data.contacts,
    abschlag ? abschlag.contactId : kunde,
    data.companySkonto,
    abschlag ? [] : data.contactPersons,
    data.bankverbindungen,
  );
  // Von einer Abschlagsrechnung aus: Steuer, Preismodus, Angebot und Marke wie dort (schlussrechnungEntwurf)
  const initial = abschlag && withContact ? schlussrechnungEntwurf(withContact, abschlag, data.abschlaege) : (withContact ?? data.draft);
  return (
    <InvoiceEditor
      key={abschlag ? abschlag.id : (withContact?.contactId ?? "neu")}
      id={null}
      kind="rechnung"
      initial={initial}
      contacts={data.contacts}
      seller={data.company}
      brandProfiles={data.brandProfiles}
      sellerIssues={data.sellerIssues}
      letterIssues={data.letterIssues}
      issues={[]}
      numberCounters={data.numberCounters}
      numberRunning={data.numberRunning}
      numberPerCustomer={data.numberPerCustomer}
      numberFormat={data.numberFormat}
      lastFinalized={data.lastFinalized}
      corrects={null}
      bundesland={data.bundesland}
      kleinunternehmer={data.kleinunternehmer}
      companySkonto={data.companySkonto}
      articles={data.articles}
      units={data.units}
      textBlocks={data.textBlocks}
      abschlaege={data.abschlaege}
      quotes={data.quotes}
      mandates={data.mandates}
      contactPersons={data.contactPersons}
      bankverbindungen={data.bankverbindungen}
      standardIban={data.standardIban}
    />
  );
}
