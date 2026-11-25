import { expect, type Page } from "@playwright/test";
import { gehe } from "./einrichtung.ts";

/** Die Marke bekommt eigene Fußspalten; die gemeinsame Firmengestaltung bleibt dabei erhalten. */
export async function markenFusszeilePruefen(page: Page) {
  await gehe(page, "/einstellungen?bereich=gestaltung");
  const global = page.getByRole("checkbox", { name: "Eigene Fußzeile", exact: true });
  const globalBefore = await global.isChecked();
  await page.getByRole("button", { name: "HKMcore bearbeiten", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "HKMcore bearbeiten", exact: true });
  await edit.getByText("Logo, Briefpapier und Gestaltung", { exact: true }).click();
  await edit.getByRole("checkbox", { name: "Eigene Fußzeile dieser Marke", exact: true }).check();
  await edit.getByLabel("Fußzeile Spalte 1", { exact: true }).fill("HKMcore\n{firma}\n{email}");
  await edit.getByLabel("Fußzeile Spalte 2", { exact: true }).fill("IBAN {iban}");
  await edit.getByLabel("Fußzeile Spalte 3", { exact: true }).fill("USt-IdNr. {ustid}");
  // Eine vorübergehend kleinere Spaltenzahl darf den Text der ausgeblendeten Spalte nicht verlieren.
  await edit.getByLabel("Fußzeile: Anzahl Spalten", { exact: true }).selectOption("2");
  await expect(edit.getByText(/Steuernummer oder USt-IdNr. fehlt/)).toBeVisible();
  await edit.getByLabel("Fußzeile: Anzahl Spalten", { exact: true }).selectOption("3");
  await expect(edit.getByLabel("Fußzeile Spalte 3", { exact: true })).toHaveValue("USt-IdNr. {ustid}");
  await edit.getByRole("button", { name: "Marke speichern", exact: true }).click();
  await expect(edit).toBeHidden();
  await expect(global).toBeChecked({ checked: globalBefore });
  await page.getByRole("button", { name: "HKMcore bearbeiten", exact: true }).click();
  await edit.getByText("Logo, Briefpapier und Gestaltung", { exact: true }).click();
  await expect(edit.getByRole("checkbox", { name: "Eigene Fußzeile dieser Marke", exact: true })).toBeChecked();
  await expect(edit.getByLabel("Fußzeile Spalte 1", { exact: true })).toHaveValue("HKMcore\n{firma}\n{email}");
  await expect(edit.getByLabel("Fußzeile Spalte 3", { exact: true })).toHaveValue("USt-IdNr. {ustid}");
  await edit.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(edit).toBeHidden();
}
