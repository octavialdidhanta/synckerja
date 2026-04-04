import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export type ApprovalAccessConfigRow = {
  id: string;
  columnType: string;
  columnName: string;
  allowedRoles: string[];
  exceptions: unknown[];
  isActive: boolean;
};

export function useSocialMediaSettingsApprovalAccess() {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['social-media-settings-approval-access', organizationId],
    queryFn: async (): Promise<{ configs: ApprovalAccessConfigRow[]; userRole: string | null }> => {
      if (!organizationId) {
        return { configs: [], userRole: null };
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: roleRow, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (roleError) throw roleError;

      const { data, error } = await supabase
        .from('approval_access_configurations')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const configs: ApprovalAccessConfigRow[] = (data || []).map((config: Record<string, unknown>) => ({
        id: String(config.id),
        columnType: String(config.column_type ?? ''),
        columnName: String(config.column_name ?? ''),
        allowedRoles: (config.allowed_roles as string[]) || [],
        exceptions: (config.exceptions as unknown[]) || [],
        isActive: Boolean(config.is_active),
      }));

      return {
        configs,
        userRole: roleRow?.role ? String(roleRow.role) : null,
      };
    },
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
