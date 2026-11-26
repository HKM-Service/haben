import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { databaseUrlFuer } from "./durchlaeufe.ts";

test.describe.configure({ mode: "serial" });
// Auch bei Fehlern keine Anmeldecodes oder Sitzungen in Netzwerk-Traces und Browserzuständen ablegen.
test.use({ storageState: { cookies: [], origins: [] }, trace: "off", video: "off", screenshot: "off" });

const EMAIL = "passkey-einmalcode@example.invalid";

/** Derselbe Betreiberbefehl wie im App-Image, nur gegen die eigene synthetische Testdatenbank. */
async function issueCode(baseURL: string) {
  const dir = await mkdtemp(join(tmpdir(), "haben-passkey-e2e-"));
  const path = join(dir, "code.json");
  try {
    const cli = fileURLToPath(new URL("../src/server/first-passkey-code-cli.ts", import.meta.url));
    const result = spawnSync(process.execPath, [cli, "--ausgabe", path], {
      encoding: "utf8",
      timeout: 30_000,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrlFuer("passkey-einmalcode"),
        BETTER_AUTH_URL: baseURL,
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "e2e-geheimnis-mindestens-zweiunddreissig-zeichen",
        HABEN_ENCRYPTION_KEY: process.env.HABEN_ENCRYPTION_KEY ?? Buffer.alloc(32, 7).toString("base64"),
        OIDC_ONLY: "false",
      },
    });
    if (result.status !== 0) throw new Error("Der Betreiberbefehl konnte keinen Einmalcode ausgeben.");
    const issued: { code: string } = JSON.parse(await readFile(path, "utf8"));
    expect((result.stdout + result.stderr).includes(issued.code)).toBe(false);
    return issued.code;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test.beforeAll(async ({ request, baseURL }) => {
  const response = await request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL!, "x-haben-setup-code": "e2e-einrichtungscode" },
    data: { name: "Testinhaber", email: EMAIL, password: "synthetisches-langes-testpasswort" },
  });
  expect(response.status()).toBe(200);
  expect((await request.post("/api/auth/sign-out", { headers: { origin: baseURL! }, data: {} })).status()).toBe(200);
});

test("Anmeldung und Codeformular in beiden Modi auf Desktop und Handy", async ({ browser, baseURL }, testInfo) => {
  for (const width of [1440, 390])
    for (const mode of ["hell", "dunkel"]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width === 390, isMobile: width === 390 });
      try {
        await context.addInitScript((selected) => localStorage.setItem("haben-modus", selected), mode);
        const page = await context.newPage();
        await page.goto(`${baseURL}/login`);
        await expect(page.getByRole("heading", { name: "Anmelden", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Einmalcode verwenden" })).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-mode", mode === "hell" ? "light" : "dark");
        await page.screenshot({ path: testInfo.outputPath(`login-${mode}-${width}-nachher.png`), fullPage: true, animations: "disabled" });
        await page.getByRole("button", { name: "Einmalcode verwenden" }).click();
        await expect(page.getByRole("heading", { name: "Ersten Passkey einrichten" })).toBeVisible();
        await expect(page.getByLabel("Einmalcode", { exact: true })).toBeFocused();
        await expect(page.getByLabel("Einmalcode", { exact: true })).toHaveAttribute("type", "password");
        await expect(page.getByLabel("Einmalcode", { exact: true })).toHaveAttribute("autocomplete", "one-time-code");
        await expect(page.locator("form")).toHaveAttribute("method", "post");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`einmalcode-${mode}-${width}-nachher.png`), fullPage: true, animations: "disabled" });
        await page.getByRole("button", { name: "Code einlösen" }).click();
        await expect(page.getByLabel("Einmalcode", { exact: true })).toHaveAttribute("aria-invalid", "true");
        await expect(page.getByLabel("Einmalcode", { exact: true })).toBeFocused();
        await page.getByRole("button", { name: "Zurück", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Anmelden", exact: true })).toBeVisible();
      } finally {
        await context.close();
      }
    }
});

test("Abmelden beendet eine abgebrochene Passkey-Einrichtung", async ({ page, baseURL }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "203.0.113.91" });
  const code = await issueCode(baseURL!);
  await page.goto("/login");
  await page.getByRole("button", { name: "Einmalcode verwenden" }).click();
  await page.getByLabel("Einmalcode", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Code einlösen" }).click();
  await page.waitForURL("**/setup?einmalcode=1");
  await page.goto("/setup");
  await expect(page.getByRole("heading", { name: "Passkey einrichten", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Später", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Abmelden", exact: true }).click();
  await page.waitForURL("**/login");
  expect(await (await page.request.get("/api/auth/get-session")).json()).toBeNull();
});

test("Ein eingerichteter Passkey entwertet offene Codes auch nach seiner Löschung", async ({ page, context, baseURL }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "203.0.113.93" });
  expect(
    (
      await page.request.post("/api/auth/sign-in/email", {
        headers: { origin: baseURL! },
        data: { email: EMAIL, password: "synthetisches-langes-testpasswort" },
      })
    ).status(),
  ).toBe(200);
  const pendingCode = await issueCode(baseURL!);
  await page.goto("/setup");
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  const registered = page.waitForResponse((response) => response.url().endsWith("/passkey/verify-registration"));
  await page.getByRole("button", { name: "Passkey hinzufügen", exact: true }).click();
  expect((await registered).status()).toBe(200);
  const [key] = await (await page.request.get("/api/auth/passkey/list-user-passkeys")).json();
  expect((await page.request.post("/api/auth/passkey/delete-passkey", { headers: { origin: baseURL! }, data: { id: key.id } })).status()).toBe(200);
  const retry = await page.request.post("/api/auth/sign-in/first-passkey-code", { headers: { origin: baseURL! }, data: { code: pendingCode } });
  expect(retry.status()).toBe(400);
  expect((await page.request.post("/api/auth/sign-out", { headers: { origin: baseURL! }, data: {} })).status()).toBe(200);
  await cdp.detach();
});

test("Einmalcode führt zum ersten echten WebAuthn-Passkey und dessen späterer Anmeldung", async ({ page, context, baseURL }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "203.0.113.92" });
  const code = await issueCode(baseURL!);
  await page.goto("/login");
  await page.getByRole("button", { name: "Einmalcode verwenden" }).click();
  await page.getByLabel("Einmalcode", { exact: true }).fill("x".repeat(43));
  await page.getByRole("button", { name: "Code einlösen" }).click();
  await expect(page.getByRole("alert")).toContainText("Einmalcode ist ungültig");
  await page.getByLabel("Einmalcode", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Code einlösen" }).click();
  await page.waitForURL("**/setup?einmalcode=1");
  expect(page.url().includes(code)).toBe(false);
  expect(await page.evaluate((secret) => Object.values(localStorage).some((value) => value.includes(secret)), code)).toBe(false);

  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  const registration = page.waitForResponse((response) => response.url().endsWith("/passkey/verify-registration"));
  await page.getByRole("button", { name: "Passkey hinzufügen", exact: true }).click();
  expect((await registration).status()).toBe(200);
  await page.waitForURL((url) => url.pathname !== "/setup");
  expect(await (await page.request.get("/api/auth/passkey/list-user-passkeys")).json()).toHaveLength(1);
  await expect(issueCode(baseURL!)).rejects.toThrow("keinen Einmalcode");

  expect((await page.request.post("/api/auth/sign-out", { headers: { origin: baseURL! }, data: {} })).status()).toBe(200);
  await page.goto("/login");
  const authenticated = page.waitForResponse((response) => response.url().endsWith("/passkey/verify-authentication"));
  await page.getByRole("button", { name: "Mit Passkey anmelden", exact: true }).click();
  expect((await authenticated).status()).toBe(200);
  await page.waitForURL((url) => url.pathname !== "/login");
  const session = await (await page.request.get("/api/auth/get-session")).json();
  expect(session.user.email).toBe(EMAIL);
  expect(session.user.role).toBe("inhaber");
  await cdp.detach();
});
