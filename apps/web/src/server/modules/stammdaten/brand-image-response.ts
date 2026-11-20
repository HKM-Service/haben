import { z } from "zod";
import { fileResponse } from "../../file-response.ts";
import { brandImage, type BrandImageKind } from "./brand-assets.ts";
import { BrandProfileError } from "./brand-profiles.ts";

/** Die aufrufende API-Route prüft zuerst die Inhaber-Sitzung. */
export async function brandImageResponse(profileId: string, kind: BrandImageKind): Promise<Response> {
  const parsed = z.uuid().safeParse(profileId);
  if (!parsed.success) return new Response("Ungültiges Markenprofil", { status: 400 });
  try {
    const image = await brandImage(parsed.data, kind);
    if (!image) return new Response("Kein Bild hinterlegt", { status: 404 });
    return fileResponse(
      image.data,
      {
        mimeType: image.format === "png" ? "image/png" : "image/jpeg",
        filename: `${kind}.${image.format}`,
      },
      false,
    );
  } catch (error) {
    if (error instanceof BrandProfileError) return new Response("Markenprofil nicht gefunden", { status: 404 });
    throw error;
  }
}
