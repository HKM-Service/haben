import { BrandProfileError, brandSeller, listBrandProfiles } from "./brand-profiles.ts";
import { type Company, sellerIssues } from "./company.ts";
import { sellerFrom } from "./seller.ts";

/** Der Editor zeigt für jede auswählbare Marke die tatsächlich wirksamen Pflichtangaben. */
export async function editorBrandProfiles(company: Company) {
  const seller = sellerFrom(company);
  return Promise.all(
    (await listBrandProfiles()).map(async (profile) => {
      try {
        return { ...profile, sellerIssues: sellerIssues(await brandSeller(seller, profile)) };
      } catch (error) {
        if (!(error instanceof BrandProfileError)) throw error;
        return { ...profile, sellerIssues: [error.message] };
      }
    }),
  );
}

export type EditorBrandProfile = Awaited<ReturnType<typeof editorBrandProfiles>>[number];
