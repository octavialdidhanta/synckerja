import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

/** Baris konfigurasi (tanpa kunci API — tidak di-select). */
export type ScriptAIConfigRow = {
  id: string;
  organization_id: string;
  daily_limit: number;
  model: string;
  is_active: boolean;
  /** Text AI provider: gemini | groq | fireworks | openai */
  text_ai_provider?: 'gemini' | 'groq' | 'fireworks' | 'openai';
  api_key_configured: boolean;
  openai_api_key_configured: boolean;
  claude_api_key_configured?: boolean;
  claude_model?: string;
  claude_pdf_daily_limit?: number;
};

export function useScriptAIConfig() {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['script-ai-config', organizationId],
    queryFn: async () => {
      if (!organizationId) {
        return null;
      }
      const baseSelect =
        'id, organization_id, daily_limit, model, is_active, text_ai_provider, api_key_configured, openai_api_key_configured';
      const withClaude =
        `${baseSelect}, claude_api_key_configured, claude_model, claude_pdf_daily_limit`;
      const first = await supabase
        .from('organization_script_ai_config')
        .select(withClaude)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (first.error && /claude_/i.test(first.error.message)) {
        const fallback = await supabase
          .from('organization_script_ai_config')
          .select(baseSelect)
          .eq('organization_id', organizationId)
          .maybeSingle();
        if (fallback.error) throw fallback.error;
        return fallback.data as ScriptAIConfigRow | null;
      }
      if (first.error) throw first.error;
      return first.data as ScriptAIConfigRow | null;
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
