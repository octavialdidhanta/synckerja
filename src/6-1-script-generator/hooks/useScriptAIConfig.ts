import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

/** Baris konfigurasi (tanpa `google_ai_api_key` — tidak di-select). */
export type ScriptAIConfigRow = {
  id: string;
  organization_id: string;
  daily_limit: number;
  model: string;
  is_active: boolean;
  api_key_configured: boolean;
};

export function useScriptAIConfig() {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['script-ai-config', organizationId],
    queryFn: async () => {
      if (!organizationId) {
        return null;
      }
      const { data, error } = await supabase
        .from('organization_script_ai_config')
        .select('id, organization_id, daily_limit, model, is_active, api_key_configured')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) throw error;
      return data as ScriptAIConfigRow | null;
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
