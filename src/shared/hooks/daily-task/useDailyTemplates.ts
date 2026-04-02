import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import type {
  DailyTemplate,
  DailyTemplateCreate,
  DailyTemplateStep,
  DailyTemplateStepCreate,
  DailyTemplateStepUpdate,
} from '@/8-2-DailyTask/types';

const DAILY_TEMPLATES_QUERY_KEY = 'daily-templates';
const DAILY_TEMPLATE_STEPS_QUERY_KEY = 'daily-template-steps';

/** List daily templates for current org. RLS filters by department/Owner. */
export function useDailyTemplates() {
  const { organizationId } = useCurrentOrg();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: [DAILY_TEMPLATES_QUERY_KEY, organizationId],
    queryFn: async (): Promise<DailyTemplate[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('daily_template')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DailyTemplate[];
    },
    enabled: !!organizationId,
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (payload: DailyTemplateCreate) => {
      const { data, error } = await supabase
        .from('daily_template')
        .insert({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data as DailyTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DAILY_TEMPLATES_QUERY_KEY, organizationId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<DailyTemplateCreate> }) => {
      const { data, error } = await supabase
        .from('daily_template')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as DailyTemplate;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [DAILY_TEMPLATES_QUERY_KEY, organizationId] });
      queryClient.invalidateQueries({ queryKey: [DAILY_TEMPLATES_QUERY_KEY, 'with-steps'] });
      queryClient.invalidateQueries({ queryKey: [DAILY_TEMPLATES_QUERY_KEY, 'single', variables.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('daily_template').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DAILY_TEMPLATES_QUERY_KEY, organizationId] });
      queryClient.invalidateQueries({ queryKey: [DAILY_TEMPLATES_QUERY_KEY, 'with-steps'] });
    },
  });

  return {
    templates,
    isLoading,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

/** Single daily template by id (for edit mode). */
export function useDailyTemplate(templateId: string | null) {
  const { data: template, isLoading } = useQuery({
    queryKey: [DAILY_TEMPLATES_QUERY_KEY, 'single', templateId],
    queryFn: async (): Promise<DailyTemplate | null> => {
      if (!templateId) return null;
      const { data, error } = await supabase
        .from('daily_template')
        .select('*')
        .eq('id', templateId)
        .single();
      if (error) throw error;
      return data as DailyTemplate;
    },
    enabled: !!templateId,
  });
  return { template: template ?? null, isLoading };
}

/** List templates with step count for Add Template modal. */
export function useDailyTemplatesWithStepCount() {
  const { organizationId } = useCurrentOrg();

  const { data: list = [], isLoading } = useQuery({
    queryKey: [DAILY_TEMPLATES_QUERY_KEY, 'with-steps', organizationId],
    queryFn: async (): Promise<(DailyTemplate & { steps_count: number })[]> => {
      if (!organizationId) return [];
      const { data: templates, error: tError } = await supabase
        .from('daily_template')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      if (tError) throw tError;
      if (!templates?.length) return [];

      const templateIds = templates.map((t) => t.id);
      const { data: steps, error: sError } = await supabase
        .from('daily_template_steps')
        .select('daily_template_id')
        .in('daily_template_id', templateIds);
      if (sError) throw sError;

      const countByTemplate: Record<string, number> = {};
      templateIds.forEach((id) => (countByTemplate[id] = 0));
      (steps ?? []).forEach((s: { daily_template_id: string }) => {
        countByTemplate[s.daily_template_id] = (countByTemplate[s.daily_template_id] ?? 0) + 1;
      });

      return (templates as DailyTemplate[]).map((t) => ({
        ...t,
        steps_count: countByTemplate[t.id] ?? 0,
      }));
    },
    enabled: !!organizationId,
  });

  return { list, isLoading };
}

export function useDailyTemplateSteps(dailyTemplateId: string | null) {
  const queryClient = useQueryClient();

  const { data: steps = [], isLoading } = useQuery({
    queryKey: [DAILY_TEMPLATE_STEPS_QUERY_KEY, dailyTemplateId],
    queryFn: async (): Promise<DailyTemplateStep[]> => {
      if (!dailyTemplateId) return [];
      const { data, error } = await supabase
        .from('daily_template_steps')
        .select('*')
        .eq('daily_template_id', dailyTemplateId)
        .order('order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as DailyTemplateStep[];
    },
    enabled: !!dailyTemplateId,
  });

  const createStepMutation = useMutation({
    mutationFn: async (payload: DailyTemplateStepCreate) => {
      const { data, error } = await supabase
        .from('daily_template_steps')
        .insert({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data as DailyTemplateStep;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [DAILY_TEMPLATE_STEPS_QUERY_KEY, variables.daily_template_id] });
      queryClient.invalidateQueries({ queryKey: [DAILY_TEMPLATES_QUERY_KEY, 'with-steps'] });
    },
  });

  const updateStepMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: DailyTemplateStepUpdate }) => {
      const { error } = await supabase
        .from('daily_template_steps')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: [DAILY_TEMPLATE_STEPS_QUERY_KEY, dailyTemplateId] });
      queryClient.invalidateQueries({ queryKey: [DAILY_TEMPLATES_QUERY_KEY, 'with-steps'] });
    },
  });

  const deleteStepMutation = useMutation({
    mutationFn: async ({ id, templateId }: { id: string; templateId: string }) => {
      const { error } = await supabase.from('daily_template_steps').delete().eq('id', id);
      if (error) throw error;
      return templateId;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [DAILY_TEMPLATE_STEPS_QUERY_KEY, variables.templateId] });
      queryClient.invalidateQueries({ queryKey: [DAILY_TEMPLATES_QUERY_KEY, 'with-steps'] });
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
