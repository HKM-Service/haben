---
title: "Entscheidung: Markenprofile der HKM Service GmbH"
description: >-
  Bestätigte Anforderung für HKMfinz: mehrere Marken mit auswählbarem Briefpapier innerhalb einer gemeinsamen GmbH-Buchhaltung.
---

# Entscheidung: Markenprofile der HKM Service GmbH

**Status:** fachlich von Boris bestätigt; Umsetzung im Arbeitsbranch begonnen, Migration und Abnahme noch offen.

Die HKM Service GmbH betreibt mehrere Marken. Beim Erstellen einer Rechnung muss die passende
Marke mit ihrem Briefpapier auswählbar sein. Diese Funktion ist Voraussetzung für die Ablösung
von sevDesk.

Die erste Marke heißt **HKMcore**. Logo, Briefpapier und Farbgestaltung liefert bzw. pflegt Boris
später. Die Erweiterung muss sich zunächst allein mit einem Markennamen einrichten lassen.

## Gemeinsame Firmendaten

Alle Marken gehören zur selben GmbH. Rechtlicher Rechnungsaussteller bleibt die HKM Service GmbH.
Rechtsform, Registerangaben, Steuernummer, USt-IdNr., Kontenrahmen und Versteuerungsart kommen aus
den zentralen Firmendaten. Die Marken verwenden eine gemeinsame Buchhaltung und die bestehende
Rechnungsnummernvergabe.

## Inhalt eines Markenprofils

- Markenname zugleich als Name in der Profilauswahl.
- Eigenes Logo, Briefpapier und Gestaltung einschließlich Fußzeile und Standardtexten.
- Kontaktdaten der Marke: E-Mail, Telefon und Website.
- Bankverbindung aus den angelegten Konten der GmbH.

Die Pflichtangaben der GmbH bleiben im Dokument enthalten. Ein Profil kann als Standard für neue
Entwürfe gewählt und später deaktiviert werden; bereits verwendete Profile bleiben zuordenbar.
Logo und Briefpapier sind optional und können nach dem Anlegen ergänzt werden.

## Auswahl und Dokumente

Im Rechnungsentwurf steht eine beschriftete Auswahl **Marke / Rechnungsprofil**. Die gewählte
Marke ist erkennbar; die Vorschau verwendet ihr Briefpapier und ihre Daten. Der Wechsel behält
Kunde, Positionen und Preise des Entwurfs.

Angebote erhalten dieselbe Auswahl. Beim Übernehmen eines Angebots in eine Rechnung wird die
Marke übernommen. Mahnungen und Stornobelege behalten die Markenzuordnung der ursprünglichen
Rechnung. Bestehende Regeln für Buchung, Pflichtangaben und Korrekturen gelten weiterhin.

Beim Festschreiben werden die verwendeten Absenderdaten und das erzeugte Dokument erhalten.
Spätere Änderungen an Profil, Logo oder Briefpapier verändern eine bereits festgeschriebene
Rechnung nicht. Die Angaben zum Rechnungsaussteller stimmen in PDF und E-Rechnung überein.

## Abnahme vor dem Wechsel von sevDesk

1. Zwei unterschiedlich gestaltete Markenprofile anlegen und im Rechnungsentwurf wechseln.
2. Je Profil ein PDF prüfen: richtiges Briefpapier und richtige Kontaktdaten, gleiche GmbH-Pflichtangaben.
3. ZUGFeRD und XRechnung auf den richtigen rechtlichen Rechnungsaussteller prüfen.
4. Eine Rechnung festschreiben, das Profil ändern und das unveränderte Original erneut abrufen.
5. Angebot in Rechnung übernehmen sowie Mahnung und Storno mit der zugehörigen Marke prüfen.
6. Vorhandene Entwürfe, Rechnungen und die Standardgestaltung nach der Erweiterung prüfen.

## Vorhandene Grundlage

Haben 0.11.0 speichert bereits ein Standardprofil für die Beleggestaltung. Logo und Briefpapier
werden bislang gemeinsam für die Installation geladen. Die Auswahl mehrerer Markenprofile ist
eine Erweiterung dieser Struktur; sie ist im Pilot noch nicht verfügbar.

Der zugehörige Vorschlag im Originalprojekt ist
[Marken- und Rechnungsprofile, Issue 245](https://github.com/Speicherstadt/haben/issues/245).
