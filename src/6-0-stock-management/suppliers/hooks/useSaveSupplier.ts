import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import type { SupplierFormValues } from "../types";
import { SUPPLIERS_QUERY_KEY } from "./useSuppliersQuery";

export function useSaveSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      organizationId: string;
      supplierId?: string | null;
      values: SupplierFormValues;
    }) => {
      const payload = {
        organization_id: args.organizationId,
        name: args.values.name.trim(),
        phone: args.values.phone.trim() || null,
        email: args.values.email.trim() || null,
        address: args.values.address.trim() || null,
        city: args.values.city.trim() || null,
        state: args.values.state.trim() || null,
        zip: args.values.zip.trim() || null,
      };

      if (args.supplierId) {
        const { data, error } = await supabase
          .from("catalog_suppliers")
          .update(payload)
          .eq("id", args.supplierId)
          .eq("organization_id", args.organizationId)
          .select("id")
          .single();
        if (error) throw error;
        return data.id as string;
      }

      const { data, error } = await supabase
        .from("catalog_suppliers")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [SUPPLIERS_QUERY_KEY] });
    },
  });
}
