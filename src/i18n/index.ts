import { en } from "./en";

/*
 * Translation: the German text lives directly in the code and doubles as the key;
 * `en.ts` provides the English version. Missing entries stay German.
 * Placeholders: t("vor {n} Min.", { n: 5 }).
 *
 * No hook needed: the notch subscribes to the settings and re-renders the whole tree
 * when the language changes. Send module-level constants (label lists) through t()
 * only at render time, otherwise they stay in the startup language.
 */
export type Language = "de" | "en";

export function lang(): Language {
  return "en";
}

export function t(de: string, vars?: Record<string, string | number>): string {
  let s = en[de] ?? de;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** Locale for Intl (numbers, dates, weekdays). */
export function locale(): string {
  return "en-US";
}

/** Error texts from Rust (AI chat, converter) arrive in German; translate them by pattern. */
const backendPatterns: [RegExp, string][] = [
  [/^Kein Modell eingetragen$/, "No model set"],
  [/^Base-URL muss mit https:\/\/ beginnen$/, "Base URL must start with https://"],
  [/^Unbekannter Anbieter: (.*)$/, "Unknown provider: $1"],
  [/^Schlüssel abgelehnt \((\d+)\) – (.*)$/s, "Key rejected ($1) – $2"],
  [/^Nicht gefunden \(404\) – Base-URL oder Modell prüfen\. (.*)$/s, "Not found (404) – check base URL or model. $1"],
  [/^Limit erreicht \(429\) – kurz warten$/, "Rate limit reached (429) – wait a moment"],
  [/^Fehler (\d+): (.*)$/s, "Error $1: $2"],
  [/^Datei nicht mehr vorhanden$/, "File no longer exists"],
  [/^Dateien nicht mehr vorhanden$/, "Files no longer exist"],
  [/^Ist schon in diesem Format$/, "Already in this format"],
  [/^Format wird nicht unterstützt$/, "Format not supported"],
  [/^Kann nicht speichern: (.*)$/s, "Cannot save: $1"],
  [/^Zielformat für Bilder nicht verfügbar$/, "Target format not available for images"],
  [/^Zielformat für Audio\/Video nicht verfügbar$/, "Target format not available for audio/video"],
  [/^Zielformat für Dokumente nicht verfügbar$/, "Target format not available for documents"],
  [/^Zielformat für Tabellen nicht verfügbar$/, "Target format not available for spreadsheets"],
  [/^Datei nicht lesbar: (.*)$/s, "Cannot read file: $1"],
  [/^PDF-Text nicht lesbar \(evtl\. nur Bilder\/Scan\)$/, "Cannot read PDF text (maybe only images/scan)"],
  [/^Keine gültige DOCX-Datei$/, "Not a valid DOCX file"],
  [/^DOCX-Inhalt nicht lesbar$/, "Cannot read DOCX content"],
  [/^Tabelle nicht lesbar$/, "Cannot read spreadsheet"],
  [/^Tabelle hat kein Blatt$/, "Spreadsheet has no sheet"],
  [/^Tabelle ist leer$/, "Spreadsheet is empty"],
  [/^CSV nicht lesbar$/, "Cannot read CSV"],
  [/^Für PDF wird Microsoft Edge oder Chrome benötigt$/, "PDF needs Microsoft Edge or Chrome"],
  [/^PDF konnte nicht erstellt werden$/, "PDF could not be created"],
  [/^PDF-Druck startet nicht: (.*)$/s, "PDF printing failed to start: $1"],
  [/^Umwandlung fehlgeschlagen: (.*)$/s, "Conversion failed: $1"],
  [/^ffmpeg startet nicht: (.*)$/s, "ffmpeg won't start: $1"],
  [/^Client-Secret fehlt$/, "Client secret missing"],
  [/^Eintrag nicht gefunden$/, "Entry not found"],
  [/^Bild nicht lesbar$/, "Cannot read image"],
  [/^Kein Bild in diesem Eintrag$/, "No image in this entry"],
  [/^Nur für Bilder$/, "Images only"],
  [/^Bild zu groß für Texterkennung$/, "Image too large for text recognition"],
  [/^OCR-Sprachpaket fehlt für (.*)$/, "OCR language pack missing for $1"],
  [/^Kein Text erkannt$/, "No text recognized"],
  [/^Texterkennung nicht verfügbar \(OCR-Sprachpaket fehlt\)$/, "Text recognition unavailable (OCR language pack missing)"],
  [/^Energieschema nicht lesbar \((.*)\)$/, "Cannot read power scheme ($1)"],
  [/^Helligkeit nicht lesbar \((.*)\)$/, "Cannot read brightness ($1)"],
  [/^Helligkeit ließ sich nicht setzen \((.*)\)$/, "Could not set brightness ($1)"],
  [/^Helligkeit ließ sich nicht übernehmen \((.*)\)$/, "Could not apply brightness ($1)"],
  [/^Energie sparen abgebrochen$/, "Sleep cancelled"],
  [/^Gerät nicht mehr gekoppelt$/, "Device no longer paired"],
  [/^Verbinden fehlgeschlagen \((.*)\)$/, "Connection failed ($1)"],
  [/^Bluetooth-Einstellungen ließen sich nicht öffnen$/, "Could not open Bluetooth settings"],
  [/^Keine Verbindung$/, "No connection"],
  [/^Keine Verbindung: (.*)$/s, "No connection: $1"],
  [/^Bild konnte nicht gelesen werden$/, "Cannot read image"],
  [/^Kein Token$/, "No token received"],
  [/^Kein Code$/, "No code received"],
  [/^Token abgelehnt$/, "Token rejected"],
  [/^Abgelehnt$/, "Declined"],
  [/^Im Portal http:\/\/localhost als Redirect eintragen$/, "Add http://localhost as a redirect in the developer portal"],
];

export function tBackend(msg: string): string {
  if (lang() !== "en") return msg;
  for (const [re, en] of backendPatterns) if (re.test(msg)) return msg.replace(re, en);
  return msg;
}
