import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { maxServingsFromModifierRecipe } from "../lib/modifierIngredientStock";
import { resolveStockCommitPolicy } from "@/stock-management/stock-commit/lib/resolveStockCommitPolicy";

export type PosCustomizeVariant = {
  id: string;
  name: string;
  price: number;
  availableQty: number | null;
};

export type PosCustomizeModifierOption = {
  id: string;
  name: string;
  extraPrice: number;
  /** Null = not stock-gated (no stock_enabled recipe). */
  availableQty: number | null;
  outOfStock: boolean;
};

export type PosCustomizeModifierGroup = {
  id: string;
  name: string;
  isRequired: boolean;
  minSelected: number;
  maxSelected: number;
  singleSelect: boolean;
  stockEnabled: boolean;
  options: PosCustomizeModifierOption[];
};

export type PosCustomizeSalesTypePrice = {
  salesTypeId: string;
  name: string;
  price: number;
  variantId: string | null;
};

export type PosCustomizeDiscount = {
  id: string;
  name: string;
  inputConfiguration: "fixed" | "customizable";
  amountUnit: "rp" | "percent" | null;
  amountValue: number | null;
};

export type PosItemCustomizeOptions = {
  variants: PosCustomizeVariant[];
  modifierGroups: PosCustomizeModifierGroup[];
  salesTypePrices: PosCustomizeSalesTypePrice[];
  discounts: PosCustomizeDiscount[];
  useSalesTypePrices: boolean;
  /** Max servings from base product recipe at outlet; null = not recipe-gated. */
  baseRecipeAvailableQty: number | null;
};

export function usePosItemCustomizeOptions(args: {
  outletId: string | null;
  productId: string | null;
  enabled: boolean;
}) {
  const { organizationId } = useCurrentOrg();
  const enabled = Boolean(
    args.enabled && organizationId && args.outletId && args.productId,
  );

  return useQuery({
    queryKey: [
      "pos-item-customize-options",
      organizationId,
      args.outletId,
      args.productId,
    ],
    enabled,
    staleTime: 5_000,
    queryFn: async (): Promise<PosItemCustomizeOptions> => {
      if (!organizationId || !args.outletId || !args.productId) {
        return {
          variants: [],
          modifierGroups: [],
          salesTypePrices: [],
          discounts: [],
          useSalesTypePrices: false,
          baseRecipeAvailableQty: null,
        };
      }
      const productId = args.productId;
      const outletId = args.outletId;

      const [
        productRes,
        variantsRes,
        productModsRes,
        salesTypesRes,
        stpRes,
        discountsRes,
      ] = await Promise.all([
        supabase
          .from("default_prices")
          .select("id, use_sales_type_prices, unit_price")
          .eq("id", productId)
          .maybeSingle(),
        supabase
          .from("catalog_product_variants")
          .select("id, name, price, sort_order")
          .eq("product_id", productId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("catalog_product_modifiers")
          .select("group_id")
          .eq("product_id", productId),
        supabase
          .from("catalog_sales_types")
          .select(
            "id, name, is_active, catalog_sales_type_outlets(outlet_id)",
          )
          .eq("organization_id", organizationId)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("catalog_product_sales_type_prices")
          .select("sales_type_id, variant_id, price")
          .eq("product_id", productId),
        supabase
          .from("catalog_discounts")
          .select(
            "id, name, input_configuration, amount_unit, amount_value, is_active, catalog_discount_outlets(outlet_id)",
          )
          .eq("organization_id", organizationId)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);

      const variantIds = (variantsRes.data ?? []).map((v) => v.id);
      const stockCommitPoint = await resolveStockCommitPolicy({
        organizationId,
        outletId,
      });
      const useAtp = stockCommitPoint === "fulfillment";
      const variantStockRes = variantIds.length
        ? await supabase
            .from("catalog_product_variant_outlets")
            .select("variant_id, in_stock, reserved_qty")
            .eq("outlet_id", outletId)
            .in("variant_id", variantIds)
        : { data: [] as Array<{ variant_id: string; in_stock: number; reserved_qty: number }> };
      const stockMap = new Map(
        (variantStockRes.data ?? []).map((r) => {
          const inStock = Number(r.in_stock) || 0;
          const reserved = useAtp ? Number(r.reserved_qty) || 0 : 0;
          return [r.variant_id, Math.max(0, inStock - reserved)] as const;
        }),
      );

      const variants: PosCustomizeVariant[] = (variantsRes.data ?? []).map(
        (v) => ({
          id: String(v.id),
          name: String(v.name ?? "").trim() || "—",
          price: Number(v.price) || 0,
          availableQty: stockMap.has(v.id) ? stockMap.get(v.id)! : null,
        }),
      );

      const groupIds = [
        ...new Set((productModsRes.data ?? []).map((r) => r.group_id)),
      ];
      let modifierGroups: PosCustomizeModifierGroup[] = [];
      if (groupIds.length > 0) {
        const { data: groups } = await supabase
          .from("catalog_modifier_groups")
          .select(
            "id, name, is_active, limit_enabled, is_required, min_selected, max_selected, stock_enabled, sort_order, catalog_modifier_options(id, name, extra_price, sort_order, is_active), catalog_modifier_outlets(outlet_id)",
          )
          .in("id", groupIds)
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        modifierGroups = (groups ?? [])
          .filter((g) => {
            const outlets = (
              g as {
                catalog_modifier_outlets?: Array<{ outlet_id: string }>;
              }
            ).catalog_modifier_outlets;
            const ids = (outlets ?? []).map((o) => o.outlet_id);
            return ids.length === 0 || ids.includes(outletId);
          })
          .map((g) => {
            const options = (
              (
                g as {
                  catalog_modifier_options?: Array<{
                    id: string;
                    name: string;
                    extra_price: number;
                    sort_order: number;
                    is_active: boolean;
                  }>;
                }
              ).catalog_modifier_options ?? []
            )
              .filter((o) => o.is_active)
              .sort(
                (a, b) =>
                  a.sort_order - b.sort_order || a.name.localeCompare(b.name),
              )
              .map((o) => ({
                id: String(o.id),
                name: String(o.name ?? "").trim(),
                extraPrice: Number(o.extra_price) || 0,
              }));
            const limitEnabled = Boolean(g.limit_enabled);
            const isRequired = limitEnabled ? Boolean(g.is_required) : false;
            const maxSelected = limitEnabled
              ? Math.max(1, Number(g.max_selected) || 1)
              : Math.max(options.length, 1);
            const minSelected = isRequired
              ? Math.min(
                  maxSelected,
                  Math.max(1, Number((g as { min_selected?: number }).min_selected) || 1),
                )
              : 0;
            const singleSelect = limitEnabled && maxSelected === 1;
            const stockEnabled = Boolean(
              (g as { stock_enabled?: boolean }).stock_enabled,
            );
            return {
              id: String(g.id),
              name: String(g.name ?? "").trim(),
              isRequired,
              minSelected,
              maxSelected,
              singleSelect,
              stockEnabled,
              options: options.map((o) => ({
                ...o,
                availableQty: null as number | null,
                outOfStock: false,
              })),
            };
          })
          .filter((g) => g.options.length > 0);

        const stockTrackedOptionIds = modifierGroups
          .filter((g) => g.stockEnabled)
          .flatMap((g) => g.options.map((o) => o.id));

        if (stockTrackedOptionIds.length > 0) {
          const { data: optionBoms } = await supabase
            .from("catalog_modifier_option_ingredients")
            .select("option_id, ingredient_id, quantity")
            .in("option_id", stockTrackedOptionIds);

          const recipeLinesByOption = new Map<
            string,
            Array<{ ingredientId: string; quantityPerOption: number }>
          >();
          const ingredientIds = new Set<string>();
          const mappedOptionIds = new Set<string>();

          for (const row of optionBoms ?? []) {
            const optionId = String(row.option_id);
            const ingredientId = String(row.ingredient_id);
            const quantityPerOption = Number(row.quantity) || 0;
            if (!optionId || !ingredientId || !(quantityPerOption > 0)) continue;
            mappedOptionIds.add(optionId);
            recipeLinesByOption.set(optionId, [{ ingredientId, quantityPerOption }]);
            ingredientIds.add(ingredientId);
          }

          const fallbackOptionIds = stockTrackedOptionIds.filter(
            (id) => !mappedOptionIds.has(id),
          );
          if (fallbackOptionIds.length > 0) {
            const { data: recipes } = await supabase
              .from("catalog_product_recipes")
              .select(
                "modifier_option_id, catalog_product_recipe_lines(ingredient_id, quantity)",
              )
              .eq("product_id", productId)
              .in("modifier_option_id", fallbackOptionIds);

            for (const recipe of recipes ?? []) {
              const optionId = recipe.modifier_option_id
                ? String(recipe.modifier_option_id)
                : null;
              if (!optionId || mappedOptionIds.has(optionId)) continue;
              const lines = (
                (
                  recipe as {
                    catalog_product_recipe_lines?: Array<{
                      ingredient_id: string;
                      quantity: number;
                    }>;
                  }
                ).catalog_product_recipe_lines ?? []
              )
                .map((l) => ({
                  ingredientId: String(l.ingredient_id),
                  quantityPerOption: Number(l.quantity) || 0,
                }))
                .filter((l) => l.ingredientId && l.quantityPerOption > 0);
              if (lines.length === 0) continue;
              recipeLinesByOption.set(optionId, lines);
              for (const l of lines) ingredientIds.add(l.ingredientId);
            }
          }

          const stockByIngredientId = new Map<string, number>();
          if (ingredientIds.size > 0) {
            const ids = [...ingredientIds];
            const [{ data: ingredients }, { data: outletStock }] =
              await Promise.all([
                supabase
                  .from("catalog_ingredients")
                  .select("id, track_inventory, is_deleted")
                  .in("id", ids),
                supabase
                  .from("catalog_ingredient_outlets")
                  .select("ingredient_id, in_stock")
                  .eq("outlet_id", outletId)
                  .in("ingredient_id", ids),
              ]);

            const trackable = new Set(
              (ingredients ?? [])
                .filter(
                  (i) =>
                    i.track_inventory === true &&
                    (i as { is_deleted?: boolean }).is_deleted !== true,
                )
                .map((i) => String(i.id)),
            );

            for (const row of outletStock ?? []) {
              const id = String(row.ingredient_id);
              if (!trackable.has(id)) continue;
              stockByIngredientId.set(id, Number(row.in_stock) || 0);
            }

            for (const id of trackable) {
              if (!stockByIngredientId.has(id)) stockByIngredientId.set(id, 0);
            }

            for (const [optionId, lines] of recipeLinesByOption) {
              const trackedOnly = lines.filter((l) =>
                trackable.has(l.ingredientId),
              );
              if (trackedOnly.length === 0) {
                recipeLinesByOption.delete(optionId);
              } else {
                recipeLinesByOption.set(optionId, trackedOnly);
              }
            }
          }

          modifierGroups = modifierGroups.map((g) => {
            if (!g.stockEnabled) return g;
            return {
              ...g,
              options: g.options.map((opt) => {
                const lines = recipeLinesByOption.get(opt.id);
                if (!lines) {
                  return { ...opt, availableQty: null, outOfStock: false };
                }
                const availableQty = maxServingsFromModifierRecipe(
                  lines,
                  stockByIngredientId,
                );
                return {
                  ...opt,
                  availableQty,
                  outOfStock:
                    availableQty != null ? availableQty <= 0 : false,
                };
              }),
            };
          });
        }
      }

      const outletSalesTypeIds = new Set<string>();
      const salesTypeName = new Map<string, string>();
      for (const st of salesTypesRes.data ?? []) {
        const outlets = (
          st as { catalog_sales_type_outlets?: Array<{ outlet_id: string }> }
        ).catalog_sales_type_outlets;
        const ids = (outlets ?? []).map((o) => o.outlet_id);
        if (ids.length > 0 && !ids.includes(outletId)) continue;
        outletSalesTypeIds.add(String(st.id));
        salesTypeName.set(String(st.id), String(st.name ?? "").trim());
      }

      const salesTypePrices: PosCustomizeSalesTypePrice[] = (stpRes.data ?? [])
        .filter((row) => outletSalesTypeIds.has(String(row.sales_type_id)))
        .map((row) => ({
          salesTypeId: String(row.sales_type_id),
          name: salesTypeName.get(String(row.sales_type_id)) ?? "—",
          price: Number(row.price) || 0,
          variantId: row.variant_id != null ? String(row.variant_id) : null,
        }))
        .filter((row) => row.price > 0);

      const discounts: PosCustomizeDiscount[] = [];
      for (const row of discountsRes.data ?? []) {
        const outlets = (
          row as { catalog_discount_outlets?: Array<{ outlet_id: string }> }
        ).catalog_discount_outlets;
        const ids = (outlets ?? []).map((o) => o.outlet_id);
        if (ids.length > 0 && !ids.includes(outletId)) continue;
        const conf =
          row.input_configuration === "customizable" ? "customizable" : "fixed";
        const unit = row.amount_unit;
        discounts.push({
          id: String(row.id),
          name: String(row.name ?? "Discount"),
          inputConfiguration: conf,
          amountUnit: unit === "percent" || unit === "rp" ? unit : null,
          amountValue:
            row.amount_value == null ? null : Number(row.amount_value),
        });
      }

      let baseRecipeAvailableQty: number | null = null;
      const { data: baseRecipes } = await supabase
        .from("catalog_product_recipes")
        .select("id, catalog_product_recipe_lines(ingredient_id, quantity)")
        .eq("product_id", productId)
        .is("modifier_option_id", null)
        .limit(1);
      const baseLines = (
        (
          baseRecipes?.[0] as {
            catalog_product_recipe_lines?: Array<{
              ingredient_id: string;
              quantity: number;
            }>;
          } | undefined
        )?.catalog_product_recipe_lines ?? []
      )
        .map((l) => ({
          ingredientId: String(l.ingredient_id),
          quantityPerOption: Number(l.quantity) || 0,
        }))
        .filter((l) => l.ingredientId && l.quantityPerOption > 0);

      if (baseLines.length > 0) {
        const ids = [...new Set(baseLines.map((l) => l.ingredientId))];
        const [{ data: ingredients }, { data: outletStock }] = await Promise.all([
          supabase
            .from("catalog_ingredients")
            .select("id, track_inventory, is_deleted")
            .in("id", ids),
          supabase
            .from("catalog_ingredient_outlets")
            .select("ingredient_id, in_stock")
            .eq("outlet_id", outletId)
            .in("ingredient_id", ids),
        ]);
        const trackable = new Set(
          (ingredients ?? [])
            .filter(
              (i) =>
                i.track_inventory === true &&
                (i as { is_deleted?: boolean }).is_deleted !== true,
            )
            .map((i) => String(i.id)),
        );
        const stockByIngredientId = new Map<string, number>();
        for (const id of trackable) stockByIngredientId.set(id, 0);
        for (const row of outletStock ?? []) {
          const id = String(row.ingredient_id);
          if (!trackable.has(id)) continue;
          stockByIngredientId.set(id, Number(row.in_stock) || 0);
        }
        const trackedLines = baseLines.filter((l) => trackable.has(l.ingredientId));
        if (trackedLines.length > 0) {
          baseRecipeAvailableQty = maxServingsFromModifierRecipe(
            trackedLines,
            stockByIngredientId,
          );
        }
      }

      return {
        variants,
        modifierGroups,
        salesTypePrices,
        discounts,
        useSalesTypePrices: Boolean(productRes.data?.use_sales_type_prices),
        baseRecipeAvailableQty,
      };
    },
  });
}
