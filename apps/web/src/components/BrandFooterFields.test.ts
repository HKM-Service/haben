import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandFooterFields } from "./BrandFooterFields.tsx";

const render = (columns: string[] | null) => renderToStaticMarkup(createElement(BrandFooterFields, { columns, onChange: () => {} }));

describe("Eigene Fußzeilen einer Marke", () => {
  it("verwendet zunächst die automatische Fußzeile und bietet die eigene ausdrücklich an", () => {
    const html = render(null);
    expect(html).toContain("Eigene Fußzeile dieser Marke");
    expect(html).not.toContain("<textarea");
  });

  it("macht vorhandene markeneigene Spalten beschriftet bearbeitbar", () => {
    const html = render(["HKMcore\n{firma}\n{email}", "IBAN {iban}", "USt-IdNr. {ustid}"]);
    expect(html.match(/<textarea/g)).toHaveLength(3);
    expect(html).toContain("Fußzeile Spalte 1");
    expect(html).toContain("HKMcore\n{firma}\n{email}");
    expect(html).toContain("USt-IdNr. {ustid}");
    expect(html).not.toContain("Steuernummer oder USt-IdNr. fehlt");
  });

  it("zeigt fehlende Steuerangaben, damit sie vor dem Speichern ergänzt werden können", () => {
    expect(render(["HKMcore", "IBAN {iban}"])).toContain("Steuernummer oder USt-IdNr. fehlt");
  });
});
