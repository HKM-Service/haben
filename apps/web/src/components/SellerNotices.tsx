import { Link } from "@tanstack/react-router";
import { Icon } from "./Icon.tsx";

/** Hinweise zum Rechnungsaussteller, getrennt von den übrigen Belegfeldern. */
export function SellerNotices({ blocking, currentSellerIssues, letterIssues }: { blocking: string[]; currentSellerIssues: string[]; letterIssues: string[] }) {
  return (
    <>
      {blocking.length > 0 && (
        <div className="banner" role="status">
          <Icon name="alert" />
          <span>
            Vor dem Festschreiben: {blocking.join(", ")}.{" "}
            {currentSellerIssues.length > 0 && (
              <Link to="/einstellungen" search={{ bereich: "firma" }}>
                Firmendaten ergänzen
              </Link>
            )}
          </span>
        </div>
      )}
      {letterIssues.length > 0 && (
        <div className="banner" role="status" id="letter-issues">
          <Icon name="alert" />
          <span>
            Pflichtangaben für Geschäftsbriefe unvollständig (§ 35a GmbHG): {letterIssues.join(", ")}. Festschreiben geht trotzdem, der Fuß nennt dann nur, was
            eingetragen ist.{" "}
            <Link to="/einstellungen" search={{ bereich: "firma" }}>
              Firmendaten ergänzen
            </Link>
          </span>
        </div>
      )}
    </>
  );
}
