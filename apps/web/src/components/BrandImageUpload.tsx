import { MAX_LOGO_BYTES } from "@haben/core";
import { useServerFn } from "@tanstack/react-start";
import { getBrandProfiles, removeBrandImage, uploadBrandImage } from "../server/functions/brand-profiles.ts";
import { ImageUpload } from "./ImageUpload.tsx";

export function BrandImageUpload({ id, kind, hash }: { id: string; kind: "logo" | "background"; hash: string | null }) {
  const upload = useServerFn(uploadBrandImage);
  const remove = useServerFn(removeBrandImage);
  const load = useServerFn(getBrandProfiles);
  const name = kind === "logo" ? "Logo" : "Briefpapier";
  return (
    <ImageUpload
      sha256={hash}
      url={`/api/${kind === "logo" ? "logo" : "briefpapier"}?profile=${id}`}
      maxBytes={kind === "logo" ? MAX_LOGO_BYTES : 2 * 1024 * 1024}
      accept={kind === "logo" ? "image/png,image/jpeg" : "image/png,image/jpeg,application/pdf"}
      texts={{
        name,
        empty: `Noch kein ${name}.`,
        alt: `${name} dieser Marke`,
        fileLabel: `${name} der Marke`,
        upload: `${name} hochladen`,
        replace: `Anderes ${name} wählen`,
        saved: `${name} für diese Marke gespeichert.`,
        removed: `${name} dieser Marke entfernt.`,
        removeConsequence: "Neue Belege dieser Marke verwenden das Bild nicht mehr. Festgeschriebene Belege behalten ihr PDF.",
        tooBig: `${name} darf höchstens ${kind === "logo" ? 1 : 2} MB groß sein.`,
      }}
      upload={({ data }) => upload({ data: { ...data, id, kind } })}
      remove={() => remove({ data: { id, kind } })}
      load={async () => {
        const row = (await load()).profiles.find((profile) => profile.id === id);
        const sha256 = kind === "logo" ? row?.logoHash : row?.backgroundHash;
        return sha256 ? { sha256 } : null;
      }}
    />
  );
}
