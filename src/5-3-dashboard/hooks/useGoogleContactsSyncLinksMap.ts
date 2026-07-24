import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import type { NewLead } from "@/shared/types/leads";

export type GoogleContactsSyncLinkRecord = {
  status: "pending" | "synced" | "failed" | "skipped";
  last_error: string | null;
};

const UUID_RE = /^[0-9a-f-]{36}$/i;

function resolveCrmLeadId(lead: NewLead, ticketToLeadId: ReadonlyMap<string, string>): string | null {
  const id = String(lead.id ?? "").trim();
  if (UUID_RE.test(id)) return id;
  const tid = (lead.ticket_id ?? "").trim().toUpperCase();
  if (!tid) return null;
  return ticketToLeadId.get(tid) ?? null;
}

export function useGoogleContactsSyncLinksMap(
  organizationId: string | null | undefined,
  leads: NewLead[],
) {
  const ticketToLeadId = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of leads) {
      const id = String(l.id ?? "").trim();
      if (!UUID_RE.test(id)) continue;
      const tid = (l.ticket_id ?? "").trim().toUpperCase();
      if (tid) m.set(tid, id);
    }
    return m;
  }, [leads]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["google-contacts-sync-links", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("lead_google_contact_links")
        .select("lead_id, sync_status, last_error")
        .eq("organization_id", organizationId);
      if (error) throw error;
      return (data ?? []) as Array<{
        lead_id: string;
        sync_status: string;
        last_error: string | null;
      }>;
    },
    enabled: Boolean(organizationId),
    staleTime: 30_000,
  });

  const byLeadId = useMemo(() => {
    const m = new Map<string, GoogleContactsSyncLinkRecord>();
    for (const r of rows) {
      const status = r.sync_status;
      if (
        status !== "pending" &&
        status !== "synced" &&
        status !== "failed" &&
        status !== "skipped"
      ) {
        continue;
      }
      m.set(String(r.lead_id), {
        status,
        last_error: r.last_error,
      });
    }
    return m;
  }, [rows]);

  const getSyncForLead = useCallback(
    (lead: NewLead): GoogleContactsSyncLinkRecord | null => {
      const leadId = resolveCrmLeadId(lead, ticketToLeadId);
      if (!leadId) return null;
      return byLeadId.get(leadId) ?? null;
    },
    [byLeadId, ticketToLeadId],
  );

  return { getSyncForLead, isLoading };
}
