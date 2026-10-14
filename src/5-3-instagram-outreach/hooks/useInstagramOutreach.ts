import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  applyManualPaste,
  jakartaDayStartIso,
  normalizeInstagramUsername,
  OUTREACH_MAX_MATERIALS,
  type AudienceSource,
  type AudienceStatus,
  type ManualKind,
} from "@/5-3-instagram-outreach/lib/audience";
import {
  removeOutreachMaterialFiles,
  uploadOutreachMaterialFile,
} from "@/5-3-instagram-outreach/lib/uploadOutreachMaterial";

export type OutreachCampaign = {
  id: string;
  organization_id: string;
  instagram_business_account_id: string;
  name: string;
  competitor_username: string;
  last_synced_at: string | null;
  last_sync_error: string | null;
  created_at: string;
  target_count: number;
};

export type OutreachTarget = {
  id: string;
  organization_id: string;
  campaign_id: string;
  username: string;
  source: AudienceSource;
  manual_kind: ManualKind | null;
  comment_text: string | null;
  comment_id: string | null;
  media_permalink: string | null;
  status: AudienceStatus;
  copied_at: string | null;
  sent_at: string | null;
  replied_at: string | null;
  converted_at: string | null;
  lead_id: string | null;
};

export type OutreachMaterial = {
  id: string;
  organization_id: string;
  campaign_id: string;
  name: string;
  body: string;
  attachment_kind: "image" | "video" | null;
  storage_path: string | null;
  mime: string | null;
  file_name: string | null;
  sort_order: number;
};

export type ConnectedIgAccount = {
  instagram_business_account_id: string;
  instagram_username: string | null;
  instagram_name: string | null;
};

export type DiscoverSummary = {
  posts_scanned: number;
  comments_seen: number;
  usernames_added: number;
  usernames_updated: number;
  skipped_no_username: number;
  like_count_total: number;
};

const campaignKey = (organizationId: string | null) => ["instagram-outreach-campaigns", organizationId] as const;
const detailKey = (organizationId: string | null, campaignId: string | null) =>
  ["instagram-outreach-detail", organizationId, campaignId] as const;
const copiedKey = (organizationId: string | null) => ["instagram-outreach-copied-today", organizationId] as const;

type CampaignRow = Omit<OutreachCampaign, "target_count"> & {
  instagram_outreach_targets?: { count: number }[] | null;
};

function mapCampaign(row: CampaignRow): OutreachCampaign {
  const count = row.instagram_outreach_targets?.[0]?.count ?? 0;
  return {
    id: row.id,
    organization_id: row.organization_id,
    instagram_business_account_id: row.instagram_business_account_id,
    name: row.name,
    competitor_username: row.competitor_username,
    last_synced_at: row.last_synced_at,
    last_sync_error: row.last_sync_error,
    created_at: row.created_at,
    target_count: count,
  };
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) throw new Error("auth");
  return data.user.id;
}

export function useConnectedInstagramAccounts(organizationId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["instagram-outreach-accounts", organizationId],
    enabled: Boolean(organizationId) && enabled,
    queryFn: async (): Promise<ConnectedIgAccount[]> => {
      const { data, error } = await supabase
        .from("organization_instagram_accounts")
        .select("instagram_business_account_id, instagram_username, instagram_name")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ConnectedIgAccount[];
    },
  });
}

export function useInstagramOutreachCampaigns(organizationId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: campaignKey(organizationId),
    enabled: Boolean(organizationId) && enabled,
    queryFn: async (): Promise<OutreachCampaign[]> => {
      const { data, error } = await supabase
        .from("instagram_outreach_campaigns")
        .select(
          "id, organization_id, instagram_business_account_id, name, competitor_username, last_synced_at, last_sync_error, created_at, instagram_outreach_targets(count)",
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as CampaignRow[]).map(mapCampaign);
    },
  });
}

export function useInstagramOutreachDetail(
  organizationId: string | null,
  campaignId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: detailKey(organizationId, campaignId),
    enabled: Boolean(organizationId) && Boolean(campaignId) && enabled,
    queryFn: async (): Promise<{ targets: OutreachTarget[]; materials: OutreachMaterial[] }> => {
      const [targetsRes, materialsRes] = await Promise.all([
        supabase
          .from("instagram_outreach_targets")
          .select(
            "id, organization_id, campaign_id, username, source, manual_kind, comment_text, comment_id, media_permalink, status, copied_at, sent_at, replied_at, converted_at, lead_id",
          )
          .eq("organization_id", organizationId)
          .eq("campaign_id", campaignId)
          .order("created_at", { ascending: false }),
        supabase
          .from("instagram_outreach_materials")
          .select(
            "id, organization_id, campaign_id, name, body, attachment_kind, storage_path, mime, file_name, sort_order",
          )
          .eq("organization_id", organizationId)
          .eq("campaign_id", campaignId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);
      if (targetsRes.error) throw targetsRes.error;
      if (materialsRes.error) throw materialsRes.error;
      return {
        targets: (targetsRes.data ?? []) as OutreachTarget[],
        materials: (materialsRes.data ?? []) as OutreachMaterial[],
      };
    },
  });
}

export function useOutreachCopiedToday(organizationId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: copiedKey(organizationId),
    enabled: Boolean(organizationId) && enabled,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("instagram_outreach_targets")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("copied_at", jakartaDayStartIso(new Date()));
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useInstagramOutreachMutations(organizationId: string | null) {
  const queryClient = useQueryClient();

  const invalidate = async (campaignId?: string | null) => {
    await queryClient.invalidateQueries({ queryKey: campaignKey(organizationId) });
    await queryClient.invalidateQueries({ queryKey: copiedKey(organizationId) });
    if (campaignId) {
      await queryClient.invalidateQueries({ queryKey: detailKey(organizationId, campaignId) });
    }
  };

  const createCampaign = useMutation({
    mutationFn: async (input: { name: string; competitorUsername: string; instagramBusinessAccountId: string }) => {
      if (!organizationId) throw new Error("organization");
      const competitor = normalizeInstagramUsername(input.competitorUsername);
      if (!competitor) throw new Error("username");
      const userId = await currentUserId();
      const { data, error } = await supabase
        .from("instagram_outreach_campaigns")
        .insert({
          organization_id: organizationId,
          instagram_business_account_id: input.instagramBusinessAccountId,
          name: input.name.trim(),
          competitor_username: competitor,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: async () => {
      await invalidate();
    },
  });

  const deleteCampaign = useMutation({
    mutationFn: async (campaignId: string) => {
      if (!organizationId) throw new Error("organization");
      const { data: materials, error: materialError } = await supabase
        .from("instagram_outreach_materials")
        .select("storage_path")
        .eq("organization_id", organizationId)
        .eq("campaign_id", campaignId);
      if (materialError) throw materialError;
      const paths = ((materials ?? []) as { storage_path: string | null }[])
        .map((row) => row.storage_path)
        .filter((path): path is string => Boolean(path));
      await removeOutreachMaterialFiles(paths);
      const { error } = await supabase
        .from("instagram_outreach_campaigns")
        .delete()
        .eq("id", campaignId)
        .eq("organization_id", organizationId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
    },
  });

  const syncCampaign = useMutation({
    mutationFn: async (campaignId: string): Promise<DiscoverSummary> => {
      if (!organizationId) throw new Error("organization");
      const { data, error } = await supabase.functions.invoke("instagram-outreach-discover", {
        body: { organization_id: organizationId, campaign_id: campaignId },
      });
      if (error) throw error;
      const payload = (data ?? {}) as { ok?: boolean; code?: string; detail?: string | null } & Partial<DiscoverSummary>;
      if (!payload.ok) {
        const code = payload.code ?? "META_ERROR";
        const err = new Error(payload.detail ? `${code}|${payload.detail}` : code);
        throw err;
      }
      return {
        posts_scanned: payload.posts_scanned ?? 0,
        comments_seen: payload.comments_seen ?? 0,
        usernames_added: payload.usernames_added ?? 0,
        usernames_updated: payload.usernames_updated ?? 0,
        skipped_no_username: payload.skipped_no_username ?? 0,
        like_count_total: payload.like_count_total ?? 0,
      };
    },
    onSettled: async (_data, _error, campaignId) => {
      await invalidate(campaignId);
    },
  });

  const pasteUsernames = useMutation({
    mutationFn: async (input: { campaignId: string; usernames: string[]; manualKind: ManualKind }) => {
      if (!organizationId) throw new Error("organization");
      const { data, error } = await supabase
        .from("instagram_outreach_targets")
        .select("id, username, source, manual_kind, status, comment_text, comment_id, media_permalink")
        .eq("organization_id", organizationId)
        .eq("campaign_id", input.campaignId);
      if (error) throw error;
      const existing = new Map(
        ((data ?? []) as OutreachTarget[]).map((row) => [row.username, row]),
      );
      const inserts: Record<string, unknown>[] = [];
      const updates: { username: string; manualKind: ManualKind }[] = [];
      for (const username of input.usernames) {
        const row = existing.get(username) ?? null;
        const next = applyManualPaste({
          existing: row
            ? {
              username: row.username,
              source: row.source,
              manualKind: row.manual_kind,
              status: row.status,
              commentText: row.comment_text,
              commentId: row.comment_id,
              mediaPermalink: row.media_permalink,
            }
            : null,
          username,
          manualKind: input.manualKind,
        });
        if (next.action === "insert") {
          inserts.push({
            organization_id: organizationId,
            campaign_id: input.campaignId,
            username: next.username,
            source: "manual",
            manual_kind: next.manualKind,
            status: "new",
          });
        } else {
          updates.push({ username: next.username, manualKind: next.manualKind });
        }
      }
      if (inserts.length > 0) {
        const { error: insertError } = await supabase.from("instagram_outreach_targets").insert(inserts);
        if (insertError) throw insertError;
      }
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from("instagram_outreach_targets")
          .update({ manual_kind: update.manualKind })
          .eq("organization_id", organizationId)
          .eq("campaign_id", input.campaignId)
          .eq("username", update.username);
        if (updateError) throw updateError;
      }
      return { added: inserts.length, updated: updates.length };
    },
    onSuccess: async (_data, input) => {
      await invalidate(input.campaignId);
    },
  });

  const markCopied = useMutation({
    mutationFn: async (target: OutreachTarget) => {
      if (!organizationId) throw new Error("organization");
      if (target.status !== "new") return;
      const { error } = await supabase
        .from("instagram_outreach_targets")
        .update({ status: "copied", copied_at: new Date().toISOString() })
        .eq("id", target.id)
        .eq("organization_id", organizationId)
        .eq("status", "new");
      if (error) throw error;
    },
    onSuccess: async (_data, target) => {
      await invalidate(target.campaign_id);
    },
  });

  const markStatus = useMutation({
    mutationFn: async (input: { target: OutreachTarget; status: "sent" | "replied" | "skipped" }) => {
      if (!organizationId) throw new Error("organization");
      const { target, status } = input;
      if (target.status === "converted") return;
      if (status === "sent" && target.status !== "new" && target.status !== "copied") return;
      if (status === "replied" && target.status !== "new" && target.status !== "copied" && target.status !== "sent") {
        return;
      }
      const patch: Record<string, string> = { status };
      if (status === "sent") patch.sent_at = new Date().toISOString();
      if (status === "replied") patch.replied_at = new Date().toISOString();
      const { error } = await supabase
        .from("instagram_outreach_targets")
        .update(patch)
        .eq("id", target.id)
        .eq("organization_id", organizationId);
      if (error) throw error;
    },
    onSuccess: async (_data, input) => {
      await invalidate(input.target.campaign_id);
    },
  });

  const attachLead = useMutation({
    mutationFn: async (input: { target: OutreachTarget; leadId: string }) => {
      if (!organizationId) throw new Error("organization");
      const { error } = await supabase
        .from("instagram_outreach_targets")
        .update({
          lead_id: input.leadId,
          status: "converted",
          converted_at: new Date().toISOString(),
        })
        .eq("id", input.target.id)
        .eq("organization_id", organizationId)
        .is("lead_id", null);
      if (error) throw error;
    },
    onSuccess: async (_data, input) => {
      await invalidate(input.target.campaign_id);
    },
  });

  const addMaterial = useMutation({
    mutationFn: async (input: {
      campaignId: string;
      name: string;
      body: string;
      file: File | null;
      existingCount: number;
    }) => {
      if (!organizationId) throw new Error("organization");
      if (input.existingCount >= OUTREACH_MAX_MATERIALS) throw new Error("limit");
      const userId = await currentUserId();
      const materialId = crypto.randomUUID();
      let uploaded: Awaited<ReturnType<typeof uploadOutreachMaterialFile>> | null = null;
      if (input.file) {
        uploaded = await uploadOutreachMaterialFile({
          organizationId,
          campaignId: input.campaignId,
          materialId,
          file: input.file,
        });
      }
      const { error } = await supabase.from("instagram_outreach_materials").insert({
        id: materialId,
        organization_id: organizationId,
        campaign_id: input.campaignId,
        name: input.name.trim(),
        body: input.body.trim(),
        attachment_kind: uploaded?.kind ?? null,
        storage_path: uploaded?.storagePath ?? null,
        mime: uploaded?.mime ?? null,
        file_name: uploaded?.fileName ?? null,
        sort_order: input.existingCount,
        created_by: userId,
      });
      if (error) {
        if (uploaded) await removeOutreachMaterialFiles([uploaded.storagePath]);
        throw error;
      }
    },
    onSuccess: async (_data, input) => {
      await invalidate(input.campaignId);
    },
  });

  const deleteMaterial = useMutation({
    mutationFn: async (material: OutreachMaterial) => {
      if (!organizationId) throw new Error("organization");
      if (material.storage_path) await removeOutreachMaterialFiles([material.storage_path]);
      const { error } = await supabase
        .from("instagram_outreach_materials")
        .delete()
        .eq("id", material.id)
        .eq("organization_id", organizationId);
      if (error) throw error;
    },
    onSuccess: async (_data, material) => {
      await invalidate(material.campaign_id);
    },
  });

  return {
    createCampaign,
    deleteCampaign,
    syncCampaign,
    pasteUsernames,
    markCopied,
    markStatus,
    attachLead,
    addMaterial,
    deleteMaterial,
  };
}
