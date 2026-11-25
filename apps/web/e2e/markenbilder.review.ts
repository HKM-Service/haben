import { expect, type Page } from "@playwright/test";
import { gehe } from "./einrichtung.ts";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

/** Bilder werden sofort gespeichert und müssen auch nach dem Abbrechen der übrigen Profiländerungen aktuell bleiben. */
export async function markenbildNachAbbrechenPruefen(page: Page, kind: "Logo" | "Briefpapier", remove: boolean) {
  const name = `Bildprüfung ${kind} ${remove ? "entfernen" : "hochladen"}`;
  await gehe(page, "/einstellungen?bereich=gestaltung");
  await page.getByRole("button", { name: "Marke anlegen", exact: true }).click();
  const create = page.getByRole("dialog", { name: "Marke anlegen", exact: true });
  await create.getByLabel("Markenname", { exact: true }).fill(name);
  await create.getByRole("button", { name: "Marke speichern", exact: true }).click();
  await expect(create).toBeHidden();

  const edit = page.getByRole("dialog", { name: `${name} bearbeiten`, exact: true });
  async function open() {
    await page.getByRole("button", { name: `${name} bearbeiten`, exact: true }).click();
    await edit.getByText("Logo, Briefpapier und Gestaltung", { exact: true }).click();
  }
  await open();
  const image = edit.getByRole("img", { name: `${kind} dieser Marke`, exact: true });
  await edit.getByLabel(`${kind} der Marke`, { exact: true }).setInputFiles({ name: "markenbild.png", mimeType: "image/png", buffer: png });
  await expect(edit.getByText(`${kind} für diese Marke gespeichert.`, { exact: true })).toBeVisible();
  await expect(image).toBeVisible();
  const imageUrl = new URL((await image.getAttribute("src"))!, page.url());
  imageUrl.searchParams.delete("v");
  expect((await page.request.get(imageUrl.href)).status()).toBe(200);

  if (remove) {
    // Die Ausgangsliste muss das gespeicherte Bild kennen, bevor die Entfernung geprüft wird.
    await edit.getByRole("button", { name: "Marke speichern", exact: true }).click();
    await expect(edit).toBeHidden();
    await open();
    await expect(image).toBeVisible();
    await edit.getByRole("button", { name: "Entfernen", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: `${kind} entfernen?`, exact: true });
    await confirm.getByRole("button", { name: "Entfernen", exact: true }).click();
    await expect(edit.getByText(`${kind} dieser Marke entfernt.`, { exact: true })).toBeVisible();
    await expect(image).toBeHidden();
    expect((await page.request.get(imageUrl.href)).status()).toBe(404);
  }

  await edit.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(edit).toBeHidden();
  // Kein Neuladen und kein Seitenwechsel: Der Dialog muss die gerade gespeicherten Bilddaten kennen.
  await open();
  if (remove) {
    await expect(image).toBeHidden();
    await expect(edit.getByRole("button", { name: `${kind} hochladen`, exact: true })).toBeVisible();
  } else {
    await expect(image).toBeVisible();
    await expect(edit.getByRole("button", { name: "Entfernen", exact: true })).toBeVisible();
  }
  await edit.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(edit).toBeHidden();
}
