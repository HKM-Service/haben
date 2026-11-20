import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { gehe, kundeWaehlen } from "./einrichtung.ts";

/** Im Rechnungsdurchlauf, mit dessen erfundenen Firmen- und Kundendaten. */
export async function markenprofilePruefen(page: Page, testInfo: TestInfo) {
  await gehe(page, "/einstellungen?bereich=gestaltung");
  await page.getByRole("button", { name: "Marke anlegen", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Marke anlegen", exact: true });
  await dialog.getByLabel("Markenname", { exact: true }).fill("HKMcore");
  await dialog.getByLabel("E-Mail der Marke", { exact: true }).fill("core@example.invalid");
  await dialog.getByRole("checkbox", { name: "Standard für neue Rechnungen und Angebote" }).check();
  await dialog.getByRole("button", { name: "Marke speichern", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("list", { name: "Angelegte Marken" })).toContainText("HKMcore · Standard");
  await page.getByRole("button", { name: "Marke anlegen", exact: true }).click();
  await dialog.getByLabel("Markenname", { exact: true }).fill("Zweite Marke");
  await dialog.getByRole("button", { name: "Marke speichern", exact: true }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "HKMcore bearbeiten", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "HKMcore bearbeiten", exact: true });
  await edit.getByText("Logo, Briefpapier und Gestaltung", { exact: true }).click();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
  await edit.getByLabel("Logo der Marke", { exact: true }).setInputFiles({ name: "test-logo.png", mimeType: "image/png", buffer: png });
  await expect(edit.getByText("Logo für diese Marke gespeichert.", { exact: true })).toBeVisible();
  await edit.getByLabel("Briefpapier der Marke", { exact: true }).setInputFiles({ name: "test-briefpapier.png", mimeType: "image/png", buffer: png });
  await expect(edit.getByText("Briefpapier für diese Marke gespeichert.", { exact: true })).toBeVisible();
  await expect(edit.getByRole("img", { name: "Logo dieser Marke", exact: true })).toBeVisible();
  await expect(edit.getByRole("img", { name: "Briefpapier dieser Marke", exact: true })).toBeVisible();
  const axe = await new AxeBuilder({ page }).include('[role="dialog"], dialog').withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await edit.getByRole("button", { name: "Marke speichern", exact: true }).click();
  await expect(edit).toBeHidden();

  await gehe(page, "/rechnungen/neu");
  await kundeWaehlen(page);
  const choice = page.getByLabel("Marke / Rechnungsprofil", { exact: true });
  await expect(choice.locator("option:checked")).toHaveText("HKMcore");
  await page.getByLabel("Beschreibung Position 1", { exact: true }).fill("Markentest");
  await page.getByLabel("Menge Position 1", { exact: true }).fill("2");
  await page.getByLabel(/Einzelpreis Position 1/).fill("75");
  await choice.selectOption({ label: "Zweite Marke" });
  await expect(page.getByLabel("Beschreibung Position 1", { exact: true })).toHaveValue("Markentest");
  await expect(page.getByLabel("Menge Position 1", { exact: true })).toHaveValue("2");
  await page.getByRole("button", { name: "Entwurf speichern", exact: true }).click();
  await expect(page).toHaveURL(/\/rechnungen\/[0-9a-f-]+$/);
  await page.reload();
  await expect(choice.locator("option:checked")).toHaveText("Zweite Marke");
  await expect(page.getByLabel("Beschreibung Position 1", { exact: true })).toHaveValue("Markentest");

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const mode of ["light", "dark"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.mode = value;
      }, mode);
      await page.screenshot({ path: testInfo.outputPath(`rechnung-${mode}-${width}-nachher.png`), fullPage: true, animations: "disabled" });
      const sizes = await choice.evaluate((element) => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
      if (width === 390) expect(sizes.height).toBeGreaterThanOrEqual(44);
      expect(sizes.width).toBeLessThanOrEqual(width);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    document.documentElement.dataset.mode = "light";
  });
}
