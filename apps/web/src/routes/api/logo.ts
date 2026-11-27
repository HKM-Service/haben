import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "../../server/rollen.ts";
import { fileResponse } from "../../server/file-response.ts";
import { brandImageResponse, loadLogo } from "../../server/modules/stammdaten/index.ts";

/** Firmenlogo für Vorschau und Einstellungen */
export const Route = createFileRoute("/api/logo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await requireUser(request, "inhaber");
        if (user instanceof Response) return user;
        const profileId = new URL(request.url).searchParams.get("profile");
        if (profileId !== null) return brandImageResponse(profileId, "logo");
        const logo = await loadLogo();
        if (!logo) return new Response("Kein Logo", { status: 404 });
        return fileResponse(logo.data, { mimeType: logo.format === "png" ? "image/png" : "image/jpeg", filename: `logo.${logo.format}` }, false);
      },
    },
  },
});
