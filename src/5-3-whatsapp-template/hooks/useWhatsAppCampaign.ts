import { useEffect, useRef } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { MemberRowLite, RecipientListMemberViewRow } from "@/5-3-whatsapp-template/utils/enrichRecipientListMembers";
import { normalizeWaPhoneKey } from "@/5-3-whatsapp-template/utils/normalizeWaPhoneKey";
import { buildParameterValuesFromMapping } from "@/5-3-whatsapp-template/utils/campaignTemplateContent";
import type {
  TemplateParameterSlot,
  VariableMapping,
} from "@/5-3-whatsapp-template/utils/campaignTemplateContent";

export type WhatsAppCampaignRow = {
  id: string;
  organization_id: string;
  whatsapp_account_id: string;
  recipient_list_id: string;
  name: string;
  template_name: string;
  template_language: string;
  template_hsm_id: string | null;
  template_components_json: unknown;
  /** Slot index → mappable field key at create time. */
  parameter_mapping?: Record<string, string> | null;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  sent_count: number;
  /** Jumlah penerima dengan wa_delivery_status = read (Meta). Default 0 jika kolom DB belum dimigrasi. */
  read_count: number;
  failed_count: number;
  last_error: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

const CAMPAIGNS_LIST_KEY = "whatsapp-campaigns-list";

function normalizeCampaignReadCount<T extends { read_count?: unknown }>(row: T): T & { read_count: number } {
  const n = row.read_count;
  return {
    ...row,
    read_count: typeof n === "number" && !Number.isNaN(n) ? n : 0,
  };
}

type CampaignRecipientMemberEmbed = {
  origin?: string | null;
  import_full_name?: string | null;
  import_customer_name?: string | null;
  leads?: { client: string | null } | { client: string | null }[] | null;
  whatsapp_conversations?: { customer_name: string | null } | { customer_name: string | null }[] | null;
};

function e164DisplayFallback(e164: string): string {
  const d = String(e164 ?? "").replace(/\D/g, "");
  if (d.startsWith("62")) return `+${d}`;
  if (d.length > 0) return `+${d}`;
  return e164;
}

/** Matches list-detail naming: file import columns, else lead / live chat name, else phone display. */
function resolveCampaignRecipientDisplayName(
  phone_e164: string,
  member: CampaignRecipientMemberEmbed | null,
): string {
  const phoneFallback = e164DisplayFallback(phone_e164);
  if (!member) return phoneFallback;

  const isFile = String(member.origin ?? "").toLowerCase() === "file";
  const fileFull = String(member.import_full_name ?? "").trim();
  const fileCustomer = String(member.import_customer_name ?? "").trim();

  const leadRaw = member.leads;
  const lead = Array.isArray(leadRaw) ? leadRaw[0] : leadRaw;
  const convRaw = member.whatsapp_conversations;
  const conv = Array.isArray(convRaw) ? convRaw[0] : convRaw;

  const leadClient = String(lead?.client ?? "").trim();
  const convName = String(conv?.customer_name ?? "").trim();

  if (isFile) {
    return fileFull || fileCustomer || phoneFallback;
  }
  return leadClient || convName || phoneFallback;
}

/** Org-scoped campaign history (RLS). Refetches while any row is scheduled/queued/running. */
export function useWhatsAppCampaignsList(organizationId: string | null | undefined, queryEnabled: boolean) {
  const queryClient = useQueryClient();
  const campaignsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!organizationId || !queryEnabled) return;

    if (campaignsChannelRef.current) {
      supabase.removeChannel(campaignsChannelRef.current);
      campaignsChannelRef.current = null;
    }

    const channel = supabase
      .channel(`whatsapp_campaigns_org:${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_campaigns",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: [CAMPAIGNS_LIST_KEY, organizationId] });
        },
      );

    channel.subscribe();
    campaignsChannelRef.current = channel;

    return () => {
      if (campaignsChannelRef.current) {
        supabase.removeChannel(campaignsChannelRef.current);
        campaignsChannelRef.current = null;
      }
    };
  }, [organizationId, queryEnabled, queryClient]);

  return useQuery({
    queryKey: [CAMPAIGNS_LIST_KEY, organizationId],
    enabled: Boolean(organizationId) && queryEnabled,
    queryFn: async (): Promise<WhatsAppCampaignRow[]> => {
      // Pakai `*` agar tidak 400 jika migrasi `read_count` belum dijalankan di project (PostgREST menolak kolom tak ada).
      const { data, error } = await supabase
        .from("whatsapp_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((r) => normalizeCampaignReadCount(r as { read_count?: unknown })) as WhatsAppCampaignRow[];
    },
    refetchInterval: (q) => {
      const rows = q.state.data ?? [];
      const active = rows.some((r) => ["running", "queued", "scheduled"].includes(r.status));
      return active ? 4000 : false;
    },
  });
}

export function useWhatsAppCampaign(campaignId: string | null | undefined) {
  const { organizationId } = useCurrentOrg();
  return useQuery({
    queryKey: ["whatsapp-campaign", organizationId, campaignId],
    enabled: Boolean(organizationId && campaignId),
    queryFn: async (): Promise<WhatsAppCampaignRow | null> => {
      const { data, error } = await supabase
        .from("whatsapp_campaigns")
        .select("*")
        .eq("id", campaignId as string)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return normalizeCampaignReadCount(data as { read_count?: unknown }) as WhatsAppCampaignRow;
    },
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (s === "running" || s === "queued" || s === "scheduled") return 2500;
      return false;
    },
  });
}

export type WhatsAppCampaignRecipientRow = {
  id: string;
  phone_e164: string;
  /** Display name from list member (import / CRM / chat); aligns with recipient list preview. */
  recipient_name: string;
  send_status: string;
  /** Meta webhook lifecycle after Cloud API accept (sent → delivered → read). Null until first webhook. */
  wa_delivery_status: string | null;
  wa_delivery_status_at: string | null;
  wa_message_id: string | null;
  error_detail: string | null;
  attempt_count: number;
  created_at: string;
};

/** Per-recipient rows for campaign detail (RLS). */
export function useWhatsAppCampaignRecipients(campaignId: string | null | undefined) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!organizationId || !campaignId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`whatsapp_campaign_recipients:${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_campaign_recipients",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["whatsapp-campaign-recipients", organizationId, campaignId],
          });
          queryClient.invalidateQueries({ queryKey: [CAMPAIGNS_LIST_KEY, organizationId] });
          queryClient.invalidateQueries({ queryKey: ["whatsapp-campaign", organizationId, campaignId] });
        },
      );

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [organizationId, campaignId, queryClient]);

  return useQuery({
    queryKey: ["whatsapp-campaign-recipients", organizationId, campaignId],
    enabled: Boolean(organizationId && campaignId),
    queryFn: async (): Promise<WhatsAppCampaignRecipientRow[]> => {
      const { data, error } = await supabase
        .from("whatsapp_campaign_recipients")
        .select(
          `
          id,
          phone_e164,
          send_status,
          wa_delivery_status,
          wa_delivery_status_at,
          wa_message_id,
          error_detail,
          attempt_count,
          created_at,
          whatsapp_recipient_list_members (
            origin,
            import_full_name,
            import_customer_name,
            leads ( client ),
            whatsapp_conversations ( customer_name )
          )
        `,
        )
        .eq("campaign_id", campaignId as string)
        .order("created_at", { ascending: true });
      if (error) throw error;
      type Raw = {
        id: string;
        phone_e164: string;
        send_status: string;
        wa_delivery_status: string | null;
        wa_delivery_status_at: string | null;
        wa_message_id: string | null;
        error_detail: string | null;
        attempt_count: number;
        created_at: string;
        whatsapp_recipient_list_members: CampaignRecipientMemberEmbed | CampaignRecipientMemberEmbed[] | null;
      };
      return (data ?? []).map((row) => {
        const r = row as Raw;
        const m = r.whatsapp_recipient_list_members;
        const member = Array.isArray(m) ? (m[0] ?? null) : m;
        return {
          id: r.id,
          phone_e164: r.phone_e164,
          recipient_name: resolveCampaignRecipientDisplayName(r.phone_e164, member),
          send_status: r.send_status,
          wa_delivery_status: r.wa_delivery_status,
          wa_delivery_status_at: r.wa_delivery_status_at,
          wa_message_id: r.wa_message_id,
          error_detail: r.error_detail,
          attempt_count: r.attempt_count,
          created_at: r.created_at,
        };
      });
    },
    /** Pending blast masih pakai interval; status Meta (delivered/read) lewat Realtime + invalidate. */
    refetchInterval: (q) => {
      const rows = q.state.data ?? [];
      return rows.some((r) => r.send_status === "pending") ? 2500 : false;
    },
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });
}

export type CreateWhatsAppCampaignVariables = {
  name: string;
  whatsappAccountId: string;
  recipientListId: string;
  templateName: string;
  templateLanguage: string;
  templateHsmId: string | null;
  templateComponentsJson: unknown[];
  templateSlots: TemplateParameterSlot[];
  variableMapping: VariableMapping;
  parameterMappingJson: Record<string, string>;
  members: RecipientListMemberViewRow[];
  rawMembers: MemberRowLite[];
  sendMode: "now" | "later";
  scheduledAtUtcIso: string | null;
};

async function invokeProcessBatch(campaignId: string): Promise<{
  processed: number;
  campaign_status: string;
  pending_remaining: number;
  error?: string;
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-campaign-worker`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "process_batch", campaign_id: campaignId }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof json.error === "string" ? json.error : "Campaign send failed";
    throw new Error(msg);
  }
  return json as unknown as {
    processed: number;
    campaign_status: string;
    pending_remaining: number;
    error?: string;
  };
}

/** Calls `process_batch` until the campaign finishes or stalls (Edge timeout safety). */
export async function drainWhatsAppCampaignWorker(campaignId: string): Promise<void> {
  for (let i = 0; i < 120; i++) {
    const r = await invokeProcessBatch(campaignId);
    if (r.campaign_status === "completed" || r.campaign_status === "failed") return;
    if ((r.processed ?? 0) === 0 && (r.pending_remaining ?? 0) === 0) return;
    await new Promise((x) => setTimeout(x, 400));
  }
}

export function useCreateWhatsAppCampaign() {
  const qc = useQueryClient();
  const { organizationId } = useCurrentOrg();
  return useMutation({
    mutationFn: async (vars: CreateWhatsAppCampaignVariables): Promise<{ id: string }> => {
      if (!organizationId) throw new Error("No organization");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const recipientRows: Array<{
        campaign_id: string;
        list_member_id: string;
        organization_id: string;
        phone_e164: string;
        parameter_values: string[];
        send_status: string;
      }> = [];

      for (let i = 0; i < vars.members.length; i++) {
        const view = vars.members[i]!;
        const raw = vars.rawMembers[i]!;
        const key =
          normalizeWaPhoneKey(view.phoneDisplay) ?? normalizeWaPhoneKey(raw.phone_normalized);
        if (!key) continue;
        const params = buildParameterValuesFromMapping(
          vars.templateSlots,
          vars.variableMapping,
          view,
          raw,
        );
        recipientRows.push({
          campaign_id: "",
          list_member_id: view.id,
          organization_id: organizationId,
          phone_e164: key,
          parameter_values: params,
          send_status: "pending",
        });
      }
      if (recipientRows.length === 0) throw new Error("No valid phone numbers in recipient list");

      const scheduled =
        vars.sendMode === "later" && vars.scheduledAtUtcIso
          ? ({ status: "scheduled" as const, scheduled_at: vars.scheduledAtUtcIso } as const)
          : ({ status: "queued" as const, scheduled_at: null } as const);

      const { data: camp, error: cErr } = await supabase
        .from("whatsapp_campaigns")
        .insert({
          organization_id: organizationId,
          whatsapp_account_id: vars.whatsappAccountId,
          recipient_list_id: vars.recipientListId,
          name: vars.name.trim(),
          template_name: vars.templateName.trim(),
          template_language: vars.templateLanguage.trim(),
          template_hsm_id: vars.templateHsmId,
          template_components_json: vars.templateComponentsJson,
          parameter_mapping: vars.parameterMappingJson,
          created_by: user.id,
          ...scheduled,
        })
        .select("id")
        .single();
      if (cErr || !camp) throw cErr ?? new Error("Insert campaign failed");
      const id = String((camp as { id: string }).id);
      const prefixed = recipientRows.map((r) => ({ ...r, campaign_id: id }));
      const { error: insR } = await supabase.from("whatsapp_campaign_recipients").insert(prefixed);
      if (insR) {
        await supabase.from("whatsapp_campaigns").delete().eq("id", id);
        throw insR;
      }
      if (scheduled.status === "queued") {
        await drainWhatsAppCampaignWorker(id);
      }
      return { id };
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["whatsapp-campaign", organizationId, data.id] });
      void qc.invalidateQueries({ queryKey: ["whatsapp-campaign-recipients", organizationId, data.id] });
      void qc.invalidateQueries({ queryKey: [CAMPAIGNS_LIST_KEY, organizationId] });
    },
  });
}
