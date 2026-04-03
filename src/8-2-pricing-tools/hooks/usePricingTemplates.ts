import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { PricingCalculationInput } from "../types/pricingTypes";

export interface PricingTemplate {
  id: string;
  organization_id: string | null;
  template_name: string;
  template_description: string | null;
  category: string | null;
  industry: string | null;
  template_data: PricingCalculationInput;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const usePricingTemplates = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["pricing-templates", organizationId],
    queryFn: async () => {
      if (!organizationId) {
        const { data, error } = await supabase
          .from("pricing_templates")
          .select("*")
          .eq("is_active", true)
          .is("organization_id", null)
          .order("template_name");

        if (error) throw error;
        return (data || []) as PricingTemplate[];
      }

      const { data, error } = await supabase
        .from("pricing_templates")
        .select("*")
        .eq("is_active", true)
        .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
        .order("template_name");

      if (error) throw error;
      return (data || []) as PricingTemplate[];
    },
    enabled: true,
  });

  const globalTemplates = templates.filter((t) => t.organization_id === null);
  const organizationTemplates = templates.filter((t) => t.organization_id === organizationId);

  const saveTemplate = useMutation({
    mutationFn: async (templateData: {
      template_name: string;
      template_description?: string | null;
      category?: string | null;
      industry?: string | null;
      template_data: PricingCalculationInput;
    }) => {
      if (!organizationId) {
        throw new Error("Organization ID is required to save templates");
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("pricing_templates")
        .insert({
          organization_id: organizationId,
          template_name: templateData.template_name,
          template_description: templateData.template_description ?? null,
          category: templateData.category ?? null,
          industry: templateData.industry ?? null,
          template_data: templateData.template_data as unknown as Record<string, unknown>,
          created_by: user?.id ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as PricingTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing-templates", organizationId] });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({
      templateId,
      templateData,
    }: {
      templateId: string;
      templateData: {
        template_name?: string;
        template_description?: string;
        category?: string;
        industry?: string;
        template_data?: PricingCalculationInput;
      };
    }) => {
      if (!organizationId) {
        throw new Error("Organization ID is required to update templates");
      }

      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (templateData.template_name !== undefined) payload.template_name = templateData.template_name;
      if (templateData.template_description !== undefined)
        payload.template_description = templateData.template_description;
      if (templateData.category !== undefined) payload.category = templateData.category;
      if (templateData.industry !== undefined) payload.industry = templateData.industry;
      if (templateData.template_data !== undefined)
        payload.template_data = templateData.template_data as unknown as Record<string, unknown>;

      const { data, error } = await supabase
        .from("pricing_templates")
        .update(payload)
        .eq("id", templateId)
        .eq("organization_id", organizationId)
        .select()
        .single();

      if (error) throw error;
      return data as PricingTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing-templates", organizationId] });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      if (!organizationId) {
        throw new Error("Organization ID is required to delete templates");
      }

      const { error } = await supabase
        .from("pricing_templates")
        .delete()
        .eq("id", templateId)
        .eq("organization_id", organizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing-templates", organizationId] });
    },
  });

  return {
    templates,
    globalTemplates,
    organizationTemplates,
    isLoading,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
  };
};
