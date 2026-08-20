import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import type { CatalogSupplier } from "../types";

const SUPPLIERS_QUERY_KEY = "inventory-suppliers";

function mapRow(row: {
  id: string;
  organization_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}): CatalogSupplier {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
  };
}

export function useSuppliersQuery(args: { organizationId: string | null; search?: string }) {
  return useQuery({
    queryKey: [SUPPLIERS_QUERY_KEY, args.organizationId, args.search ?? ""],
    enabled: Boolean(args.organizationId),
    queryFn: async (): Promise<CatalogSupplier[]> => {
      if (!args.organizationId) return [];

      const { data, error } = await supabase
        .from("catalog_suppliers")
        .select("id, organization_id, name, phone, email, address, city, state, zip")
        .eq("organization_id", args.organizationId)
        .eq("is_deleted", false)
        .order("name");
      if (error) throw error;

      let rows = (data ?? []).map(mapRow);
      const q = args.search?.trim().toLowerCase();
      if (q) {
        rows = rows.filter(
          (row) =>
            row.name.toLowerCase().includes(q) ||
            (row.phone ?? "").toLowerCase().includes(q) ||
            (row.email ?? "").toLowerCase().includes(q) ||
            (row.address ?? "").toLowerCase().includes(q),
        );
      }
      return rows;
    },
  });
}

export { SUPPLIERS_QUERY_KEY };
