import { Link } from "@tanstack/react-router";
import type { BrandProfileOption } from "./BrandProfilesCard.tsx";
import { Field } from "./Field.tsx";

export function BrandProfileSelect({
  profiles,
  value,
  onChange,
  disabled = false,
}: {
  profiles: readonly BrandProfileOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <Field
      label="Marke / Rechnungsprofil"
      style={{ gridColumn: "1 / -1" }}
      hint={
        <>
          {disabled ? "Die Marke wird vom ursprünglichen Beleg übernommen. " : "Logo, Briefpapier und Kontaktdaten dieser Marke. "}
          <Link to="/einstellungen" search={{ bereich: "gestaltung" }}>
            Marken verwalten
          </Link>
        </>
      }
    >
      {(control) => (
        <select {...control} value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">Gemeinsame Firmengestaltung</option>
          {profiles
            .filter((profile) => !profile.archivedAt || profile.id === value)
            .map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
                {profile.archivedAt ? " (inaktiv)" : ""}
              </option>
            ))}
        </select>
      )}
    </Field>
  );
}
