import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

/*
 * HKM finanz: Das maskierbare Icon des Web-App-Manifests ist das App-Icon aus dem HKM-Logo-System, dessen Bogen und
 * Kürzel für den runden Schutzbereich ausgelegt sind. Android und andere Plattformen schneiden ein Icon mit „purpose“
 * „maskable“ auf eine Form zu; sichtbar bleibt sicher nur ein Kreis um die Mitte mit 40 % der Kantenlänge als Radius,
 * und die Fläche bis in die Ecken muss deckend sein.
 * Quelle: W3C Web Application Manifest, Abschnitt „Icon masks“ (https://www.w3.org/TR/appmanifest/#icon-masks).
 */

const SAFE_ZONE_RADIUS = 0.4;
/** Bytes je Pixel nach PNG-Farbtyp: 2 = RGB, 6 = RGBA */
const BYTES_PER_PIXEL: Record<number, number> = { 2: 3, 6: 4 };
const publicFile = (path: string) => new URL(`../../public/${path}`, import.meta.url);

interface Bitmap {
  width: number;
  height: number;
  /** RGBA je Pixel, Zeile für Zeile */
  pixels: Uint8Array;
}

/** Vorhersage nach Paeth (PNG, Filtertyp 4) */
function paeth(left: number, up: number, upLeft: number): number {
  const p = left + up - upLeft;
  const [pa, pb, pc] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - upLeft)];
  return pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
}

/** Eine Zeile nach ihrem Filtertyp zurückrechnen (PNG-Spezifikation, Abschnitt 9.2) */
function unfilter(filter: number, line: Uint8Array, previous: Uint8Array, bpp: number): void {
  for (let x = 0; x < line.length; x++) {
    const left = x >= bpp ? line[x - bpp]! : 0;
    const up = previous[x]!;
    const upLeft = x >= bpp ? previous[x - bpp]! : 0;
    const add = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter];
    if (add === undefined) throw new Error(`PNG-Filter ${filter} unbekannt`);
    line[x] = (line[x]! + add) & 0xff;
  }
}

/** Liest ein PNG mit 8 Bit je Kanal, RGB oder RGBA, ohne Interlacing; genug für die Icons aus dem Logo-Generator */
function readPng(data: Uint8Array): Bitmap {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const chunks: Uint8Array[] = [];
  let width = 0;
  let height = 0;
  let colorType = 0;
  for (let offset = 8; offset < data.length; ) {
    const length = view.getUint32(offset);
    const type = new TextDecoder().decode(data.subarray(offset + 4, offset + 8));
    const body = data.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      expect([body[8], body[12]], "8 Bit je Kanal, ohne Interlacing").toEqual([8, 0]);
      colorType = body[9]!;
    }
    if (type === "IDAT") chunks.push(body);
    offset += 12 + length;
  }
  const bpp = BYTES_PER_PIXEL[colorType];
  if (!bpp) throw new Error(`PNG-Farbtyp ${colorType} nicht unterstützt`);
  const raw = inflateSync(Buffer.concat(chunks));
  const pixels = new Uint8Array(width * height * 4);
  let previous = new Uint8Array(width * bpp);
  for (let y = 0; y < height; y++) {
    const start = y * (width * bpp + 1);
    const line = Uint8Array.from(raw.subarray(start + 1, start + 1 + width * bpp));
    unfilter(raw[start]!, line, previous, bpp);
    for (let x = 0; x < width; x++) {
      pixels.set([line[x * bpp]!, line[x * bpp + 1]!, line[x * bpp + 2]!, bpp === 4 ? line[x * bpp + 3]! : 0xff], (y * width + x) * 4);
    }
    previous = line;
  }
  return { width, height, pixels };
}

const pixel = (bitmap: Bitmap, x: number, y: number) => [...bitmap.pixels.subarray((y * bitmap.width + x) * 4, (y * bitmap.width + x + 1) * 4)];

/** Größter Abstand eines Pixels des Zeichens zur Mitte, als Anteil der Kante; Zeichen ist, was deutlich vom Hintergrund abweicht */
function markRadius(bitmap: Bitmap): number {
  const background = pixel(bitmap, 0, 0);
  let radius = 0;
  for (let y = 0; y < bitmap.height; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      const differs = pixel(bitmap, x, y).some((value, channel) => Math.abs(value - background[channel]!) > 32);
      if (differs) radius = Math.max(radius, Math.hypot(x + 0.5 - bitmap.width / 2, y + 0.5 - bitmap.height / 2));
    }
  }
  return radius / bitmap.width;
}

describe("Maskierbares Icon im Web-App-Manifest", () => {
  const manifest = JSON.parse(readFileSync(publicFile("manifest.webmanifest"), "utf8")) as { icons: { src: string; purpose?: string }[] };
  const maskable = manifest.icons.filter((icon) => icon.purpose?.split(" ").includes("maskable"));

  it("nennt ein maskierbares Icon", () => {
    expect(maskable.map((icon) => icon.src)).toEqual(["/icon-maskable-512.png"]);
  });

  it.each(maskable.map((icon) => icon.src))("%s ist bis in die Ecken deckend, das Zeichen liegt im Schutzbereich", (src) => {
    const bitmap = readPng(readFileSync(publicFile(src.slice(1))));
    const { width, height } = bitmap;
    expect(width).toBe(height);
    for (const [x, y] of [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
    ] as const) {
      expect(pixel(bitmap, x, y)[3], `Ecke ${x},${y}`).toBe(0xff);
    }
    const radius = markRadius(bitmap);
    // Ein Zeichen gibt es, und es bleibt im Kreis; mit dem Logo-System heute rund 28 %
    expect(radius).toBeGreaterThan(0.1);
    expect(radius).toBeLessThanOrEqual(SAFE_ZONE_RADIUS);
  });
});
