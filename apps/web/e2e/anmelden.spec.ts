import { expect, test } from "@playwright/test";
import { ANONYMOUS, USER } from "./daten.ts";

/*
 * Passkey-Autofill auf der Anmeldeseite. Es braucht ein Feld mit autocomplete="webauthn", sonst wirft
 * startAuthentication von @simplewebauthn/browser, noch bevor der Browser gefragt wird. Das Feld gibt es erst im
 * Passwort-Formular. Bricht das Autofill ab, hat niemand etwas getan, und die Seite zeigt keinen Fehler.
 */

test.use(ANONYMOUS);

declare global {
  interface Window {
    conditionalRequests: number;
    unknownPasskey: boolean;
  }
}

test.beforeEach(async ({ page }) => {
  // Headless gibt es keinen Passkey; ein abgebrochenes Autofill sieht so aus, wie der Browser es meldet
  await page.addInitScript(() => {
    window.conditionalRequests = 0;
    const get = navigator.credentials.get.bind(navigator.credentials);
    navigator.credentials.get = (options) => {
      if (options?.mediation !== "conditional") return get(options);
      window.conditionalRequests++;
      if (window.unknownPasskey) {
        // Ein Passkey, den der Server nicht kennt, z. B. in den Einstellungen schon entfernt
        const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
        const response = { authenticatorData: bytes, clientDataJSON: bytes, signature: bytes, userHandle: null };
        const credential = { id: "AQIDBA", rawId: bytes, type: "public-key", response, authenticatorAttachment: "platform" };
        return Promise.resolve({ ...credential, getClientExtensionResults: () => ({}) } as unknown as Credential);
      }
      return Promise.reject(new DOMException("Abgebrochen", "NotAllowedError"));
    };
  });
  await page.goto("/login", { waitUntil: "networkidle" });
});

test("Beim Öffnen steht kein Fehler auf der Seite", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Mit Passkey anmelden" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("Das Passwort-Formular bietet das Autofill an, ein Abbruch bleibt ohne Fehler", async ({ page }) => {
  await page.getByRole("button", { name: "Passwort verwenden" }).click();
  await expect(page.getByLabel("E-Mail")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.conditionalRequests)).toBe(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("Ein falsches Passwort zeigt weiter einen Fehler", async ({ page }) => {
  await page.getByRole("button", { name: "Passwort verwenden" }).click();
  await page.getByLabel("E-Mail").fill(USER.email);
  await page.getByLabel("Passwort").fill("falsches-passwort");
  await page.getByRole("button", { name: "Mit Passwort anmelden" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});

test("Wählt man im Autofill einen Passkey, den der Server ablehnt, zeigt die Seite einen Fehler", async ({ page }) => {
  await page.evaluate(() => {
    window.unknownPasskey = true;
  });
  const verify = page.waitForResponse((r) => r.url().endsWith("/passkey/verify-authentication"));
  await page.getByRole("button", { name: "Passwort verwenden" }).click();
  expect((await verify).ok()).toBe(false);
  await expect(page.getByRole("alert")).toHaveText("Passkey not found");
});

// Das Logo „HKM finanz“ auf der Karte hängt nicht an der Navigation: Es bleibt am Handy 56 Pixel hoch (nur die 60 Pixel hohe
// Leiste nimmt die Mindestgröße von 40) und steht in seinem Kasten, auch wenn die Seitenleiste eingeklappt gespeichert ist
test("Das Logo auf der Karte bleibt am Handy und bei eingeklappter Seitenleiste 56 Pixel hoch und in seinem Kasten", async ({ page }) => {
  const gemessen: Record<string, { logo: [number, number]; imKasten: boolean; name: string | null }> = {};
  for (const [fall, breite, eingeklappt] of [
    ["Desktop", 1280, false],
    ["Handy", 375, false],
    ["Desktop, Leiste eingeklappt", 1280, true],
  ] as const) {
    await page.setViewportSize({ width: breite, height: 812 });
    await page.evaluate((zu) => (zu ? localStorage.setItem("haben-nav", "collapsed") : localStorage.removeItem("haben-nav")), eingeklappt);
    await page.reload({ waitUntil: "networkidle" });
    if (eingeklappt) await expect(page.locator("html")).toHaveAttribute("data-nav", "collapsed");
    gemessen[fall] = await page.locator(".auth-card .auth-logo").evaluate((el) => {
      const kasten = el.getBoundingClientRect();
      const logo = el.querySelector("svg")!.getBoundingClientRect();
      return {
        logo: [Math.round(logo.width), Math.round(logo.height)],
        imKasten: logo.left >= kasten.left - 0.5 && logo.right <= kasten.right + 0.5,
        name: el.querySelector(".visually-hidden")?.textContent ?? null,
      };
    });
  }
  await page.evaluate(() => localStorage.removeItem("haben-nav"));
  const erwartet = { logo: [73, 56], imKasten: true, name: "HKM finanz" };
  expect(gemessen).toEqual({ Desktop: erwartet, Handy: erwartet, "Desktop, Leiste eingeklappt": erwartet });
});
