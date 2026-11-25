import { expect, type Page, type TestInfo } from "@playwright/test";

/** Langsame Rechner setzen das Blatt laut vorschau-render.ts auf Knopfdruck; ein Renderfehler bleibt ein Fehler. */
export async function markenVorschauPruefen(page: Page, texts: readonly string[]) {
  const preview = page.getByLabel("Vorschau der Rechnung");
  const refresh = preview.getByRole("button", { name: "Aktualisieren", exact: true });
  const failure = preview.getByRole("alert");
  await expect
    .poll(async () => {
      const content = (await preview.textContent()) ?? "";
      return texts.every((text) => content.includes(text)) || (await refresh.isVisible()) || (await failure.count()) > 0;
    })
    .toBe(true);
  await expect(failure).toHaveCount(0);
  if (await refresh.isVisible()) await refresh.click();
  for (const text of texts) await expect(preview).toContainText(text);
  await expect(failure).toHaveCount(0);
}

async function bilder(page: Page, testInfo: TestInfo, width: number) {
  const choice = page.getByLabel("Marke / Rechnungsprofil", { exact: true });
  await expect(choice.locator("option:checked")).toHaveText("Zweite Marke");
  await page.evaluate(() => document.fonts.ready);
  for (const mode of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.mode = value;
    }, mode);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (width === 1440) {
      const preview = page.getByLabel("Vorschau der Rechnung");
      await markenVorschauPruefen(page, ["Zweite Marke", "Markentest"]);
      const image = preview.getByRole("img").first();
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
    }
    const sizes = await choice.evaluate((element) => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
    if (width === 390) expect(sizes.height).toBeGreaterThanOrEqual(44);
    expect(sizes.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`rechnung-${mode}-${width}-nachher.png`), animations: "disabled" });
  }
}

/** Ein schmales Mausfenster bleibt bei 40px; die Handyprüfung braucht wie handy-felder.spec.ts echte Touch-Emulation. */
export async function markenAnsichtenPruefen(page: Page, testInfo: TestInfo) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await bilder(page, testInfo, 1440);
  const browser = page.context().browser();
  if (!browser) throw new Error("Für die Handyprüfung fehlt der Browser.");
  const mobile = await browser.newContext({
    storageState: await page.context().storageState(),
    viewport: { width: 390, height: 1000 },
    hasTouch: true,
    isMobile: true,
  });
  try {
    const phone = await mobile.newPage();
    const errors: string[] = [];
    phone.on("pageerror", (error) => errors.push(error.message));
    await phone.goto(page.url());
    expect(await phone.evaluate(() => matchMedia("(pointer: coarse)").matches), "Touch-Gerät").toBe(true);
    await bilder(phone, testInfo, 390);
    expect(errors).toEqual([]);
  } finally {
    await mobile.close();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    document.documentElement.dataset.mode = "light";
  });
}
