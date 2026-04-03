import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type {
  SopTemplate,
  SopTemplateStep,
  SopTemplateCreate,
  SopTemplateStepCreate,
  SopTemplateStepUpdate,
} from "../types/sopTypes";
import type { DefaultPriceRow } from "../types/defaultPrices";

export function useSopTemplate(defaultPriceId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const { data: template, isLoading, refetch: refetchTemplate } = useQuery({
    queryKey: ["sop-template", defaultPriceId],
    queryFn: async (): Promise<SopTemplate | null> => {
      if (!defaultPriceId) return null;
      const { data, error } = await supabase
        .from("sop_templates")
        .select("*")
        .eq("default_price_id", defaultPriceId)
        .maybeSingle();
      if (error) throw error;
      return data as SopTemplate | null;
    },
    enabled: !!defaultPriceId,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: SopTemplateCreate) => {
      const { data, error } = await supabase
        .from("sop_templates")
        .insert({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data as SopTemplate;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sop-template", variables.default_price_id] });
      queryClient.invalidateQueries({ queryKey: ["sop-templates-list", organizationId] });
    },
  });

  return {
    template,
    isLoading,
    create: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    refetchTemplate,
  };
}

export function useSopTemplatesList() {
  const { organizationId } = useCurrentOrg();

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["sop-templates-list", organizationId],
    queryFn: async (): Promise<(SopTemplate & { service_name?: string; sub_service_name?: string })[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("sop_templates")
        .select(
          `
          *,
          default_prices!default_price_id(service_id, sub_service_id)
        `,
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const templates = (data ?? []) as (SopTemplate & {
        default_prices?: { service_id: string; sub_service_id: string | null };
      })[];

      const serviceIds = [...new Set(templates.map((t) => t.default_prices?.service_id).filter(Boolean))] as string[];
      const subIds = [...new Set(templates.map((t) => t.default_prices?.sub_service_id).filter(Boolean))] as string[];

      const [servicesRes, subRes] = await Promise.all([
        serviceIds.length ? supabase.from("services").select("id, name").in("id", serviceIds) : { data: [] },
        subIds.length ? supabase.from("sub_services").select("id, name").in("id", subIds) : { data: [] },
      ]);

      const serviceMap = new Map(
        (servicesRes.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name]),
      );
      const subMap = new Map(
        (subRes.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name]),
      );

      return templates.map((t) => {
        const dp = t.default_prices;
        const { default_prices: _removed, ...rest } = t;
        return {
          ...rest,
          service_name: dp?.service_id ? (serviceMap.get(dp.service_id) ?? "") : "",
          sub_service_name: dp?.sub_service_id ? (subMap.get(dp.sub_service_id) ?? "") : "",
        };
      });
    },
    enabled: !!organizationId,
  });

  return { list, isLoading };
}

export function useSopTemplateSteps(sopTemplateId: string | null) {
  const queryClient = useQueryClient();

  const { data: steps = [], isLoading } = useQuery({
    queryKey: ["sop-template-steps", sopTemplateId],
    queryFn: async (): Promise<SopTemplateStep[]> => {
      if (!sopTemplateId) return [];
      const { data, error } = await supabase
        .from("sop_template_steps")
        .select("*")
        .eq("sop_template_id", sopTemplateId)
        .order("order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SopTemplateStep[];
    },
    enabled: !!sopTemplateId,
  });

  const createStepMutation = useMutation({
    mutationFn: async (payload: SopTemplateStepCreate) => {
      const { data, error } = await supabase
        .from("sop_template_steps")
        .insert({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data as SopTemplateStep;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sop-template-steps", variables.sop_template_id] });
    },
  });

  const updateStepMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: SopTemplateStepUpdate }) => {
      const { error } = await supabase
        .from("sop_template_steps")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sop-template-steps", sopTemplateId] });
    },
  });

  const deleteStepMutation = useMutation({
    mutationFn: async ({ id, sopTemplateId: templateId }: { id: string; sopTemplateId: string }) => {
      const { error } = await supabase.from("sop_template_steps").delete().eq("id", id);
      if (error) throw error;
      return templateId;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sop-template-steps", variables.sopTemplateId] });
    },
  });

  return {
    steps,
    isLoading,
    createStep: createStepMutation.mutateAsync,
    updateStep: updateStepMutation.mutateAsync,
    deleteStep: deleteStepMutation.mutateAsync,
    isCreatingStep: createStepMutation.isPending,
    isUpdatingStep: updateStepMutation.isPending,
    isDeletingStep: deleteStepMutation.isPending,
  };
}

export function useSopTemplateByService(serviceId: string | null, subServiceId: string | null) {
  const { organizationId } = useCurrentOrg();

  const { data: result, isLoading } = useQuery({
    queryKey: ["sop-template-by-service", organizationId, serviceId, subServiceId],
    queryFn: async (): Promise<{
      default_price_id: string | null;
      defaultPriceRow: DefaultPriceRow | null;
      sop_template: SopTemplate | null;
      steps: SopTemplateStep[];
    }> => {
      if (!organizationId || !serviceId) {
        return { default_price_id: null, defaultPriceRow: null, sop_template: null, steps: [] };
      }
      let q = supabase
        .from("default_prices")
        .select("id, organization_id, service_id, sub_service_id, unit_price, created_at, updated_at")
        .eq("organization_id", organizationId)
        .eq("service_id", serviceId);
      if (subServiceId) {
        q = q.eq("sub_service_id", subServiceId);
      } else {
        q = q.is("sub_service_id", null);
      }
      const { data: dp, error: dpError } = await q.maybeSingle();
      if (dpError) throw dpError;
      const default_price_id = dp?.id ?? null;
      if (!default_price_id || !dp) {
        return { default_price_id: null, defaultPriceRow: null, sop_template: null, steps: [] };
      }
      const [servicesRes, subRes] = await Promise.all([
        supabase.from("services").select("id, name").eq("id", dp.service_id).maybeSingle(),
        dp.sub_service_id
          ? supabase.from("sub_services").select("id, name").eq("id", dp.sub_service_id).maybeSingle()
          : { data: null },
      ]);
      const service_name = (servicesRes.data as { name?: string } | null)?.name ?? "";
      const sub_service_name = (subRes.data as { name?: string } | null)?.name ?? "";
      const defaultPriceRow: DefaultPriceRow = {
        id: dp.id,
        organization_id: dp.organization_id,
        service_id: dp.service_id,
        sub_service_id: dp.sub_service_id ?? null,
        unit_price: Number(dp.unit_price),
        created_at: dp.created_at,
        updated_at: dp.updated_at,
        service_name,
        sub_service_name,
      };
      const { data: st, error: stError } = await supabase
        .from("sop_templates")
        .select("*")
        .eq("default_price_id", default_price_id)
        .maybeSingle();
      if (stError) throw stError;
      const sop_template = st as SopTemplate | null;
      if (!sop_template) {
        return { default_price_id, defaultPriceRow, sop_template: null, steps: [] };
      }
      const { data: stepRows, error: stepError } = await supabase
        .from("sop_template_steps")
        .select("*")
        .eq("sop_template_id", sop_template.id)
        .order("order", { ascending: true });
      if (stepError) throw stepError;
      const stepList = (stepRows ?? []) as SopTemplateStep[];
      return { default_price_id, defaultPriceRow, sop_template, steps: stepList };
    },
    enabled: !!organizationId && !!serviceId,
  });

  return {
    defaultPriceId: result?.default_price_id ?? null,
    defaultPriceRow: result?.defaultPriceRow ?? null,
    sopTemplate: result?.sop_template ?? null,
    steps: result?.steps ?? [],
    hasSop: !!(result?.sop_template && (result?.steps?.length ?? 0) > 0),
    isLoading,
  };
}
