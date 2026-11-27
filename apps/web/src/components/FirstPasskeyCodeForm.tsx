import { useState, type FormEvent } from "react";
import { authClient } from "../lib/auth-client.ts";
import { errorMessage } from "../lib/format.ts";
import { useSubmitCheck } from "../lib/use-submit-check.ts";
import { Field } from "./Field.tsx";

/** Der Code bleibt im Formular und im POST-Body; er gehört weder in eine URL noch in den Browserspeicher. */
export function FirstPasskeyCodeForm({ onCancel }: { onCancel: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = useSubmitCheck({ code: /^[A-Za-z0-9_-]{43}$/.test(code.trim()) ? null : "Bitte füge den vollständigen Einmalcode ein." });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!check.check()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.$fetch<{ success: boolean }>("/sign-in/first-passkey-code", { method: "POST", body: { code: code.trim() } });
      if (result.error?.status === 429) throw new Error("Zu viele Versuche. Bitte warte kurz und versuche es erneut.");
      if (result.error || !result.data?.success) throw new Error(result.error?.message ?? "Die Anmeldung ist fehlgeschlagen.");
      setCode("");
      // Voll laden, damit die Passkey-Einrichtung bereits die neue Sitzung liest. Kein Code in der Adresse.
      window.location.assign("/setup");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form method="post" className="stack" ref={check.form} noValidate onSubmit={submit}>
      <p className="muted" style={{ margin: 0 }}>
        Mit dem Einmalcode meldest du dich einmalig an. Anschließend speicherst du deinen ersten Passkey auf deinem Gerät oder in deinem Schlüsselbund.
      </p>
      <Field label="Einmalcode" hint="Den Code bekommst du von der Person, die Haben betreibt. Er gilt 15 Minuten und nur einmal." error={check.error("code")}>
        {(control) => (
          <input
            {...control}
            name="code"
            type="password"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setError(null);
            }}
            autoComplete="one-time-code"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={128}
            autoFocus
          />
        )}
      </Field>
      <div className="actions">
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          Zurück
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Code einlösen
        </button>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
