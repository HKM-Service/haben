import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../lib/auth-client.ts";
import { errorMessage } from "../lib/format.ts";

/** Ersteinrichtung nach Kontoanlage oder nach der einmaligen Anmeldung zum vorhandenen Konto. */
export function SetupPasskeyStep({ fromCode }: { fromCode: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addPasskey() {
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.passkey.addPasskey({ name: "Haben" });
      if (result?.error) throw new Error(result.error.message);
      await router.navigate({ to: fromCode ? "/" : "/einrichtung" });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!fromCode) return router.navigate({ to: "/einrichtung" });
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      await router.navigate({ to: "/login" });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 style={{ fontSize: 24 }}>Passkey einrichten</h1>
      <p className="muted">
        Mit einem Passkey meldest du dich künftig mit Fingerabdruck, Gesicht oder PIN deines Geräts an, ohne Passwort. Das Passwort bleibt als Rückfallebene.
      </p>
      <button type="button" className="btn btn-primary" onClick={addPasskey} disabled={busy}>
        Passkey hinzufügen
      </button>
      <button type="button" className="btn" onClick={leave} disabled={busy}>
        {fromCode ? "Abmelden" : "Später"}
      </button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
