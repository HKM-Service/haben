import { DEFAULT_FOOTER_COLUMNS, FOOTER_PLACEHOLDERS, footerIssues, MAX_FOOTER_COLUMNS, MAX_FOOTER_TEXT, MIN_FOOTER_COLUMNS } from "@haben/core";
import { useRef } from "react";
import { Field } from "./Field.tsx";
import { FormattedTextarea } from "./FormattedTextarea.tsx";

/** Eigene Spalten bleiben Teil der noch ungespeicherten Markenangaben. */
export function BrandFooterFields({ columns, onChange }: { columns: string[] | null; onChange: (columns: string[] | null) => void }) {
  const remembered = useRef({ count: (columns ?? DEFAULT_FOOTER_COLUMNS).length, columns: [...(columns ?? DEFAULT_FOOTER_COLUMNS)] });
  const issues = columns ? footerIssues(columns) : [];
  const store = (next: string[]) => {
    next.forEach((text, index) => {
      remembered.current.columns[index] = text;
    });
    remembered.current.count = next.length;
    onChange(next);
  };
  const restore = (count: number) => store(Array.from({ length: count }, (_, index) => remembered.current.columns[index] ?? ""));

  return (
    <section className="stack">
      <h3>Fußzeile</h3>
      <label className="checkbox">
        <input type="checkbox" checked={columns !== null} onChange={(event) => (event.target.checked ? restore(remembered.current.count) : onChange(null))} />
        Eigene Fußzeile dieser Marke
      </label>
      {columns === null ? (
        <p className="small muted">Die automatische Fußzeile enthält Firmen- und Markenkontakt, Bankverbindung und Steuerangaben.</p>
      ) : (
        <>
          <Field label="Fußzeile: Anzahl Spalten">
            {(control) => (
              <select {...control} value={columns.length} onChange={(event) => restore(Number(event.target.value))}>
                {Array.from({ length: MAX_FOOTER_COLUMNS - MIN_FOOTER_COLUMNS + 1 }, (_, index) => index + MIN_FOOTER_COLUMNS).map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <div className="grid-2">
            {columns.map((text, index) => (
              <Field key={index} label={`Fußzeile Spalte ${index + 1}`}>
                {(control) => (
                  <FormattedTextarea
                    {...control}
                    rows={5}
                    maxLength={MAX_FOOTER_TEXT}
                    value={text}
                    onChange={(event) => store(columns.map((current, at) => (at === index ? event.target.value : current)))}
                  />
                )}
              </Field>
            ))}
          </div>
          <p className="small muted">
            Platzhalter: {FOOTER_PLACEHOLDERS.map((name) => `{${name}}`).join(", ")}. {"{firma}"} bleibt der rechtliche Firmenname. Die Änderung wird mit „Marke
            speichern“ gespeichert.
          </p>
          {issues.length > 0 && (
            <div className="banner banner-danger" role="status">
              <ul>
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
