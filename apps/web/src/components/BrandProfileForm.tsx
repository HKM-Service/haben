import { brandProfileInputSchema, designWithDefaults, type LetterheadDesign, type BrandProfileInput } from "@haben/core";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { useAction } from "../lib/use-action.ts";
import { storeBrandProfile } from "../server/functions/brand-profiles.ts";
import { BrandImageUpload } from "./BrandImageUpload.tsx";
import type { BrandProfileOption, BrandProfilesData } from "./BrandProfilesCard.tsx";
import { AccentField, DesignOptionFields } from "./DesignPanel.tsx";
import { Field } from "./Field.tsx";
import { NoticeBanner } from "./NoticeBanner.tsx";

export function BrandProfileForm({
  profile,
  accounts,
  baseDesign,
  onClose,
}: {
  profile: BrandProfileOption | null;
  baseDesign: LetterheadDesign;
  accounts: BrandProfilesData["bankAccounts"];
  onClose: () => void;
}) {
  const router = useRouter();
  const save = useServerFn(storeBrandProfile);
  const { busy, notice, run } = useAction();
  const [value, setValue] = useState<BrandProfileInput>(() => ({
    name: profile?.name ?? "",
    email: profile?.email ?? "",
    phone: profile?.phone ?? "",
    website: profile?.website ?? "",
    bankAccountId: profile?.bankAccountId ?? null,
    intro: profile?.intro ?? "",
    note: profile?.note ?? "",
    defaultForNew: profile?.defaultForNew ?? false,
    design: profile?.design ?? baseDesign,
  }));
  const change = (fields: Partial<BrandProfileInput>) => setValue((current) => ({ ...current, ...fields }));
  const design = designWithDefaults(value.design);
  const changeDesign = (fields: BrandProfileInput["design"]) => change({ design: { ...value.design, ...fields } });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await run(async () => {
      const parsed = brandProfileInputSchema.safeParse(value);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Bitte die Angaben prüfen.");
      await save({ data: { id: profile?.id ?? null, profile: parsed.data } });
      await router.invalidate();
    });
    if (ok) onClose();
  }

  return (
    <form className="stack" onSubmit={submit}>
      <fieldset disabled={busy} className="stack">
        <legend className="visually-hidden">Angaben dieser Marke</legend>
        <Field label="Markenname" hint="Zum Beispiel HKMcore. Die rechtliche Firma bleibt in den Firmendaten hinterlegt.">
          {(control) => (
            <input {...control} value={value.name} onChange={(e) => change({ name: e.target.value })} placeholder="z. B. HKMcore" maxLength={120} required />
          )}
        </Field>
        <label className="checkbox">
          <input type="checkbox" checked={value.defaultForNew} onChange={(e) => change({ defaultForNew: e.target.checked })} />
          Standard für neue Rechnungen und Angebote
        </label>
        <div className="grid-2">
          <Field label="E-Mail der Marke" hint="Leer übernimmt die E-Mail der Firma.">
            {(control) => <input {...control} type="email" value={value.email} onChange={(e) => change({ email: e.target.value })} />}
          </Field>
          <Field label="Telefon der Marke" hint="Leer übernimmt die Telefonnummer der Firma.">
            {(control) => <input {...control} type="tel" value={value.phone} onChange={(e) => change({ phone: e.target.value })} maxLength={80} />}
          </Field>
        </div>
        <Field label="Website der Marke">
          {(control) => <input {...control} type="url" value={value.website} onChange={(e) => change({ website: e.target.value })} placeholder="https://" />}
        </Field>
        <Field label="Bankkonto auf den Belegen" hint="Nur Konten der gemeinsamen Firma; leer übernimmt die Bankverbindung aus den Firmendaten.">
          {(control) => (
            <select {...control} value={value.bankAccountId ?? ""} onChange={(e) => change({ bankAccountId: e.target.value || null })}>
              <option value="">Bankverbindung der Firma</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {account.iban}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Einleitung für neue Belege" hint="Kann später im einzelnen Beleg geändert werden.">
          {(control) => <textarea {...control} value={value.intro} onChange={(e) => change({ intro: e.target.value })} maxLength={2000} rows={3} />}
        </Field>
        <Field label="Schlusstext für neue Belege">
          {(control) => <textarea {...control} value={value.note} onChange={(e) => change({ note: e.target.value })} maxLength={2000} rows={3} />}
        </Field>
        <details>
          <summary>Logo, Briefpapier und Gestaltung</summary>
          <div className="stack">
            {!profile && <p className="small muted">Speichere die Marke zuerst. Danach kannst du sie bearbeiten und Logo oder Briefpapier hochladen.</p>}
            <DesignOptionFields
              design={design}
              onChange={changeDesign}
              logoUpload={profile ? <BrandImageUpload id={profile.id} kind="logo" hash={profile.logoHash} /> : null}
            />
            <AccentField accent={design.accent} onChange={(accent) => changeDesign({ accent })} />
            <section>
              <h3>Briefpapier</h3>
              {profile && <BrandImageUpload id={profile.id} kind="background" hash={profile.backgroundHash} />}
              <p className="small muted">PNG oder JPEG, oder die erste Seite eines PDFs. Bilder werden beim Hochladen sofort gespeichert.</p>
              <Field label="Briefpapier auf">
                {(control) => (
                  <select {...control} value={design.backgroundPages} onChange={(e) => changeDesign({ backgroundPages: e.target.value as "erste" | "alle" })}>
                    <option value="erste">Erster Seite</option>
                    <option value="alle">Allen Seiten</option>
                  </select>
                )}
              </Field>
              <label className="checkbox">
                <input type="checkbox" checked={design.footerHidden} onChange={(e) => changeDesign({ footerHidden: e.target.checked })} />
                Briefpapier enthält bereits Fußzeile und alle Pflichtangaben der Firma
              </label>
            </section>
          </div>
        </details>
      </fieldset>
      <NoticeBanner notice={notice} />
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Speichert …" : "Marke speichern"}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={onClose}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
