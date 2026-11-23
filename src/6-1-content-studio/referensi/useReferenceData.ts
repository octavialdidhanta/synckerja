import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { readAll, signCatalogMedia } from "../shared/catalogQuery";
import { parseReference, type Reference } from "./referenceData";

export interface ReferenceData {
  refs: Reference[];
  /** signed URLs of reference images, keyed by storage path */
  images: Record<string, string>;
}

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export function useReferenceData() {
  const { organizationId } = useOrgBootstrapPending();
  return useQuery<ReferenceData>({
    queryKey: ["content-studio", "references", organizationId],
    enabled: Boolean(organizationId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const rows = await readAll<{ external_id: string; document: Record<string, unknown> }>(
        supabase,
        "catalog_references",
        "id,external_id,document",
        organizationId as string,
      );
      const refs = rows.sort((a, b) => natural(a.external_id, b.external_id)).map((r) => parseReference(r.external_id, r.document));
      const paths = refs.flatMap((r) => [
        ...r.beats.map((b) => b.thumbPath),
        ...r.mg.flatMap((m) => [m.thumbPath, m.samplePath]),
      ]);
      const images = await signCatalogMedia(supabase, paths.filter((p): p is string => Boolean(p)));
      return { refs, images };
    },
  });
}
