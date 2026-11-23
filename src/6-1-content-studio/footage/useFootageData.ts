import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { readAll as readAllFrom, signCatalogMedia } from "../shared/catalogQuery";
import {
  buildFootageRows,
  type AssetRecord,
  type BanRecord,
  type FootageData,
  type MenuRecord,
  type SceneRecord,
  type TagDefRecord,
  type TagValueRecord,
  type UsageRecord,
} from "./footageRows";

const readAll = <T,>(table: string, columns: string, orgId: string, extra?: Parameters<typeof readAllFrom>[4]) =>
  readAllFrom<T>(supabase, table, columns, orgId, extra);

export interface FootageQueryResult extends FootageData {
  thumbs: Record<string, string>;
}

export function footageQueryKey(orgId: string | null | undefined) {
  return ["content-studio", "footage", orgId] as const;
}

export function useFootageData() {
  const { organizationId } = useOrgBootstrapPending();
  return useQuery<FootageQueryResult>({
    queryKey: footageQueryKey(organizationId),
    enabled: Boolean(organizationId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const org = organizationId as string;
      const [assets, scenes, tagDefs, tagValues, usages, bans, menus] = await Promise.all([
        readAll<AssetRecord>(
          "footage_assets",
          "id,file_key,media_type,location_label,product_label,summary,storage_status,duration_seconds",
          org,
          (q) => q.is("deleted_at", null),
        ),
        readAll<SceneRecord>(
          "footage_scenes",
          "id,asset_id,start_seconds,end_seconds,scene_kind,summary,note,thumb_storage_path",
          org,
        ),
        readAll<TagDefRecord>("footage_tag_defs", "id,key,label,value_type,position", org),
        readAll<TagValueRecord>("footage_tag_values", "id,tag_def_id,asset_id,scene_id,value_bool,value_text", org),
        readAll<UsageRecord>("footage_usages", "id,asset_id,scene_id,in_seconds,out_seconds,external_ref,social_media_plan_id", org),
        readAll<BanRecord>("footage_bans", "id,scene_id,reason", org),
        readAll<MenuRecord & { created_at: string }>("catalog_menus", "id,name,aliases,created_at", org),
      ]);
      menus.sort((x, y) => x.created_at.localeCompare(y.created_at));
      const data = buildFootageRows({ assets, scenes, tagDefs, tagValues, usages, bans, menus });
      const paths = [...new Set(data.rows.map((r) => r.thumbPath).filter((p): p is string => Boolean(p)))];
      const thumbs = await signCatalogMedia(supabase, paths);
      return { ...data, thumbs };
    },
  });
}
