import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import type { KitchenFontSize, KitchenThemeColors } from "../lib/defaultKitchenTheme";
import { isKitchenDisplayMode } from "../lib/kitchenDisplayMode";
import { parseOrderTypeVisibility } from "../lib/parseOrderTypeVisibility";
import {
  parseKitchenFontSize,
  parseKitchenThemeColors,
} from "../lib/parseKitchenThemePrefs";
import { parseKitchenFirePolicyFromRow } from "../lib/parseKitchenFirePolicy";
import {
  DEFAULT_KITCHEN_DISPLAY_MODE,
  DEFAULT_KITCHEN_FONT_SIZE,
  DEFAULT_KITCHEN_THEME_COLORS,
  DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE,
  DEFAULT_ORDER_TYPE_VISIBILITY,
  POS_KITCHEN_OUTLET_SETTINGS_QUERY_KEY,
  type KitchenDisplayMode,
  type KitchenFireBySalesType,
  type KitchenOrderTypeVisibility,
  type PosKitchenOutletSettings,
} from "../lib/posKitchenSettingsTypes";

type Row = {
  id: string;
  organization_id: string;
  outlet_id: string;
  display_mode: string;
  order_type_visibility: unknown;
  font_size?: unknown;
  colors?: unknown;
  kitchen_fire_by_sales_type?: unknown;
};

const SELECT_COLS =
  "id, organization_id, outlet_id, display_mode, order_type_visibility, font_size, colors, kitchen_fire_by_sales_type";

function mapRow(row: Row): PosKitchenOutletSettings {
  return {
    id: row.id,
    organization_id: row.organization_id,
    outlet_id: row.outlet_id,
    display_mode: isKitchenDisplayMode(row.display_mode)
      ? row.display_mode
      : DEFAULT_KITCHEN_DISPLAY_MODE,
    order_type_visibility: parseOrderTypeVisibility(row.order_type_visibility),
    font_size: parseKitchenFontSize(row.font_size),
    colors: parseKitchenThemeColors(row.colors),
    kitchen_fire_by_sales_type: parseKitchenFirePolicyFromRow(
      row.kitchen_fire_by_sales_type,
    ),
  };
}

function emptySettings(
  organizationId: string,
  outletId: string,
): PosKitchenOutletSettings {
  return {
    id: null,
    organization_id: organizationId,
    outlet_id: outletId,
    display_mode: DEFAULT_KITCHEN_DISPLAY_MODE,
    order_type_visibility: { ...DEFAULT_ORDER_TYPE_VISIBILITY },
    font_size: DEFAULT_KITCHEN_FONT_SIZE,
    colors: {
      order_types: { ...DEFAULT_KITCHEN_THEME_COLORS.order_types },
      status: { ...DEFAULT_KITCHEN_THEME_COLORS.status },
    },
    kitchen_fire_by_sales_type: { ...DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE },
  };
}

export function usePosKitchenOutletSettings(outletId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [POS_KITCHEN_OUTLET_SETTINGS_QUERY_KEY, organizationId, outletId],
    enabled: Boolean(organizationId && outletId),
    queryFn: async (): Promise<PosKitchenOutletSettings> => {
      if (!organizationId || !outletId) {
        return emptySettings("", "");
      }

      const { data, error } = await supabase
        .from("pos_kitchen_outlet_settings")
        .select(SELECT_COLS)
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return emptySettings(organizationId, outletId);
      return mapRow(data as Row);
    },
  });

  const save = useMutation({
    mutationFn: async (args: {
      display_mode: KitchenDisplayMode;
      order_type_visibility: KitchenOrderTypeVisibility;
      font_size: KitchenFontSize;
      colors: KitchenThemeColors;
      kitchen_fire_by_sales_type: KitchenFireBySalesType;
    }): Promise<PosKitchenOutletSettings> => {
      if (!organizationId || !outletId) {
        throw new Error("missing_org_or_outlet");
      }

      const payload = {
        organization_id: organizationId,
        outlet_id: outletId,
        display_mode: args.display_mode,
        order_type_visibility: args.order_type_visibility,
        font_size: args.font_size,
        colors: args.colors,
        kitchen_fire_by_sales_type: args.kitchen_fire_by_sales_type,
      };

      const { data, error } = await supabase
        .from("pos_kitchen_outlet_settings")
        .upsert(payload, { onConflict: "organization_id,outlet_id" })
        .select(SELECT_COLS)
        .single();

      if (error) throw error;
      return mapRow(data as Row);
    },
    onSuccess: (row) => {
      queryClient.setQueryData(
        [POS_KITCHEN_OUTLET_SETTINGS_QUERY_KEY, organizationId, outletId],
        row,
      );
    },
  });

  return { ...query, save };
}
