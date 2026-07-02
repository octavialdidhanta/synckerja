import { useQuery } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";

export type TikTokCredentialSlotDiagnostic = {
  env_keys: string[];
  configured: boolean;
  client_id_masked: string | null;
  matched_app: "business_content" | "developers_content" | "unknown" | null;
  matched_app_label: string | null;
  oauth_redirect_uri: string | null;
  recommendation: string | null;
};

export type TikTokCredentialDiagnostics = {
  content: TikTokCredentialSlotDiagnostic;
  publish: TikTokCredentialSlotDiagnostic;
  ads: TikTokCredentialSlotDiagnostic;
  content_matches_ads: boolean | null;
  summary: string;
};

export function useTikTokCredentialDiagnostics(
  organizationId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["tiktok-credential-diagnostics", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase.functions.invoke("tiktok-content-config", {
        body: { action: "getCredentialDiagnostics", organization_id: organizationId },
      });
      if (error) throw await parseEdgeFunctionError(error, data);
      const payload = data as TikTokCredentialDiagnostics & { error?: string };
      if (payload?.error) throw await parseEdgeFunctionError(null, payload);
      return payload;
    },
    enabled: Boolean(organizationId) && options?.enabled !== false,
    staleTime: 60_000,
    retry: false,
  });
}
