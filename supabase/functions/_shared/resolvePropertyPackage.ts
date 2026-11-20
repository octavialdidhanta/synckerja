import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type ResolvedPropertyPackage = {
  id: string;
  package_label: string;
  badge_label: string;
  /** property_packages.title — card headline (not leads.title). */
  card_title: string;
  slug: string;
};

/** CRM title: badge_label → card title → Kontak — webId. */
export function buildLeadTitleFromPackage(
  resolved: ResolvedPropertyPackage | null,
  webId: string,
): string {
  if (!resolved) return `Kontak — ${webId}`;
  const badge = resolved.badge_label.trim();
  if (badge) return badge;
  const cardTitle = resolved.card_title.trim();
  if (cardTitle) return cardTitle;
  return `Kontak — ${webId}`;
}

/** Lookup canonical package row for hub submit (any publish state; scoped by web_id). */
export async function resolvePropertyPackage(args: {
  admin: SupabaseClient;
  webId: string;
  propertyPackageId: string | null | undefined;
}): Promise<ResolvedPropertyPackage | null> {
  const id = typeof args.propertyPackageId === "string" ? args.propertyPackageId.trim() : "";
  if (!id) return null;

  const { data, error } = await args.admin
    .from("property_packages")
    .select("id, package_label, badge_label, title, slug")
    .eq("id", id)
    .eq("web_id", args.webId)
    .maybeSingle();

  if (error || !data?.id) return null;

  const label = typeof data.package_label === "string" ? data.package_label.trim() : "";
  if (!label) return null;

  return {
    id: String(data.id),
    package_label: label,
    badge_label: typeof data.badge_label === "string" ? data.badge_label : "",
    card_title: typeof data.title === "string" ? data.title : "",
    slug: String(data.slug ?? ""),
  };
}
