import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { normalizeModifierLimit } from "../lib/modifierLimit";
import type {
  CatalogModifierGroup,
  CatalogModifierGroupSave,
  CatalogModifierOption,
} from "../types";

const QUERY_KEY = "catalog-modifier-groups";

type OptionRow = CatalogModifierOption & {
  catalog_modifier_option_ingredients?: Array<{
    ingredient_id: string;
    quantity: number | string;
  }> | null;
};

type GroupRow = Omit<CatalogModifierGroup, "options" | "product_ids" | "outlet_ids"> & {
  catalog_modifier_options?: OptionRow[] | null;
  catalog_product_modifiers?: Array<{ product_id: string }> | null;
  catalog_modifier_outlets?: Array<{ outlet_id: string }> | null;
};

function mapOption(opt: OptionRow): CatalogModifierOption {
  const stock = (opt.catalog_modifier_option_ingredients ?? [])[0];
  const qty = stock != null ? Number(stock.quantity) : NaN;
  const {
    catalog_modifier_option_ingredients: _stock,
    ...rest
  } = opt;
  return {
    ...rest,
    extra_price: Number(opt.extra_price) || 0,
    stock_ingredient_id: stock?.ingredient_id ?? null,
    stock_quantity: Number.isFinite(qty) && qty > 0 ? qty : null,
  };
}

function mapGroup(row: GroupRow): CatalogModifierGroup {
  const options = (row.catalog_modifier_options ?? [])
    .filter((opt) => opt.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map(mapOption);
  const {
    catalog_modifier_options: _opts,
    catalog_product_modifiers: links,
    catalog_modifier_outlets: outletLinks,
    ...rest
  } = row;
  return {
    ...rest,
    min_selected: Number(rest.min_selected) || 0,
    max_selected: Math.max(1, Number(rest.max_selected) || 1),
    options,
    product_ids: (links ?? []).map((link) => link.product_id),
    outlet_ids: (outletLinks ?? []).map((link) => link.outlet_id),
  };
}

async function syncOptionIngredient(args: {
  organizationId: string;
  optionId: string;
  ingredientId: string | null | undefined;
  quantity: number | null | undefined;
}) {
  const qty =
    args.quantity != null && Number.isFinite(args.quantity) && args.quantity > 0
      ? args.quantity
      : null;
  const ingredientId = args.ingredientId?.trim() || null;

  if (!ingredientId || qty == null) {
    const { error } = await supabase
      .from("catalog_modifier_option_ingredients")
      .delete()
      .eq("option_id", args.optionId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("catalog_modifier_option_ingredients").upsert(
    {
      organization_id: args.organizationId,
      option_id: args.optionId,
      ingredient_id: ingredientId,
      quantity: qty,
    },
    { onConflict: "option_id" },
  );
  if (error) throw error;
}

export function useCatalogModifierGroups() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [QUERY_KEY, organizationId],
    queryFn: async (): Promise<CatalogModifierGroup[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("catalog_modifier_groups")
        .select(
          "id, organization_id, name, sort_order, is_active, limit_enabled, is_required, min_selected, max_selected, stock_enabled, catalog_modifier_options(id, group_id, organization_id, name, extra_price, sort_order, is_active, inventory_sku_id, catalog_modifier_option_ingredients(ingredient_id, quantity)), catalog_product_modifiers(product_id), catalog_modifier_outlets(outlet_id)",
        )
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as GroupRow[]).map(mapGroup);
    },
    enabled: !!organizationId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY, organizationId] });
  };

  const save = useMutation({
    mutationFn: async (payload: CatalogModifierGroupSave) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const name = payload.name.trim();
      if (!name) throw new Error("modifier_name_required");
      const uniqueOutletIds = Array.from(new Set(payload.outlet_ids.filter(Boolean)));
      if (uniqueOutletIds.length < 1) throw new Error("modifier_outlets_min");
      const options = payload.options
        .map((opt) => ({ ...opt, name: opt.name.trim() }))
        .filter((opt) => opt.name);
      if (options.length === 0) throw new Error("modifier_options_required");

      const limit = normalizeModifierLimit({
        limitEnabled: payload.limit_enabled,
        isRequired: payload.is_required,
        minSelected: payload.min_selected,
        maxSelected: payload.max_selected,
      });
      const groupFields = {
        name,
        limit_enabled: payload.limit_enabled,
        is_required: payload.limit_enabled ? payload.is_required : false,
        min_selected: limit.min,
        max_selected: limit.max,
        stock_enabled: payload.stock_enabled,
        is_active: true,
      };

      let groupId = payload.id ?? "";
      if (payload.id) {
        const { error } = await supabase
          .from("catalog_modifier_groups")
          .update(groupFields)
          .eq("id", payload.id);
        if (error) throw error;
        groupId = payload.id;
      } else {
        const { data, error } = await supabase
          .from("catalog_modifier_groups")
          .insert({
            organization_id: organizationId,
            sort_order: (query.data?.length ?? 0) + 1,
            ...groupFields,
          })
          .select("id")
          .single();
        if (error) throw error;
        groupId = data.id;
      }

      const { data: existingOpts, error: existingError } = await supabase
        .from("catalog_modifier_options")
        .select("id")
        .eq("group_id", groupId)
        .eq("is_active", true);
      if (existingError) throw existingError;

      const keepIds = new Set(options.map((opt) => opt.id).filter(Boolean) as string[]);
      const toRemove = (existingOpts ?? []).map((row) => row.id).filter((id) => !keepIds.has(id));
      if (toRemove.length > 0) {
        const { error } = await supabase.from("catalog_modifier_options").delete().in("id", toRemove);
        if (error) throw error;
      }

      const savedOptionIds: string[] = [];
      for (let i = 0; i < options.length; i += 1) {
        const opt = options[i];
        const row = {
          group_id: groupId,
          organization_id: organizationId,
          name: opt.name,
          extra_price: opt.extra_price,
          sort_order: i + 1,
          is_active: true,
          inventory_sku_id: null as string | null,
        };
        if (opt.id) {
          const { error } = await supabase.from("catalog_modifier_options").update(row).eq("id", opt.id);
          if (error) throw error;
          savedOptionIds.push(opt.id);
        } else {
          const { data, error } = await supabase
            .from("catalog_modifier_options")
            .insert(row)
            .select("id")
            .single();
          if (error) throw error;
          savedOptionIds.push(data.id as string);
        }
      }

      if (payload.stock_enabled) {
        for (let i = 0; i < options.length; i += 1) {
          const opt = options[i];
          const optionId = savedOptionIds[i];
          const qtyRaw = Number(opt.stock_quantity);
          const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : null;
          await syncOptionIngredient({
            organizationId,
            optionId,
            ingredientId: opt.stock_ingredient_id,
            quantity: qty,
          });
        }
      }

      const { error: clearOutletsError } = await supabase
        .from("catalog_modifier_outlets")
        .delete()
        .eq("group_id", groupId);
      if (clearOutletsError) throw clearOutletsError;
      const { error: outletsError } = await supabase.from("catalog_modifier_outlets").insert(
        uniqueOutletIds.map((outlet_id) => ({
          group_id: groupId,
          outlet_id,
          organization_id: organizationId,
        })),
      );
      if (outletsError) throw outletsError;

      return groupId;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("catalog_modifier_groups")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const assignProducts = useMutation({
    mutationFn: async ({ groupId, productIds }: { groupId: string; productIds: string[] }) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const { data: existing, error: existingError } = await supabase
        .from("catalog_product_modifiers")
        .select("product_id")
        .eq("group_id", groupId);
      if (existingError) throw existingError;
      const current = new Set((existing ?? []).map((row) => row.product_id));
      const next = new Set(productIds);
      const toAdd = productIds.filter((id) => !current.has(id));
      const toRemove = [...current].filter((id) => !next.has(id));
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("catalog_product_modifiers")
          .delete()
          .eq("group_id", groupId)
          .in("product_id", toRemove);
        if (error) throw error;
      }
      if (toAdd.length > 0) {
        const { error } = await supabase.from("catalog_product_modifiers").insert(
          toAdd.map((product_id) => ({
            product_id,
            group_id: groupId,
            organization_id: organizationId,
          })),
        );
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  return {
    rows: query.data ?? [],
    isLoading: query.isLoading,
    save: save.mutateAsync,
    remove: remove.mutateAsync,
    assignProducts: assignProducts.mutateAsync,
    isSaving: save.isPending || remove.isPending || assignProducts.isPending,
  };
}
