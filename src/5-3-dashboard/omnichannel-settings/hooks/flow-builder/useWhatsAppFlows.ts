import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";
import { mapMetaFlowToRow } from "@/5-3-dashboard/omnichannel-settings/lib/flow-builder/mapMetaFlowToRow";
import type {
  FlowBuilderListingRow,
  MetaWhatsAppFlowApiRow,
} from "@/5-3-dashboard/omnichannel-settings/types/flowBuilder.types";

export const whatsAppFlowsQueryKey = (organizationId: string | null | undefined) =>
  ["whatsapp-flows", organizationId] as const;

async function fetchWhatsAppFlows(): Promise<MetaWhatsAppFlowApiRow[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const fields = encodeURIComponent("id,name,status,categories,updated_time");
  const url = `${SUPABASE_URL}/functions/v1/whatsapp-flows?fields=${fields}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    data?: MetaWhatsAppFlowApiRow[];
  };
  if (!res.ok) {
    throw new Error(typeof json.error === "string" ? json.error : "Failed to load WhatsApp flows");
  }
  return Array.isArray(json.data) ? json.data : [];
}

export function useWhatsAppFlows() {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: whatsAppFlowsQueryKey(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<FlowBuilderListingRow[]> => {
      const rows = await fetchWhatsAppFlows();
      return rows.map(mapMetaFlowToRow).filter((row) => row.id.length > 0);
    },
    staleTime: 30_000,
  });
}
