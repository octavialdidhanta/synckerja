import { useQuery } from "@tanstack/react-query";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { TemplateListResponse } from "../types";

async function fetchTemplateByHsmId(hsmId: string, whatsappAccountId: string | null): Promise<TemplateListResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  const params = new URLSearchParams({ hsm_id: hsmId });
  if (whatsappAccountId) params.set("whatsapp_account_id", whatsappAccountId);
  const url = `${SUPABASE_URL}/functions/v1/whatsapp-message-templates?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof json?.error === "string" ? json.error : "Failed to load template from Meta";
    throw new Error(msg);
  }
  return json as TemplateListResponse;
}

/** Single-template read from Meta (Graph) — includes `components.example` when Meta returns it. */
export function useWhatsAppMessageTemplateByHsmId(opts: {
  hsmId: string | null;
  whatsappAccountId: string | null;
}) {
  const { organizationId } = useCurrentOrg();
  return useQuery({
    queryKey: ["whatsapp-message-template", organizationId, opts.whatsappAccountId, opts.hsmId],
    queryFn: () => fetchTemplateByHsmId(opts.hsmId!, opts.whatsappAccountId),
    enabled: Boolean(organizationId && opts.hsmId),
    staleTime: 60_000,
    refetchOnMount: true,
  });
}
