import { expect, type Page, test } from "@playwright/test";
import type { Durchlauf } from "./durchlaeufe.ts";
import { durchlaufSeite } from "./einrichtung.ts";
import { abzugEinspielen } from "./abzug.ts";
import { markenbildNachAbbrechenPruefen } from "./markenbilder.review.ts";
import { markenprofilePruefen } from "./markenprofile.ts";

/**
 * Abschnitt von rechnungen mit eigenem Server und eigener Datenbank (HKMfinz): Markenprofile anlegen, in Rechnung und
 * Angebot wählen, Logo und Briefpapier je Marke. Beginnt mit dem Abzug nach der Einrichtung mit drei Kunden und einer
 * festgeschriebenen Rechnung in rechnungen.spec.ts (e2e/abzug.ts).
 */

const DURCHLAUF = "rechnungen-marken" satisfies Durchlauf;

test.describe.configure({ mode: "serial" });

let page: Page;
let pageErrors: string[] = [];

test.beforeAll(async ({ browser }) => {
  ({ page, pageErrors } = await durchlaufSeite(browser, await abzugEinspielen("rechnungen", DURCHLAUF)));
});

test.afterAll(async () => {
  await page.context().close();
});

test("Markenprofile wählen, Bilder zuordnen und Entwürfe behalten", async ({ request }, testInfo) => {
  expect((await request.get("/api/logo?profile=ungueltig")).status()).toBe(401);
  await markenprofilePruefen(page, testInfo);
});

for (const kind of ["Logo", "Briefpapier"] as const) {
  test(`Markenbilder nach Abbrechen: ${kind} hochladen und erneut bearbeiten`, async () => {
    await markenbildNachAbbrechenPruefen(page, kind, false);
  });
  test(`Markenbilder nach Abbrechen: ${kind} entfernen und erneut bearbeiten`, async () => {
    await markenbildNachAbbrechenPruefen(page, kind, true);
  });
}

test("Keine Fehler im Browser", async () => {
  expect(pageErrors).toEqual([]);
});
