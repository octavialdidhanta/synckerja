import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useUserData } from '@/shared/auth/hooks/useUserData';

export type ScriptBreakdownFillRule = 'strict' | 'honest_empty';
export type ScriptBreakdownKeywordHint = 'none' | 'narasi' | 'visual';

export interface ScriptBreakdownTableColumnRow {
  id: string;
  template_id: string;
  sort_order: number;
  header_label: string;
  placeholder_example: string | null;
  detail_body: string | null;
  fill_rule: ScriptBreakdownFillRule;
  keyword_hint: ScriptBreakdownKeywordHint;
}

export interface ScriptBreakdownTableTemplateRow {
  id: string;
  organization_id: string;
  name: string;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  script_breakdown_table_columns?: ScriptBreakdownTableColumnRow[];
}

export interface ScriptBreakdownTableColumnInput {
  header_label: string;
  placeholder_example?: string | null;
  detail_body?: string | null;
  fill_rule: ScriptBreakdownFillRule;
  keyword_hint: ScriptBreakdownKeywordHint;
}

export interface CreateScriptBreakdownTableTemplateInput {
  name: string;
  is_default?: boolean;
  columns: ScriptBreakdownTableColumnInput[];
}

export interface UpdateScriptBreakdownTableTemplateInput {
  name?: string;
  is_default?: boolean;
  columns?: ScriptBreakdownTableColumnInput[];
}

export const SCRIPT_BREAKDOWN_TABLE_TEMPLATES_QUERY_KEY = 'script-breakdown-table-templates' as const;

export function useScriptBreakdownTableTemplates() {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: [SCRIPT_BREAKDOWN_TABLE_TEMPLATES_QUERY_KEY, organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('script_breakdown_table_templates')
        .select(
          `
          *,
          script_breakdown_table_columns (*)
        `,
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching script breakdown table templates:', error);
        throw error;
      }

      const rows = (data || []) as ScriptBreakdownTableTemplateRow[];
      for (const row of rows) {
        const cols = row.script_breakdown_table_columns || [];
        cols.sort((a, b) => a.sort_order - b.sort_order);
        row.script_breakdown_table_columns = cols;
      }
      return rows;
    },
    enabled: !!organizationId,
  });
}

export function useScriptBreakdownTableMutations() {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { data: profile } = useUserData();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [SCRIPT_BREAKDOWN_TABLE_TEMPLATES_QUERY_KEY, organizationId] });
  };

  const replaceColumns = async (templateId: string, columns: ScriptBreakdownTableColumnInput[]) => {
    const { error: delErr } = await supabase
      .from('script_breakdown_table_columns')
      .delete()
      .eq('template_id', templateId);
    if (delErr) throw delErr;

    if (columns.length === 0) return;

    const { error: insErr } = await supabase.from('script_breakdown_table_columns').insert(
      columns.map((c, i) => ({
        template_id: templateId,
        sort_order: i,
        header_label: c.header_label.trim(),
        placeholder_example: c.placeholder_example?.trim() || null,
        detail_body: c.detail_body?.trim() || null,
        fill_rule: c.fill_rule,
        keyword_hint: c.keyword_hint,
      })),
    );
    if (insErr) throw insErr;
  };

  const createMutation = useMutation({
    mutationFn: async (input: CreateScriptBreakdownTableTemplateInput) => {
      if (!organizationId) throw new Error('Organization ID is required');
      if (!input.columns?.length) throw new Error('Minimal satu kolom');

      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || profile?.user_id || null;

      const { data: template, error: tErr } = await supabase
        .from('script_breakdown_table_templates')
        .insert({
          organization_id: organizationId,
          name: input.name.trim(),
          is_default: input.is_default ?? false,
          created_by: userId,
        })
        .select()
        .single();

      if (tErr) throw tErr;
      if (!template?.id) throw new Error('Gagal membuat template');

      await replaceColumns(template.id, input.columns);
      invalidate();
      return template as ScriptBreakdownTableTemplateRow;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateScriptBreakdownTableTemplateInput }) => {
      if (input.name !== undefined && !input.name.trim()) {
        throw new Error('Nama template wajib diisi');
      }
      if (input.columns !== undefined && input.columns.length === 0) {
        throw new Error('Minimal satu kolom');
      }

      if (input.name !== undefined || input.is_default !== undefined || input.columns !== undefined) {
        const updateRow: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (input.name !== undefined) updateRow.name = input.name.trim();
        if (input.is_default !== undefined) updateRow.is_default = input.is_default;
        const { error: uErr } = await supabase
          .from('script_breakdown_table_templates')
          .update(updateRow)
          .eq('id', id);
        if (uErr) throw uErr;
      }

      if (input.columns) {
        await replaceColumns(id, input.columns);
      }
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('script_breakdown_table_templates').delete().eq('id', id);
      if (error) throw error;
      invalidate();
    },
  });

  return {
    createTemplate: createMutation.mutateAsync,
    updateTemplate: updateMutation.mutateAsync,
    deleteTemplate: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
