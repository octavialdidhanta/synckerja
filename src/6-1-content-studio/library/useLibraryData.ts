import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { readAll, signCatalogMedia } from "../shared/catalogQuery";
import {
  buildLocations,
  buildMenus,
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
      const [menus, fields, menuPhotos, locs, locPhotos, sections, menuFieldDefs] = await Promise.all([
        readAll<MenuRow>(supabase, "catalog_menus", "id,external_id,name,aliases,created_at", org),
        readAll<MenuFieldRow>(supabase, "catalog_menu_fields", "id,menu_id,field_key,body,position", org),
        readAll<MenuPhotoRow>(supabase, "catalog_menu_photos", "id,menu_id,file_path,label,storage_path,ref,position", org, live),
        readAll<LocationRow>(supabase, "catalog_locations", "id,external_id,name,created_at", org),
        readAll<LocationPhotoRow>(
          supabase,
          "catalog_location_photos",
          "id,location_id,file_path,label,storage_path,ref,description,areas,position",
          org,
          live,
        ),
        readAll<LocationSectionRow>(supabase, "catalog_location_sections", "id,location_id,title,body,areas,position", org),
        readAll<OrgMenuFieldDef>(supabase, "catalog_menu_field_defs", "id,field_key,label,position", org),
      ]);
      const paths = [...menuPhotos, ...locPhotos].map((p) => p.storage_path).filter((p): p is string => Boolean(p));
      const photos = await signCatalogMedia(supabase, paths);
      return {
        menus: buildMenus(menus, fields, menuPhotos),
        locations: buildLocations(locs, locPhotos, sections),
        photos,
        menuFieldDefs,
      };
    },
  });
}
