import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { DEFAULT_KITCHEN_SALES_TYPES } from "../lib/defaultKitchenSalesTypes";

const CATALOG_SALES_TYPES_QUERY_KEY = "catalog-sales-types";

/**
 * Ensure the four default sales types exist for the org and are linked to the outlet.
 * Does not rename or delete custom types.
 */
export function useEnsureDefaultKitchenSalesTypes(outletId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      if (!organizationId || !outletId) return;

      const { data: existing, error: listError } = await supabase
        .from("catalog_sales_types")
        .select("id, name")
        .eq("organization_id", organizationId);
      if (listError) throw listError;

      const byLower = new Map(
        (existing ?? []).map((row) => [
          String(row.name).trim().toLowerCase(),
          row.id as string,
        ]),
      );

      for (const def of DEFAULT_KITCHEN_SALES_TYPES) {
        const key = def.name.toLowerCase();
        let salesTypeId = byLower.get(key);

        if (!salesTypeId) {
          const { data: inserted, error: insertError } = await supabase
            .from("catalog_sales_types")
            .insert({
              organization_id: organizationId,
              name: def.name,
              sort_order: def.sort_order,
              is_active: true,
            })
            .select("id")
            .single();
          if (insertError) throw insertError;
          salesTypeId = inserted.id;
          byLower.set(key, salesTypeId);
        }

        const { data: link, error: linkSelectError } = await supabase
          .from("catalog_sales_type_outlets")
          .select("outlet_id")
          .eq("sales_type_id", salesTypeId)
          .eq("outlet_id", outletId)
          .maybeSingle();
        if (linkSelectError) throw linkSelectError;

        if (!link) {
          const { error: linkInsertError } = await supabase
            .from("catalog_sales_type_outlets")
            .insert({
              sales_type_id: salesTypeId,
              outlet_id: outletId,
              organization_id: organizationId,
            });
          if (linkInsertError) throw linkInsertError;
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [CATALOG_SALES_TYPES_QUERY_KEY, organizationId],
      });
    },
  });
}
