import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

export type OmnichannelApiTokenType = "sdk" | "server" | "legacy_full";

export type OmnichannelApiTokenRow = {
  id: string;
  label: string | null;
  web_id: string;
  token_prefix: string;
  token_type: OmnichannelApiTokenType;
  allowed_origins: string[];
  whatsapp_invoice_template_name: string | null;
  whatsapp_lead_template_name: string | null;
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type OmnichannelTokenDisplayStatus = "active" | "expired" | "revoked";

export type OmnichannelApiSettings = {
  organization_id: string;
  default_whatsapp_invoice_template_name: string | null;
  default_whatsapp_invoice_template_language: string | null;
  default_whatsapp_lead_template_name: string | null;
  default_whatsapp_lead_template_language: string | null;
  offline_conversion_enabled: boolean;
};

const queryKey = (orgId: string) => ["omnichannel", "api-integration", orgId] as const;

async function invokeManage(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("omnichannel-api-manage", { body });
  if (error) throw error;
  if (data && typeof data === "object" && (data as { success?: boolean }).success === false) {
    throw new Error(String((data as { error?: string }).error ?? "Request failed"));
  }
  return data as Record<string, unknown>;
}

export function useOmnichannelApiTokens(
  organizationId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKey(organizationId ?? ""),
    enabled: Boolean(organizationId) && (options?.enabled ?? true),
    queryFn: async () => {
      const data = await invokeManage({ action: "listTokens", organizationId });
      return (data.tokens ?? []) as OmnichannelApiTokenRow[];
    },
  });
}

export function useOmnichannelApiSettings(
  organizationId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...queryKey(organizationId ?? ""), "settings"],
    enabled: Boolean(organizationId) && (options?.enabled ?? true),
    queryFn: async () => {
      const data = await invokeManage({ action: "getSettings", organizationId });
      return data.settings as OmnichannelApiSettings;
    },
  });
}

export function useCreateOmnichannelApiToken(organizationId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      web_id: string;
      label?: string;
      allowed_origins?: string[];
      expires_in_days?: number;
      token_type?: "sdk" | "server";
      whatsapp_invoice_template_name?: string;
    }) => invokeManage({ action: "createToken", organizationId, ...payload }),
    onSuccess: () => {
      if (organizationId) void qc.invalidateQueries({ queryKey: queryKey(organizationId) });
    },
  });
}

export function useRevokeOmnichannelApiToken(organizationId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tokenId: string) =>
      invokeManage({ action: "revokeToken", organizationId, tokenId }),
    onSuccess: () => {
      if (organizationId) void qc.invalidateQueries({ queryKey: queryKey(organizationId) });
    },
  });
}

export function useUpdateOmnichannelTokenOrigins(organizationId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { tokenId: string; allowed_origins: string[] }) =>
      invokeManage({
        action: "updateTokenOrigins",
        organizationId,
        tokenId: payload.tokenId,
        allowed_origins: payload.allowed_origins,
      }),
    onSuccess: () => {
      if (organizationId) void qc.invalidateQueries({ queryKey: queryKey(organizationId) });
    },
  });
}

export function useUpdateOmnichannelApiSettings(organizationId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<OmnichannelApiSettings>) =>
      invokeManage({ action: "updateSettings", organizationId, ...payload }),
    onSuccess: () => {
      if (organizationId) void qc.invalidateQueries({ queryKey: queryKey(organizationId) });
    },
  });
}

export type LeadTemplateMappingRow = {
  id: string;
  organization_id: string;
  web_id: string;
  purpose: string;
  template_name: string;
  template_language: string;
  parameter_mapping: Record<string, string> | null;
  body_keys: string | null;
  is_active: boolean;
  updated_at: string;
};

const leadMappingQueryKey = (orgId: string, webId: string, name: string, lang: string) =>
  [...queryKey(orgId), "lead-mapping", webId, name, lang] as const;

export function useLeadMappingWebIds(
  organizationId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...queryKey(organizationId ?? ""), "lead-mapping-web-ids"],
    enabled: Boolean(organizationId) && (options?.enabled ?? true),
    queryFn: async () => {
      const data = await invokeManage({ action: "listLeadMappingWebIds", organizationId });
      return (data.web_ids ?? []) as string[];
    },
  });
}

export function useLeadTemplateMapping(
  organizationId: string | null | undefined,
  args: { web_id: string; template_name: string; template_language: string } | null,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: args
      ? leadMappingQueryKey(
          organizationId ?? "",
          args.web_id,
          args.template_name,
          args.template_language,
        )
      : [...queryKey(organizationId ?? ""), "lead-mapping", "idle"],
    enabled:
      Boolean(organizationId) &&
      Boolean(args?.web_id && args.template_name) &&
      (options?.enabled ?? true),
    queryFn: async () => {
      const data = await invokeManage({
        action: "getLeadTemplateMapping",
        organizationId,
        ...args!,
      });
      return (data.mapping ?? null) as LeadTemplateMappingRow | null;
    },
  });
}

export function useRecentLeadFormDataKeys(
  organizationId: string | null | undefined,
  webId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...queryKey(organizationId ?? ""), "lead-form-data-keys", webId ?? ""],
    enabled: Boolean(organizationId && webId) && (options?.enabled ?? true),
    queryFn: async () => {
      const data = await invokeManage({
        action: "getRecentLeadFormDataKeys",
        organizationId,
        web_id: webId,
      });
      return (data.keys ?? []) as string[];
    },
  });
}

export type LeadSubmissionPreviewRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone_number: string | null;
  notes: string | null;
  form_data: Record<string, unknown> | null;
  submitted_at: string | null;
};

export type LeadSubmissionPreviewBundle = {
  submission: LeadSubmissionPreviewRow | null;
  formDataKeys: string[];
};

export function useLatestLeadSubmissionForPreview(
  organizationId: string | null | undefined,
  webId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...queryKey(organizationId ?? ""), "lead-submission-preview", webId ?? ""],
    enabled: Boolean(organizationId && webId) && (options?.enabled ?? true),
    queryFn: async (): Promise<LeadSubmissionPreviewBundle> => {
      const empty: LeadSubmissionPreviewBundle = { submission: null, formDataKeys: [] };
      try {
        const data = await invokeManage({
          action: "getLatestLeadSubmissionForPreview",
          organizationId,
          web_id: webId,
        });
        const submission = (data.submission ?? null) as LeadSubmissionPreviewRow | null;
        const fromApi = (data.form_data_keys ?? []) as string[];
        return {
          submission,
          formDataKeys: fromApi.length > 0 ? fromApi : [],
        };
      } catch {
        return empty;
      }
    },
  });
}

export function useUpsertLeadTemplateMapping(organizationId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      web_id: string;
      template_name: string;
      template_language: string;
      parameter_mapping: Record<string, string>;
    }) => invokeManage({ action: "upsertLeadTemplateMapping", organizationId, ...payload }),
    onSuccess: (_data, variables) => {
      if (!organizationId) return;
      void qc.invalidateQueries({
        queryKey: leadMappingQueryKey(
          organizationId,
          variables.web_id,
          variables.template_name,
          variables.template_language,
        ),
      });
    },
  });
}

export function usePreviewLeadTemplateMapping(organizationId: string | null | undefined) {
  return useMutation({
    mutationFn: (payload: {
      web_id: string;
      template_name: string;
      template_language: string;
      parameter_mapping: Record<string, string>;
      lead_submission_id?: string;
    }) => invokeManage({ action: "previewLeadTemplateMapping", organizationId, ...payload }),
  });
}

export function useSuggestLeadTemplateMapping(organizationId: string | null | undefined) {
  return useMutation({
    mutationFn: (payload: {
      web_id: string;
      template_name: string;
      template_language: string;
    }) => invokeManage({ action: "suggestLeadTemplateMapping", organizationId, ...payload }),
  });
}

export function buildSdkSnippet(apiBase: string, token: string): string {
  const base = apiBase.replace(/\/$/, "");
  return `<script>
  window.SynckerjaConfig = {
    apiBase: '${base}',
    token: '${token}',
  };
</script>
<!-- Salin SDK lengkap dari tab Dokumentasi -->`;
}

export function getDefaultApiBaseUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) return "https://YOUR_PROJECT.supabase.co/functions/v1/omnichannel-public-api";
  return `${url.replace(/\/$/, "")}/functions/v1/omnichannel-public-api`;
}

export type OmnichannelTokenExpiryState = "none" | "active" | "expired";

export function getOmnichannelTokenExpiryState(
  expiresAt: string | null | undefined,
): OmnichannelTokenExpiryState {
  if (!expiresAt) return "none";
  const ts = new Date(expiresAt).getTime();
  if (!Number.isFinite(ts)) return "none";
  return ts < Date.now() ? "expired" : "active";
}

export function isOmnichannelTokenCurrentlyActive(tok: OmnichannelApiTokenRow): boolean {
  if (!tok.is_active) return false;
  return getOmnichannelTokenExpiryState(tok.expires_at) !== "expired";
}

export function getOmnichannelTokenDisplayStatus(
  tok: OmnichannelApiTokenRow,
): OmnichannelTokenDisplayStatus {
  if (!tok.is_active) return "revoked";
  if (getOmnichannelTokenExpiryState(tok.expires_at) === "expired") return "expired";
  return "active";
}

export function sortOmnichannelApiTokensForDisplay(
  tokens: OmnichannelApiTokenRow[],
): OmnichannelApiTokenRow[] {
  return [...tokens].sort((a, b) => {
    const aActive = isOmnichannelTokenCurrentlyActive(a);
    const bActive = isOmnichannelTokenCurrentlyActive(b);
    if (aActive !== bActive) return aActive ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function countActiveTokensForWebId(
  tokens: OmnichannelApiTokenRow[],
  webId: string,
): number {
  const normalized = webId.trim().toLowerCase();
  return tokens.filter((t) => t.web_id === normalized && isOmnichannelTokenCurrentlyActive(t)).length;
}

export function normalizeOmnichannelTokenType(
  value: string | null | undefined,
): OmnichannelApiTokenType {
  if (value === "sdk" || value === "server" || value === "legacy_full") return value;
  return "legacy_full";
}
