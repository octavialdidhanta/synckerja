// The catalog a Master Thought is linked to: one required category (services row) plus optional
// sub-categories and features of that category. Relative imports only: the MCP server loads this file.
import type { MasterCatalogContext } from "./types";

export type CatalogOption = { id: string; name: string };

export type LabCatalog = CatalogOption & {
  subCategories: CatalogOption[];
  features: CatalogOption[];
};

export type MasterCatalogLink = {
  serviceId: string | null;
  subServiceIds: string[];
  featureIds: string[];
};

export const EMPTY_CATALOG_LINK: MasterCatalogLink = { serviceId: null, subServiceIds: [], featureIds: [] };

/** Names of the linked category, sub-categories, and features; null until a known category is linked. */
export function catalogContext(link: MasterCatalogLink, catalogs: readonly LabCatalog[]): MasterCatalogContext | null {
  const catalog = catalogs.find((item) => item.id === link.serviceId);
  if (!catalog) return null;
  const names = (options: CatalogOption[], ids: string[]) =>
    options.filter((option) => ids.includes(option.id)).map((option) => option.name);
  return {
    category: catalog.name,
    subCategories: names(catalog.subCategories, link.subServiceIds),
    features: names(catalog.features, link.featureIds),
  };
}

/** Keep only the sub-categories and features that belong to the chosen category. */
export function withCategory(link: MasterCatalogLink, serviceId: string, catalogs: readonly LabCatalog[]): MasterCatalogLink {
  const catalog = catalogs.find((item) => item.id === serviceId);
  const keep = (options: CatalogOption[] | undefined, ids: string[]) =>
    ids.filter((id) => options?.some((option) => option.id === id));
  return {
    serviceId,
    subServiceIds: keep(catalog?.subCategories, link.subServiceIds),
    featureIds: keep(catalog?.features, link.featureIds),
  };
}

export function sameCatalogLink(left: MasterCatalogLink, right: MasterCatalogLink): boolean {
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));
  return left.serviceId === right.serviceId && same(left.subServiceIds, right.subServiceIds) && same(left.featureIds, right.featureIds);
}
