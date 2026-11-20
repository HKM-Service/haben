import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** Bei einer Marke dürfen die gemeinsamen Gestaltungsaktionen nicht versehentlich die Firma ändern. */
export function BrandDesignPanel({ profileId, children }: { profileId: string | null; children: ReactNode }) {
  return profileId ? (
    <p>
      Die Gestaltung dieser Marke wird in den{" "}
      <Link to="/einstellungen" search={{ bereich: "gestaltung" }}>
        Markenprofilen
      </Link>{" "}
      bearbeitet.
    </p>
  ) : (
    children
  );
}
