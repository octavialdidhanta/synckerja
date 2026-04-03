import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { toast } from "sonner";
import type { PricingCalculationInput, PricingCalculationResult } from "../types/pricingTypes";

export interface SavedCalculation {
  id: string;
  organization_id: string;
  created_by: string;
  product_id: string | null;
  calculation_name: string;
  calculation_input: PricingCalculationInput;
  calculation_result: PricingCalculationResult;
  created_at: string;
  updated_at: string;
}

export const usePricingCalculations = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const { data: calculations = [], isLoading } = useQuery({
    queryKey: ["pricing-calculations", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("pricing_calculations")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []) as SavedCalculation[];
    },
    enabled: !!organizationId,
  });

  const saveCalculation = useMutation({
    mutationFn: async ({
      calculationName,
      productId,
      input,
      result,
    }: {
      calculationName: string;
      productId?: string | null;
      input: PricingCalculationInput;
      result: PricingCalculationResult;
    }) => {
      if (!organizationId) throw new Error("Organization not found");

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("pricing_calculations")
        .insert({
          organization_id: organizationId,
          created_by: userData.user.id,
          product_id: productId ?? null,
          calculation_name: calculationName,
          calculation_input: input as unknown as Record<string, unknown>,
          calculation_result: result as unknown as Record<string, unknown>,
        })
        .select()
        .single();

      if (error) throw error;
      return data as SavedCalculation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing-calculations", organizationId] });
      toast.success("Calculation saved successfully");
    },
    onError: () => {
      toast.error("Failed to save calculation");
    },
  });

  const updateCalculation = useMutation({
    mutationFn: async ({
      id,
      calculationName,
      input,
      result,
    }: {
      id: string;
      calculationName: string;
      input: PricingCalculationInput;
      result: PricingCalculationResult;
    }) => {
      if (!organizationId) throw new Error("Organization not found");

      const { data, error } = await supabase
        .from("pricing_calculations")
        .update({
          calculation_name: calculationName,
          calculation_input: input as unknown as Record<string, unknown>,
          calculation_result: result as unknown as Record<string, unknown>,
        })
        .eq("id", id)
        .eq("organization_id", organizationId)
        .select()
        .single();

      if (error) throw error;
      return data as SavedCalculation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing-calculations", organizationId] });
      toast.success("Calculation updated successfully");
    },
    onError: () => {
      toast.error("Failed to update calculation");
    },
  });

  const deleteCalculation = useMutation({
    mutationFn: async (id: string) => {
      if (!organizationId) throw new Error("Organization not found");

      const { error } = await supabase
        .from("pricing_calculations")
        .delete()
        .eq("id", id)
        .eq("organization_id", organizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing-calculations", organizationId] });
      toast.success("Calculation deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete calculation");
    },
  });

  return {
    calculations,
    isLoading,
    saveCalculation: saveCalculation.mutateAsync,
    updateCalculation: updateCalculation.mutateAsync,
    deleteCalculation: deleteCalculation.mutateAsync,
    isSaving: saveCalculation.isPending,
    isUpdating: updateCalculation.isPending,
    isDeleting: deleteCalculation.isPending,
  };
};
