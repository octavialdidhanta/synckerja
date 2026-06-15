import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';

export type BrickImportSettings = {
  organization_id: string;
  default_expense_category_id: string | null;
  default_expense_type_id: string | null;
  import_created_by: string | null;
};

export function useBrickImportSettings() {
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const queryKey = ['brick-import-settings', organizationId];

  const { data, isLoading, isPending } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organizationId) return null;
      const { data: row, error } = await supabase
        .from('organization_brick_import_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (error) throw error;
      return row as BrickImportSettings | null;
    },
    enabled: Boolean(organizationId),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      default_expense_category_id: string;
      default_expense_type_id: string;
    }) => {
      if (!organizationId) throw new Error('Organization required');
      const { error } = await supabase.from('organization_brick_import_settings').upsert({
        organization_id: organizationId,
        default_expense_category_id: payload.default_expense_category_id,
        default_expense_type_id: payload.default_expense_type_id,
        import_created_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const isConfigured = Boolean(
    data?.default_expense_category_id && data?.default_expense_type_id,
  );

  return {
    settings: data,
    isConfigured,
    loading: isLoading,
    isPending,
    saveSettings: saveMutation.mutateAsync,
    saving: saveMutation.isPending,
  };
}
