import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { TemplateListResponse } from "../types";

async function fetchPage(after: string | undefined): Promise<TemplateListResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  const params = new URLSearchParams({ limit: "50" });
  if (after) params.set("after", after);
  const url = `${SUPABASE_URL}/functions/v1/whatsapp-message-templates?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof json?.error === "string" ? json.error : "Failed to load templates";
    const err = new Error(msg) as Error & { code?: string };
    if (typeof json?.code === "string") err.code = json.code;
    throw err;
  }
  return json as TemplateListResponse;
}

export function useWhatsAppMessageTemplates() {
  const { organizationId } = useCurrentOrg();
  return useInfiniteQuery({
    queryKey: ["whatsapp-message-templates", organizationId],
    enabled: !!organizationId,
    initialPageParam: "" as string,
    queryFn: ({ pageParam }) => fetchPage(pageParam || undefined),
    getNextPageParam: (last) => {
      const after = last.paging?.cursors?.after;
      return after && after.length > 0 ? after : undefined;
    },
  });
}
