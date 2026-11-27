import { lstat, open, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { closeDatabase } from "./db/index.ts";
import { UserError } from "./errors.ts";
import { issueFirstPasskeyCode } from "./first-passkey-code.ts";

/** Kein Code in Argumenten, Ausgabe oder Logs: ausschließlich eine neue Datei in einem privaten Ordner. */
export async function writeFirstPasskeyCode(path: string) {
  const target = resolve(path);
  const parent = await lstat(dirname(target));
  if (!parent.isDirectory() || (parent.mode & 0o077) !== 0 || parent.uid !== process.getuid?.()) {
    throw new UserError("Der Ausgabeordner muss dir gehören und darf für andere nicht zugänglich sein (Modus 0700).");
  }
  // Schon vor der Ausgabe in der Datenbank prüfen: Eine vorhandene Datei darf auch keinen Code entwerten.
  const file = await open(target, "wx", 0o600);
  let written = false;
  try {
    const issued = await issueFirstPasskeyCode();
    await file.writeFile(`${JSON.stringify(issued)}\n`);
    await file.sync();
    written = true;
    return { email: issued.email, expiresAt: issued.expiresAt };
  } finally {
    await file.close();
    if (!written) await unlink(target);
  }
}

async function main() {
  const { values } = parseArgs({ options: { ausgabe: { type: "string" } }, strict: true });
  if (!values.ausgabe) throw new UserError("Aufruf: bun src/server/first-passkey-code-cli.ts --ausgabe <neue-Datei-im-privaten-Ordner>");
  const issued = await writeFirstPasskeyCode(values.ausgabe);
  console.log(`Einmalcode geschützt abgelegt. Gültig bis ${issued.expiresAt.toISOString()}.`);
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(
      error instanceof UserError ? error.message : "Der Einmalcode konnte nicht geschützt bereitgestellt werden. Keine Zugangsdaten werden ausgegeben.",
    );
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}
