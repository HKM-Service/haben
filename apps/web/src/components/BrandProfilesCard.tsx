import type { LetterheadDesign } from "@haben/core";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useAction } from "../lib/use-action.ts";
import { archiveBrandProfile, type getBrandProfiles } from "../server/functions/brand-profiles.ts";
import { BrandProfileForm } from "./BrandProfileForm.tsx";
import { FormDialog } from "./FormDialog.tsx";
import { NoticeBanner } from "./NoticeBanner.tsx";

export type BrandProfilesData = Awaited<ReturnType<typeof getBrandProfiles>>;
export type BrandProfileOption = BrandProfilesData["profiles"][number];

/** Marken teilen die Firma; deren Rechts- und Steuerdaten werden hier nicht erneut eingegeben. */
export function BrandProfilesCard({ data, baseDesign }: { data: BrandProfilesData; baseDesign: LetterheadDesign }) {
  const router = useRouter();
  const archive = useServerFn(archiveBrandProfile);
  const { busy, notice, run } = useAction();
  const [editing, setEditing] = useState<BrandProfileOption | "new" | null>(null);
  const changeState = (profile: BrandProfileOption) =>
    run(
      async () => {
        await archive({ data: { id: profile.id, archived: !profile.archivedAt } });
        await router.invalidate();
      },
      profile.archivedAt ? "Marke wieder aktiviert." : "Marke deaktiviert. Vorhandene Belege behalten ihre Zuordnung.",
    );

  return (
    <section className="card" aria-labelledby="brands-heading">
      <h2 id="brands-heading">Markenprofile</h2>
      <p className="small muted">
        Eigene Marken mit Logo, Briefpapier und Kontaktdaten. Rechtlicher Aussteller, Steuerdaten, Buchhaltung und Nummernvergabe kommen aus den gemeinsamen
        Firmendaten.
      </p>
      {data.profiles.length === 0 && <p>Noch keine Marke angelegt. Logo und Gestaltung kannst du später ergänzen.</p>}
      <ul className="stack" aria-label="Angelegte Marken">
        {data.profiles.map((profile) => (
          <li key={profile.id}>
            <strong>{profile.name}</strong>
            {profile.defaultForNew && " · Standard für neue Belege"}
            {profile.archivedAt && " · Inaktiv"}
            <div className="actions">
              {!profile.archivedAt && (
                <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setEditing(profile)} aria-label={`${profile.name} bearbeiten`}>
                  Bearbeiten
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy}
                onClick={() => void changeState(profile)}
                aria-label={`${profile.name} ${profile.archivedAt ? "aktivieren" : "deaktivieren"}`}
              >
                {profile.archivedAt ? "Aktivieren" : "Deaktivieren"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="actions">
        <button type="button" className="btn" disabled={busy} onClick={() => setEditing("new")}>
          Marke anlegen
        </button>
      </div>
      <NoticeBanner notice={notice} />
      <FormDialog
        open={editing !== null}
        title={editing === "new" ? "Marke anlegen" : `${editing?.name ?? "Marke"} bearbeiten`}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <BrandProfileForm
            baseDesign={baseDesign}
            profile={editing === "new" ? null : editing}
            accounts={data.bankAccounts}
            onClose={() => setEditing(null)}
          />
        )}
      </FormDialog>
    </section>
  );
}
