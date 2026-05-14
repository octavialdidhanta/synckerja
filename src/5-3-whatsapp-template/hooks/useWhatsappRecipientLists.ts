import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import { buildRecipientPickerCandidates, type RecipientPickerCandidate } from "@/5-3-whatsapp-template/utils/buildRecipientPickerCandidates";
import {
  enrichRecipientListMembers,
  type LeadProfileLite,
  type LeadRowLite,
  type MemberRowLite,
  type RecipientListMemberViewRow,
  type WaConvLite,
} from "@/5-3-whatsapp-template/utils/enrichRecipientListMembers";
import {
  RECIPIENT_IMPORT_ERROR_SUMMARY_CAP,
  type RecipientImportFailure,
  type RecipientImportValidRow,
} from "@/5-3-whatsapp-template/utils/parseRecipientImportFile";

const LISTS_KEY = "whatsapp_recipient_lists";
const PICKER_KEY = "whatsapp_recipient_picker_candidates";
const DETAIL_KEY = "whatsapp_recipient_list_detail";
const ORG_OWNER_KEY = "api_current_user_is_active_org_owner";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function useActiveOrgOwnerRpc(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: [ORG_OWNER_KEY, organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("api_current_user_is_active_org_owner");
      if (error) throw error;
      return Boolean(data);
    },
    staleTime: 60_000,
  });
}

export function useRecipientPickerCandidates(organizationId: string | null | undefined, queryEnabled = true) {
  return useQuery({
    queryKey: [PICKER_KEY, organizationId],
    enabled: Boolean(organizationId) && queryEnabled,
    queryFn: async (): Promise<RecipientPickerCandidate[]> => {
      const orgId = organizationId as string;

      const [leadsRes, convRes] = await Promise.all([
        supabase
          .from("leads")
          .select("id, ticket_id, client, source, phone_number, organization_id")
          .eq("organization_id", orgId),
        supabase
          .from("whatsapp_conversations")
          .select("id, ticket_id, organization_id, customer_wa_id, customer_name, channel")
          .eq("organization_id", orgId),
      ]);

      if (leadsRes.error) throw leadsRes.error;
      if (convRes.error) throw convRes.error;

      const leads = leadsRes.data ?? [];
      const conversations = (convRes.data ?? []).filter((c) => (c.channel ?? "whatsapp").toLowerCase() !== "instagram");

      const leadIdSet = new Set(leads.map((l) => l.id));

      /** Avoid huge `.in()` filters (PostgREST URL limits); scope by org then narrow in memory. */
      let leadProfiles: {
        lead_id: string;
        phone_number: string | null;
        contact_phone: string | null;
        updated_at: string | null;
      }[] = [];

      if (leadIdSet.size > 0) {
        const { data: profData, error: profErr } = await supabase
          .from("lead_client_profiles")
          .select("lead_id, phone_number, contact_phone, updated_at")
          .eq("organization_id", orgId);
        if (profErr) throw profErr;
        leadProfiles = (profData ?? []).filter((p) => leadIdSet.has(p.lead_id));
      }

      /** WA profile `phone_number` is optional in DB (migration may be missing); numbers use `customer_wa_id` on conversations. */
      const waClientProfiles: { conversation_id: string; phone_number: string | null }[] = [];

      return buildRecipientPickerCandidates({
        leads,
        leadProfiles,
        conversations,
        waClientProfiles,
      });
    },
    staleTime: 30_000,
    retry: 1,
  });
}

export type WhatsappRecipientListRow = {
  id: string;
  name: string;
  channel: string;
  creation_source: "crm_select" | "file_upload";
  upload_status: "draft" | "processing" | "completed" | "failed";
  created_at: string;
  contact_count: number;
};

export function useWhatsappRecipientLists(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: [LISTS_KEY, organizationId],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<WhatsappRecipientListRow[]> => {
      const orgId = organizationId as string;
      const { data: lists, error: listsErr } = await supabase
        .from("whatsapp_recipient_lists")
        .select("id, name, channel, creation_source, upload_status, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      if (listsErr) throw listsErr;
      if (!lists?.length) return [];

      const { data: members, error: memErr } = await supabase
        .from("whatsapp_recipient_list_members")
        .select("list_id")
        .eq("organization_id", orgId);
      if (memErr) throw memErr;

      const countByList = new Map<string, number>();
      for (const m of members ?? []) {
        const lid = m.list_id as string;
        countByList.set(lid, (countByList.get(lid) ?? 0) + 1);
      }

      return lists.map((l) => ({
        id: l.id,
        name: l.name,
        channel: l.channel ?? "whatsapp",
        creation_source: (l.creation_source ?? "crm_select") as "crm_select" | "file_upload",
        upload_status: (l.upload_status ?? "completed") as WhatsappRecipientListRow["upload_status"],
        created_at: l.created_at,
        contact_count: countByList.get(l.id) ?? 0,
      }));
    },
    staleTime: 15_000,
  });
}

export function useCreateRecipientListFromSelection(organizationId: string | null | undefined) {
  const qc = useQueryClient();
  const orgId = organizationId ?? null;

  return useMutation({
    mutationFn: async (args: { name: string; picks: RecipientPickerCandidate[] }) => {
      if (!orgId) throw new Error("Missing organization");
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const uid = user?.id;
      if (!uid) throw new Error("Not authenticated");

      const name = args.name.trim();
      if (!name) throw new Error("Name required");

      const { data: list, error: insErr } = await supabase
        .from("whatsapp_recipient_lists")
        .insert({
          organization_id: orgId,
          name: name.slice(0, 120),
          channel: "whatsapp",
          creation_source: "crm_select",
          upload_status: "completed",
          created_by: uid,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      const listId = list.id as string;

      const rows = args.picks.map((p) => ({
        list_id: listId,
        organization_id: orgId,
        phone_normalized: p.phoneKey,
        lead_id: p.lead_id,
        conversation_id: p.conversation_id,
        origin: p.lead_id ? "lead" : "livechat",
      }));

      for (const part of chunk(rows, 500)) {
        const { error: mErr } = await supabase.from("whatsapp_recipient_list_members").insert(part);
        if (mErr) throw mErr;
      }

      return listId;
    },
    onSuccess: () => {
      if (orgId) qc.invalidateQueries({ queryKey: [LISTS_KEY, orgId] });
      qc.invalidateQueries({ queryKey: [PICKER_KEY, orgId] });
    },
  });
}

export type CreateRecipientListFileUploadArgs = {
  name: string;
  originalFileName: string;
  rowCountExpected: number;
  validRows: RecipientImportValidRow[];
  failures: RecipientImportFailure[];
};

export function useCreateRecipientListFromFileUpload(organizationId: string | null | undefined) {
  const qc = useQueryClient();
  const orgId = organizationId ?? null;

  return useMutation({
    mutationFn: async (args: CreateRecipientListFileUploadArgs) => {
      if (!orgId) throw new Error("Missing organization");
      if (!args.validRows.length) throw new Error("NO_VALID_ROWS");

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const uid = user?.id;
      if (!uid) throw new Error("Not authenticated");

      const name = args.name.trim();
      if (!name) throw new Error("Name required");

      const errorSummary = {
        failures: args.failures.slice(0, RECIPIENT_IMPORT_ERROR_SUMMARY_CAP),
        failedTotal: args.failures.length,
      };

      const safeFileName = args.originalFileName.trim().slice(0, 500) || "import.csv";

      const { data: list, error: insErr } = await supabase
        .from("whatsapp_recipient_lists")
        .insert({
          organization_id: orgId,
          name: name.slice(0, 120),
          channel: "whatsapp",
          creation_source: "file_upload",
          upload_status: "completed",
          created_by: uid,
          original_file_name: safeFileName,
          row_count_expected: args.rowCountExpected,
          row_count_imported: args.validRows.length,
          error_summary: errorSummary,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      const listId = list.id as string;

      const rows = args.validRows.map((r) => ({
        list_id: listId,
        organization_id: orgId,
        phone_normalized: r.phoneKey,
        lead_id: null,
        conversation_id: null,
        origin: "file" as const,
        import_full_name: r.import_full_name,
        import_customer_name: r.import_customer_name,
        import_company: r.import_company,
      }));

      try {
        for (const part of chunk(rows, 500)) {
          const { error: mErr } = await supabase.from("whatsapp_recipient_list_members").insert(part);
          if (mErr) throw mErr;
        }
      } catch (e) {
        await supabase.from("whatsapp_recipient_lists").delete().eq("id", listId).eq("organization_id", orgId);
        throw e;
      }

      return {
        listId,
        imported: args.validRows.length,
        failed: args.failures.length,
      };
    },
    onSuccess: () => {
      if (orgId) {
        qc.invalidateQueries({ queryKey: [LISTS_KEY, orgId] });
        qc.invalidateQueries({ queryKey: [DETAIL_KEY, orgId] });
      }
    },
  });
}

export function useInvalidateRecipientLists() {
  const qc = useQueryClient();
  return useCallback(
    (organizationId: string | null | undefined) => {
      if (organizationId) qc.invalidateQueries({ queryKey: [LISTS_KEY, organizationId] });
    },
    [qc],
  );
}

export function useDeleteWhatsappRecipientList(organizationId: string | null | undefined) {
  const qc = useQueryClient();
  const orgId = organizationId ?? null;

  return useMutation({
    mutationFn: async (listId: string) => {
      if (!orgId) throw new Error("Missing organization");
      const { error } = await supabase
        .from("whatsapp_recipient_lists")
        .delete()
        .eq("id", listId)
        .eq("organization_id", orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (orgId) {
        qc.invalidateQueries({ queryKey: [LISTS_KEY, orgId] });
        qc.invalidateQueries({ queryKey: [DETAIL_KEY, orgId] });
      }
    },
  });
}

export type WhatsappRecipientListDetailMeta = {
  id: string;
  name: string;
  channel: string;
  creation_source: string;
  upload_status: string;
  created_at: string;
};

export type WhatsappRecipientListDetailPayload = {
  list: WhatsappRecipientListDetailMeta;
  members: RecipientListMemberViewRow[];
  /** Same order as `members` — import columns for campaign slot mapping. */
  rawMembers: MemberRowLite[];
  memberTotal: number;
};

export function useWhatsappRecipientListDetail(organizationId: string | null | undefined, listId: string | undefined) {
  return useQuery({
    queryKey: [DETAIL_KEY, organizationId, listId],
    enabled: Boolean(organizationId && listId),
    queryFn: async (): Promise<WhatsappRecipientListDetailPayload | null> => {
      const orgId = organizationId as string;
      const lid = listId as string;

      const { data: list, error: listErr } = await supabase
        .from("whatsapp_recipient_lists")
        .select("id, name, channel, creation_source, upload_status, created_at, organization_id")
        .eq("id", lid)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (listErr) throw listErr;
      if (!list) return null;

      const { data: membersRaw, error: memErr } = await supabase
        .from("whatsapp_recipient_list_members")
        .select(
          "id, phone_normalized, lead_id, conversation_id, origin, import_full_name, import_customer_name, import_company",
        )
        .eq("list_id", lid)
        .eq("organization_id", orgId);
      if (memErr) throw memErr;

      const members: MemberRowLite[] = (membersRaw ?? []).map((m) => ({
        id: String(m.id),
        phone_normalized: String(m.phone_normalized ?? ""),
        lead_id: (m.lead_id as string | null) ?? null,
        conversation_id: (m.conversation_id as string | null) ?? null,
        origin: (m.origin as string | null) ?? null,
        import_full_name: (m.import_full_name as string | null) ?? null,
        import_customer_name: (m.import_customer_name as string | null) ?? null,
        import_company: (m.import_company as string | null) ?? null,
      }));

      const leadIds = [...new Set(members.map((m) => m.lead_id).filter((x): x is string => Boolean(x)))];
      const convIds = [...new Set(members.map((m) => m.conversation_id).filter((x): x is string => Boolean(x)))];

      const leads: LeadRowLite[] = [];
      for (const part of chunk(leadIds, 120)) {
        const { data, error } = await supabase
          .from("leads")
          .select("id, client, phone_number")
          .eq("organization_id", orgId)
          .in("id", part);
        if (error) throw error;
        leads.push(...((data ?? []) as LeadRowLite[]));
      }

      const profiles: LeadProfileLite[] = [];
      for (const part of chunk(leadIds, 120)) {
        const { data, error } = await supabase
          .from("lead_client_profiles")
          .select("lead_id, phone_number, contact_phone, updated_at")
          .eq("organization_id", orgId)
          .in("lead_id", part);
        if (error) throw error;
        profiles.push(...((data ?? []) as LeadProfileLite[]));
      }

      const conversations: WaConvLite[] = [];
      for (const part of chunk(convIds, 120)) {
        const { data, error } = await supabase
          .from("whatsapp_conversations")
          .select("id, customer_name, customer_wa_id")
          .eq("organization_id", orgId)
          .in("id", part);
        if (error) throw error;
        conversations.push(...((data ?? []) as WaConvLite[]));
      }

      const rows = enrichRecipientListMembers(members, leads, profiles, conversations);

      return {
        list: {
          id: String(list.id),
          name: String(list.name ?? ""),
          channel: String(list.channel ?? "whatsapp"),
          creation_source: String(list.creation_source ?? "crm_select"),
          upload_status: String(list.upload_status ?? "completed"),
          created_at: String(list.created_at ?? ""),
        },
        members: rows,
        rawMembers: members,
        memberTotal: members.length,
      };
    },
    staleTime: 15_000,
  });
}
