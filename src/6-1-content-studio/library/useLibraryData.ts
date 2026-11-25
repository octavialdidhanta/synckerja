import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { signCatalogProductPhotos } from "@/8-2-1-default-prices/lib/catalogProductPhoto";
import { isMissingRelationError, readAll, readAllOptional, signCatalogMedia } from "../shared/catalogQuery";
import {
  buildLocations,
  buildMenus,
  type CatalogSource,
  type LocationItem,
  type LocationPhotoRow,
  type LocationRow,
  type LocationSectionRow,
  type MenuFieldRow,
  type MenuItem,
  type MenuPhotoRow,
  type MenuRow,
  type OrgMenuFieldDef,
} from "./libraryData";

export interface LibraryData {
  menus: MenuItem[];
  locations: LocationItem[];
  photos: Record<string, string>;
  menuFieldDefs: OrgMenuFieldDef[];
  industryTemplateCode: string | null;
  sources: CatalogSource[];
}

const MENU_COLUMNS = "id,external_id,name,aliases,created_at,default_price_id,feature_id";

/** Source columns arrive with the link migration. Until then every product is typed by hand. */
async function readMenus(org: string): Promise<MenuRow[]> {
  try {
    return await readAll<MenuRow>(supabase, "catalog_menus", MENU_COLUMNS, org);
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
    return readAll<MenuRow>(supabase, "catalog_menus", "id,external_id,name,aliases,created_at", org);
  }
}

async function readTemplateCode(org: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("organization_catalog_settings")
    .select("industry_template_code")
    .eq("organization_id", org)
    .maybeSingle();
  if (error) {
    if (isMissingRelationError(error)) return null;
    throw error;
  }
  return data?.industry_template_code ?? null;
}

async function readSources(org: string, template: string | null): Promise<CatalogSource[]> {
  if (template === "fnb") {
    const { data, error } = await supabase
      .from("default_prices")
      .select("id,name,photo_path")
      .eq("organization_id", org)
      .eq("kind", "product");
    if (error) {
      if (isMissingRelationError(error)) return [];
      throw error;
    }
    return (data ?? []).flatMap((row) => {
      const name = (row.name ?? "").trim();
      if (!name) return [];
      return [{ id: row.id, name, photoPath: row.photo_path ?? null }];
    });
  }
  if (template === "software") {
    const { data, error } = await supabase
      .from("product_knowledge_features")
      .select("id,feature_name")
      .eq("organization_id", org);
    if (error) {
      if (isMissingRelationError(error)) return [];
      throw error;
    }
    return (data ?? []).flatMap((row) => {
      const name = row.feature_name.trim();
      if (!name) return [];
      return [{ id: row.id, name, photoPath: null }];
    });
  }
  return [];
}

/** `label` arrives with the catalog migration. Until then the title stands in for it. */
async function readLocations(org: string): Promise<LocationRow[]> {
  try {
    return await readAll<LocationRow>(supabase, "catalog_locations", "id,external_id,name,label,created_at", org);
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
    return readAll<LocationRow>(supabase, "catalog_locations", "id,external_id,name,created_at", org);
  }
}

export function useLibraryData() {
  const { organizationId } = useOrgBootstrapPending();
  return useQuery<LibraryData>({
    queryKey: ["content-studio", "library", organizationId],
    enabled: Boolean(organizationId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const org = organizationId as string;
      const live = (q: { is: (c: string, v: null) => unknown }) => q.is("deleted_at", null);
      const template = await readTemplateCode(org);
      const [menuRows, fields, menuPhotos, locs, locPhotos, sections, menuFieldDefs, sources] = await Promise.all([
        readMenus(org),
        readAll<MenuFieldRow>(supabase, "catalog_menu_fields", "id,menu_id,field_key,body,position", org),
        readAll<MenuPhotoRow>(supabase, "catalog_menu_photos", "id,menu_id,file_path,label,storage_path,ref,position", org, live),
        readLocations(org),
        readAll<LocationPhotoRow>(
          supabase,
          "catalog_location_photos",
          "id,location_id,file_path,label,storage_path,ref,description,areas,position",
          org,
          live,
        ),
        readAll<LocationSectionRow>(supabase, "catalog_location_sections", "id,location_id,title,body,areas,position", org),
        // Optional until industry-template migration is deployed.
        readAllOptional<OrgMenuFieldDef>(supabase, "catalog_menu_field_defs", "id,field_key,label,position", org),
        readSources(org, template),
      ]);
      const paths = [...menuPhotos, ...locPhotos].map((p) => p.storage_path).filter((p): p is string => Boolean(p));
      const [photos, sourcePhotos] = await Promise.all([
        signCatalogMedia(supabase, paths),
        signCatalogProductPhotos(sources.map((source) => source.photoPath ?? "")),
      ]);
      const menus = buildMenus(menuRows, fields, menuPhotos).map((menu) => {
        const source = sources.find((item) => item.id === menu.defaultPriceId);
        return { ...menu, sourcePhotoUrl: source?.photoPath ? (sourcePhotos.get(source.photoPath) ?? null) : null };
      });
      return {
        menus,
        locations: buildLocations(locs, locPhotos, sections),
        photos,
        menuFieldDefs,
        industryTemplateCode: template,
        sources,
      };
    },
  });
}
