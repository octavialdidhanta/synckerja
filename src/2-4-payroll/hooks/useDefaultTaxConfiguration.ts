import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

export type DefaultTaxConfiguration = {
  id: string;
  calculation_mode: "annualized" | "ter";
};

export const defaultTaxConfigurationQueryKey = (organizationId?: string | null) =>
  ["tax-config-default", organizationId] as const;

export function useDefaultTaxConfiguration(organizationId: string | null) {
  return useQuery({
    queryKey: defaultTaxConfigurationQueryKey(organizationId),
    queryFn: async (): Promise<DefaultTaxConfiguration | null> => {
      const { data, error } = await supabase
        .from("tax_configurations")
        .select("id, calculation_mode")
        .eq("organization_id", organizationId!)
        .eq("is_default", true)
        .maybeSingle();

      if (error) throw error;
      if (!data?.id) return null;

      return {
        id: data.id,
        calculation_mode: (data.calculation_mode as DefaultTaxConfiguration["calculation_mode"]) ?? "annualized",
      };
    },
    enabled: !!organizationId,
  });
}
