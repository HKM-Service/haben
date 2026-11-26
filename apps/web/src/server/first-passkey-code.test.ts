import type postgres from "postgres";
import { chmod, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cookieOf } from "./sso-test-provider.ts";
import { leeren, setupTestDb, testDatabaseUrl } from "./test-db.ts";

describe.skipIf(!testDatabaseUrl)("Erster Passkey mit Einmalcode (Postgres)", () => {
  let database: postgres.Sql;
  let handleAuth: typeof import("./auth.ts").handleAuth;
  let issueCode: typeof import("./first-passkey-code.ts").issueFirstPasskeyCode;
  let identifier: typeof import("./first-passkey-code.ts").firstPasskeyCodeIdentifier;
  let ownerId: string;
  let client = 1;

  const request = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
    handleAuth(
      new Request(`http://localhost:3000/api/auth${path}`, {
        method: body ? "POST" : "GET",
        headers: { origin: "http://localhost:3000", "content-type": "application/json", "x-forwarded-for": `127.0.0.${client++}`, ...headers },
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
  const redeem = (code: string, headers?: Record<string, string>) => request("/sign-in/first-passkey-code", { code }, headers);
  const sessions = () => database`select id from session`;
  const pending = () => database`select id from verification where identifier like 'first-passkey-code:%'`;

  async function addExistingPasskey() {
    await database`insert into passkey (id, public_key, user_id, credential_id, counter, device_type, backed_up)
      values ('test-passkey', 'synthetischer-oeffentlicher-schluessel', ${ownerId}, 'test-credential', 0, 'singleDevice', false)`;
  }

  beforeAll(async () => {
    database = await setupTestDb();
    ({ handleAuth } = await import("./auth.ts"));
    ({ issueFirstPasskeyCode: issueCode, firstPasskeyCodeIdentifier: identifier } = await import("./first-passkey-code.ts"));
  }, 60_000);

  beforeEach(async () => {
    await leeren(database)`truncate "user", user_logins, verification cascade`;
    const { setupCode } = await import("./setup-code.ts");
    const created = await request(
      "/sign-up/email",
      { name: "Inhaber", email: "inhaber@example.invalid", password: "synthetisches-langes-testpasswort" },
      { "x-haben-setup-code": setupCode() },
    );
    expect(created.status).toBe(200);
    ownerId = (await created.json()).user.id;
    await database`delete from session`;
  });

  afterAll(async () => {
    await database?.end();
    await (await import("./db/index.ts")).closeDatabase();
  });

  it("prüft einen eingegebenen Einmalcode ohne vorhandene Sitzung", async () => {
    const response = await redeem("");
    expect(response.status).toBe(400);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("stellt einen kurzlebigen Zufallscode aus und speichert ausschließlich seinen Digest", async () => {
    const issued = await issueCode();
    expect(issued.code.length).toBe(43);
    expect(/^[A-Za-z0-9_-]{43}$/.test(issued.code)).toBe(true);
    const [stored] = await database`select identifier, value, expires_at from verification where identifier = ${identifier(issued.code)}`;
    expect(stored!.value).toBe(ownerId);
    expect(stored!.identifier.includes(issued.code)).toBe(false);
    expect(new Date(stored!.expires_at).getTime() - Date.now()).toBeGreaterThan(14 * 60_000);
    expect(new Date(stored!.expires_at).getTime() - Date.now()).toBeLessThanOrEqual(15 * 60_000);
    expect(await sessions()).toHaveLength(0);
  });

  it("meldet genau einmal an, protokolliert die Anmeldung und verändert Konto und Passwort nicht", async () => {
    const before = JSON.stringify(await database`select to_jsonb("user") as u, (select jsonb_agg(to_jsonb(account)) from account) as a from "user"`);
    const issued = await issueCode();
    const response = await redeem(`  ${issued.code}\n`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    const session = await (await request("/get-session", undefined, { cookie: cookieOf(response.headers) })).json();
    expect(session.user.id).toBe(ownerId);
    expect(session.user.role).toBe("inhaber");
    expect(session.session.oidcIssuer).toBeNull();
    expect(await sessions()).toHaveLength(1);
    expect(await pending()).toHaveLength(0);
    expect(await database`select method from user_logins where method = 'einmalcode'`).toEqual([{ method: "einmalcode" }]);
    const after = JSON.stringify(await database`select to_jsonb("user") as u, (select jsonb_agg(to_jsonb(account)) from account) as a from "user"`);
    expect(after === before).toBe(true);
    const replay = await redeem(issued.code);
    expect(replay.status).toBe(400);
    expect(replay.headers.getSetCookie()).toEqual([]);
    expect(await sessions()).toHaveLength(1);
  });

  it("weist falsche und abgelaufene Codes ohne Sitzung oder Sitzungscookie ab", async () => {
    const issued = await issueCode();
    const wrong = await redeem("x".repeat(43));
    expect(wrong.status).toBe(400);
    expect(wrong.headers.getSetCookie()).toEqual([]);
    await database`update verification set expires_at = now() - interval '1 second' where identifier = ${identifier(issued.code)}`;
    const expired = await redeem(issued.code);
    expect(expired.status).toBe(400);
    expect(expired.headers.getSetCookie()).toEqual([]);
    expect(await sessions()).toHaveLength(0);
  });

  it("entwertet bei einer Neuausgabe den alten Code und erhält andere Verifikationen", async () => {
    await database`insert into verification (id, identifier, value, expires_at) values ('andere-verifikation', 'andere-challenge', ${ownerId}, now() + interval '1 hour')`;
    const first = await issueCode();
    const second = await issueCode();
    expect(first.code === second.code).toBe(false);
    expect((await redeem(first.code)).status).toBe(400);
    expect((await redeem(second.code)).status).toBe(200);
    expect(await database`select id from verification where id = 'andere-verifikation'`).toHaveLength(1);
  });

  it("lässt bei zwei gleichzeitigen Verwendungen nur eine Anmeldung zu", async () => {
    const issued = await issueCode();
    const results = await Promise.all([redeem(issued.code), redeem(issued.code)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    expect(await sessions()).toHaveLength(1);
    expect(await database`select id from user_logins where method = 'einmalcode'`).toHaveLength(1);
  });

  it("hält auch bei gleichzeitigen Neuausgaben nur einen gültigen Code", async () => {
    const issued = await Promise.all([issueCode(), issueCode()]);
    expect(await pending()).toHaveLength(1);
    const results = await Promise.all(issued.map((i) => redeem(i.code)));
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    expect(await sessions()).toHaveLength(1);
  });

  it("weist ein nach der Ausgabe gesperrtes Konto ab", async () => {
    const issued = await issueCode();
    await database`update "user" set locked_at = now() where id = ${ownerId}`;
    const response = await redeem(issued.code);
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(await sessions()).toHaveLength(0);
    await expect(issueCode()).rejects.toThrow("keinen ungesperrten lokalen Inhaber");
  });

  it("hält einen wegen Kontosperre abgewiesenen Code auch nach dem Entsperren ungültig", async () => {
    const issued = await issueCode();
    await database`update "user" set locked_at = now() where id = ${ownerId}`;
    expect((await redeem(issued.code)).status).toBe(400);
    await database`update "user" set locked_at = null where id = ${ownerId}`;
    const retry = await redeem(issued.code);
    expect(retry.status).toBe(400);
    expect(retry.headers.getSetCookie()).toEqual([]);
    expect(await sessions()).toHaveLength(0);
  });

  it("hält einen wegen Passkey abgewiesenen Code auch nach dessen Löschung ungültig", async () => {
    const issued = await issueCode();
    await addExistingPasskey();
    expect((await redeem(issued.code)).status).toBe(400);
    await database`delete from passkey`;
    const retry = await redeem(issued.code);
    expect(retry.status).toBe(400);
    expect(retry.headers.getSetCookie()).toEqual([]);
    expect(await sessions()).toHaveLength(0);
  });

  it("weist auch einen falsch zugeordneten Nachweis für eine fremde Rolle ab", async () => {
    const issued = await issueCode();
    await database`insert into "user" (id, name, email, role) values ('fremde-rolle', 'Steuerberatung', 'kanzlei@example.invalid', 'steuerberatung')`;
    await database`update verification set value = 'fremde-rolle' where identifier = ${identifier(issued.code)}`;
    const response = await redeem(issued.code);
    expect(response.status).toBe(400);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(await sessions()).toHaveLength(0);
  });

  it("gibt bei vorhandenem Passkey keinen Code aus und weist einen früher ausgegebenen ab", async () => {
    const issued = await issueCode();
    await addExistingPasskey();
    const response = await redeem(issued.code);
    expect(response.status).toBe(400);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(await sessions()).toHaveLength(0);
    await expect(issueCode()).rejects.toThrow("bereits einen Passkey");
    expect(await database`select id from passkey`).toHaveLength(1);
  });

  it("übernimmt keine Kontowahl aus dem Browser", async () => {
    const issued = await issueCode();
    const response = await request("/sign-in/first-passkey-code", { code: issued.code, userId: "fremd", email: "fremd@example.invalid" });
    expect(response.status).toBe(400);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(await pending()).toHaveLength(1);
    expect(await sessions()).toHaveLength(0);
  });

  it("verhindert einen Erstlogin mit fremdem Origin auch ohne bestehendes Cookie", async () => {
    const issued = await issueCode();
    const response = await redeem(issued.code, { origin: "https://fremd.example.invalid", "sec-fetch-site": "cross-site" });
    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(await pending()).toHaveLength(1);
    expect(await sessions()).toHaveLength(0);
    expect((await redeem(issued.code)).status).toBe(200);
  });

  it("begrenzt Fehlversuche auch für den neuen Anmeldepfad", async () => {
    const statuses = [];
    for (let n = 0; n < 4; n++) statuses.push((await redeem("x".repeat(43), { "x-forwarded-for": "203.0.113.18" })).status);
    expect(statuses).toEqual([400, 400, 400, 429]);
    expect(await sessions()).toHaveLength(0);
  });

  it("legt den Code per Betreiberbefehl nur geschützt ab und gibt ihn nicht aus", async () => {
    const dir = await mkdtemp(join(tmpdir(), "haben-einmalcode-"));
    const target = join(dir, "code.json");
    try {
      const cli = new URL("./first-passkey-code-cli.ts", import.meta.url).pathname;
      const run = spawnSync(process.execPath, [cli, "--ausgabe", target], { env: process.env, encoding: "utf8", timeout: 30_000 });
      expect(run.status).toBe(0);
      const issued = JSON.parse(await readFile(target, "utf8"));
      expect((await stat(target)).mode & 0o777).toBe(0o600);
      expect(issued.code.length).toBe(43);
      expect((run.stdout + run.stderr).includes(issued.code)).toBe(false);
      expect((await redeem(issued.code)).status).toBe(200);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("überschreibt keine Ausgabedatei und entwertet dabei keinen bestehenden Code", async () => {
    const { writeFirstPasskeyCode } = await import("./first-passkey-code-cli.ts");
    const dir = await mkdtemp(join(tmpdir(), "haben-einmalcode-"));
    const target = join(dir, "code.json");
    try {
      await writeFirstPasskeyCode(target);
      const before = await readFile(target, "utf8");
      await expect(writeFirstPasskeyCode(target)).rejects.toThrow();
      expect((await readFile(target, "utf8")) === before).toBe(true);
      expect(await pending()).toHaveLength(1);
      expect((await redeem(JSON.parse(before).code)).status).toBe(200);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("weist offene Ausgabeordner und Symlinks ohne Codeausgabe ab", async () => {
    const { writeFirstPasskeyCode } = await import("./first-passkey-code-cli.ts");
    const dir = await mkdtemp(join(tmpdir(), "haben-einmalcode-"));
    const target = join(dir, "code.json");
    try {
      await chmod(dir, 0o750);
      await expect(writeFirstPasskeyCode(target)).rejects.toThrow("0700");
      await chmod(dir, 0o700);
      const other = join(dir, "fremd.json");
      await writeFile(other, "nicht-veraendern", { mode: 0o600 });
      await symlink(other, target);
      await expect(writeFirstPasskeyCode(target)).rejects.toThrow();
      expect(await readFile(other, "utf8")).toBe("nicht-veraendern");
      expect(await pending()).toHaveLength(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it.each([false, true])("rollt bei einem Protokollfehler auch den Codeverbrauch zurück (beim Commit: %s)", async (deferred) => {
    const issued = await issueCode();
    const logs = vi.spyOn(console, "error").mockImplementation(() => {});
    await database`create or replace function test_fail_code_login() returns trigger language plpgsql as $$
      begin if new.method = 'einmalcode' then raise exception 'Testfehler'; end if; return new; end $$`;
    await database.unsafe(
      deferred
        ? "create constraint trigger test_fail_code_login after insert on user_logins deferrable initially deferred for each row execute function test_fail_code_login()"
        : "create trigger test_fail_code_login before insert on user_logins for each row execute function test_fail_code_login()",
    );
    try {
      const response = await redeem(issued.code);
      expect(response.status).toBe(503);
      expect(response.headers.getSetCookie()).toEqual([]);
      expect(await sessions()).toHaveLength(0);
      expect(await pending()).toHaveLength(1);
      expect(await database`select id from user_logins where method = 'einmalcode'`).toHaveLength(0);
      expect(logs.mock.calls.flat().join(" ").includes(issued.code)).toBe(false);
      expect((await response.text()).includes(issued.code)).toBe(false);
    } finally {
      await database`drop trigger test_fail_code_login on user_logins`;
      logs.mockRestore();
    }
    expect((await redeem(issued.code)).status).toBe(200);
  });
});
