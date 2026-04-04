import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { InvoiceTemplate, InvoiceTemplateFormData } from "@/shared/types/invoice";

export const useInvoiceTemplate = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const [currentTemplate, setCurrentTemplate] = useState<InvoiceTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["invoice-templates", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("invoice_templates")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("template_name");

      if (error) throw error;
      return (data || []) as InvoiceTemplate[];
    },
    enabled: !!organizationId,
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (formData: InvoiceTemplateFormData) => {
      if (!organizationId) throw new Error("Organization ID is required");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("invoice_templates")
        .insert({
          ...formData,
          organization_id: organizationId,
          created_by: user.id,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: data as InvoiceTemplate };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-templates", organizationId] });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InvoiceTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from("invoice_templates")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as InvoiceTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-templates", organizationId] });
      setHasUnsavedChanges(false);
    },
  });

  const createTemplate = useCallback(
    async (formData: InvoiceTemplateFormData) => {
      setIsSaving(true);
      try {
        const result = await createTemplateMutation.mutateAsync(formData);
        return result;
      } catch (error) {
        console.error("Error creating template:", error);
        return { success: false, error };
      } finally {
        setIsSaving(false);
      }
    },
    [createTemplateMutation],
  );

  const updateField = useCallback(
    async (field: keyof InvoiceTemplate, value: unknown) => {
      if (!currentTemplate) return;

      setIsSaving(true);
      setHasUnsavedChanges(true);

      try {
        const updated = await updateTemplateMutation.mutateAsync({
          id: currentTemplate.id,
          [field]: value,
        });

        setCurrentTemplate(updated);
        return { success: true };
      } catch (error) {
        console.error("Error updating template field:", error);
        setHasUnsavedChanges(false);
        return { success: false, error };
      } finally {
        setIsSaving(false);
      }
    },
    [currentTemplate, updateTemplateMutation],
  );

  return {
    templates: templates as InvoiceTemplate[],
    currentTemplate,
    setCurrentTemplate,
    updateField,
    isSaving: isSaving || createTemplateMutation.isPending || updateTemplateMutation.isPending,
    hasUnsavedChanges,
    createTemplate,
    isLoading,
  };
};
