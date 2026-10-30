import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { listMetaContentAccounts } from "../metaContentAuth.ts";
import { LEAD_MAGNET_DEFAULT_MESSAGES } from "./types.ts";
import {
  buildLeadMagnetAssetPublicUrl,
  LEAD_MAGNET_ASSETS_BUCKET,
  LEAD_MAGNET_DELIVERY_MAX_BYTES,
} from "./deliveryAsset.ts";
import { normalizeClaudeModel, renderOutlinePdf, requestMaterialOutline } from "./claudeMaterial.ts";
import {
  fallbackCommentReplies,
  frameworkOfferText,
  resolveLeadMagnetAccountChoice,
  sanitizePdfFileName,
} from "./executionDraft.ts";

export type PrepareFromExecutionBody = {
  social_media_plan_id?: unknown;
  name?: unknown;
  offer?: unknown;
  comment?: unknown;
  trigger?: unknown;
  pillar_name?: unknown;
  development?: unknown;
  instagram_account_id?: unknown;
  facebook_account_id?: unknown;
};

export type PrepareFromExecutionResult = {
  status: number;
  body: Record<string, unknown>;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

async function pdfUsageCount(
  admin: SupabaseClient,
  organizationId: string,
  usageDate: string,
): Promise<number> {
  const { data } = await admin
    .from("claude_pdf_daily_usage")
    .select("count")
    .eq("organization_id", organizationId)
    .eq("usage_date", usageDate)
    .maybeSingle();
  return Number((data as { count?: number } | null)?.count ?? 0);
}

async function recordPdfUse(
  admin: SupabaseClient,
  organizationId: string,
  usageDate: string,
): Promise<void> {
  const { error } = await admin.from("claude_pdf_daily_usage").insert({
    organization_id: organizationId,
    usage_date: usageDate,
    count: 1,
  });
  if (!error) return;
  if (!/duplicate|unique/i.test(error.message)) throw error;
  const current = await pdfUsageCount(admin, organizationId, usageDate);
  await admin
    .from("claude_pdf_daily_usage")
    .update({ count: current + 1, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("usage_date", usageDate);
}

export async function prepareLeadMagnetFromExecution(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
  raw: PrepareFromExecutionBody,
  supabaseUrl: string,
): Promise<PrepareFromExecutionResult> {
  const planId = text(raw.social_media_plan_id);
  const offer = text(raw.offer);
  const comment = text(raw.comment);
  const trigger = text(raw.trigger);
  const pillarName = text(raw.pillar_name);
  const development = text(raw.development);
  const name = text(raw.name).slice(0, 180) || offer.slice(0, 180);
  if (!planId || !offer || !name) {
    return { status: 400, body: { error: "plan, name, and offer are required" } };
  }

  const { data: plan, error: planError } = await admin
    .from("social_media_plans")
    .select("id")
    .eq("id", planId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (planError) return { status: 500, body: { error: planError.message } };
  if (!plan) return { status: 404, body: { error: "Plan not found" } };

  if (!comment) {
    return {
      status: 200,
      body: {
        ok: true,
        plan_id: planId,
        campaign_id: null,
        file: "none",
        code: "missing_comment",
      },
    };
  }

  const listed = await listMetaContentAccounts(admin, organizationId);
  const choice = resolveLeadMagnetAccountChoice(
    listed
      .filter((account) => account.platform === "instagram" || account.platform === "facebook")
      .map((account) => ({
        platform: account.platform,
        account_id: account.account_id,
        label: account.account_label,
        granted_scopes: account.granted_scopes,
      })),
    {
      instagram: text(raw.instagram_account_id),
      facebook: text(raw.facebook_account_id),
    },
  );
  const accountLists = { instagram: choice.instagram, facebook: choice.facebook };
  if (choice.invalidSelection) {
    return { status: 400, body: { error: "Selected account cannot run Lead Magnet", ...accountLists } };
  }
  if (choice.needsChoice) {
    return {
      status: 200,
      body: {
        ok: true,
        plan_id: planId,
        campaign_id: null,
        file: "none",
        code: "choose_account",
        ...accountLists,
        instagram_account_id: choice.instagramId,
        facebook_account_id: choice.facebookId,
      },
    };
  }
  const accounts = choice.chosen;
  if (accounts.length === 0) {
    return {
      status: 200,
      body: {
        ok: true,
        plan_id: planId,
        campaign_id: null,
        file: "none",
        code: "missing_account",
        ...accountLists,
      },
    };
  }

  const replies = fallbackCommentReplies(offer);
  const offerText = frameworkOfferText(offer);
  const legacy = accounts[0];
  const draftFields = {
    name,
    keyword: comment,
    target_market: "",
    platform: legacy.platform,
    account_id: legacy.account_id,
    comment_reply_enabled: true,
    comment_reply_texts: replies,
    comment_reply_text: replies[0],
    follow_gate_text: LEAD_MAGNET_DEFAULT_MESSAGES.follow_gate_text,
    follow_button_label: LEAD_MAGNET_DEFAULT_MESSAGES.follow_button_label,
    framework_offer_text: offerText,
    framework_button_label: LEAD_MAGNET_DEFAULT_MESSAGES.framework_button_label,
    delivery_text: LEAD_MAGNET_DEFAULT_MESSAGES.delivery_text,
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: existingError } = await admin
    .from("lead_magnet_campaigns")
    .select("id, delivery_storage_path")
    .eq("organization_id", organizationId)
    .eq("social_media_plan_id", planId)
    .maybeSingle();
  if (existingError) return { status: 500, body: { error: existingError.message } };

  let campaignId = existing?.id ? String(existing.id) : "";
  if (campaignId) {
    const { error } = await admin
      .from("lead_magnet_campaigns")
      .update(draftFields)
      .eq("id", campaignId)
      .eq("organization_id", organizationId);
    if (error) return { status: 500, body: { error: error.message } };
  } else {
    const { data: inserted, error } = await admin
      .from("lead_magnet_campaigns")
      .insert({
        ...draftFields,
        organization_id: organizationId,
        social_media_plan_id: planId,
        status: "draft",
        delivery_mode: "link",
        delivery_url: "",
        delivery_button_label: LEAD_MAGNET_DEFAULT_MESSAGES.delivery_button_label,
        skip_follow_gate_if_follower: true,
        skip_material_offer: false,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) {
      const raced = /duplicate|unique/i.test(error.message);
      if (!raced) return { status: 500, body: { error: error.message } };
      const { data: again, error: againError } = await admin
        .from("lead_magnet_campaigns")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("social_media_plan_id", planId)
        .maybeSingle();
      if (againError || !again?.id) return { status: 500, body: { error: error.message } };
      campaignId = String(again.id);
      const { error: updateError } = await admin
        .from("lead_magnet_campaigns")
        .update(draftFields)
        .eq("id", campaignId)
        .eq("organization_id", organizationId);
      if (updateError) return { status: 500, body: { error: updateError.message } };
    } else {
      campaignId = String((inserted as { id: string }).id);
    }
  }

  await admin.from("lead_magnet_campaign_accounts").delete().eq("campaign_id", campaignId);
  const { error: accountError } = await admin.from("lead_magnet_campaign_accounts").insert(
    accounts.map((account) => ({
      campaign_id: campaignId,
      platform: account.platform,
      account_id: account.account_id,
    })),
  );
  if (accountError) return { status: 500, body: { error: accountError.message, campaign_id: campaignId } };

  const stopped = (code: string, file: "skipped" | "failed", detail?: string) => ({
    status: 200,
    body: {
      ok: true,
      plan_id: planId,
      campaign_id: campaignId,
      file,
      code,
      ...(detail ? { message: detail.slice(0, 240) } : {}),
    },
  });

  const { data: config } = await admin
    .from("organization_script_ai_config")
    .select("claude_api_key, claude_api_key_configured, claude_model, claude_pdf_daily_limit")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const claudeKey = text((config as { claude_api_key?: string | null } | null)?.claude_api_key);
  const configured = (config as { claude_api_key_configured?: boolean } | null)?.claude_api_key_configured === true;
  if (!configured || !claudeKey) return stopped("missing_claude_key", "skipped");

  const limit = Number((config as { claude_pdf_daily_limit?: number } | null)?.claude_pdf_daily_limit ?? 20);
  const usageDate = new Date().toISOString().slice(0, 10);
  const used = await pdfUsageCount(admin, organizationId, usageDate);
  if (used >= (Number.isFinite(limit) ? limit : 20)) return stopped("pdf_limit", "skipped");

  const model = normalizeClaudeModel((config as { claude_model?: string | null } | null)?.claude_model);
  let outline;
  try {
    const attempt = await requestMaterialOutline({
      apiKey: claudeKey,
      model,
      offer,
      trigger,
      pillarName,
      development,
    });
    if (!attempt.outline) return stopped("outline_rejected", "failed", attempt.reason);
    outline = attempt.outline;
  } catch (err) {
    const detail = err instanceof Error ? err.message : "outline failed";
    console.error("[lead-magnet] outline failed", detail);
    return stopped("pdf_failed", "failed", detail);
  }

  if (outline.replies) {
    await admin
      .from("lead_magnet_campaigns")
      .update({
        comment_reply_texts: outline.replies,
        comment_reply_text: outline.replies[0],
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId);
  }

  let bytes: Uint8Array;
  try {
    bytes = await renderOutlinePdf({ apiKey: claudeKey, model, outline });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "pdf failed";
    console.error("[lead-magnet] pdf failed", detail);
    return stopped("pdf_failed", "failed", detail);
  }
  if (bytes.byteLength > LEAD_MAGNET_DELIVERY_MAX_BYTES) {
    return stopped("pdf_failed", "failed", "PDF is larger than the delivery limit");
  }

  const storagePath = `${organizationId}/${campaignId}/${crypto.randomUUID()}_${sanitizePdfFileName(offer)}`;
  const { error: uploadError } = await admin.storage
    .from(LEAD_MAGNET_ASSETS_BUCKET)
    .upload(storagePath, new Blob([bytes], { type: "application/pdf" }), {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadError) return stopped("pdf_failed", "failed", uploadError.message);

  const publicUrl = buildLeadMagnetAssetPublicUrl(supabaseUrl, storagePath);
  const fileName = sanitizePdfFileName(offer);
  const { error: deliveryError } = await admin
    .from("lead_magnet_campaigns")
    .update({
      delivery_mode: "upload",
      delivery_storage_path: storagePath,
      delivery_file_name: fileName,
      delivery_file_mime: "application/pdf",
      delivery_file_size_bytes: bytes.byteLength,
      delivery_url: publicUrl,
      delivery_button_label: outline.buttonLabel,
      delivery_links: [{ label: outline.buttonLabel, url: publicUrl }],
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .eq("organization_id", organizationId);
  if (deliveryError) return stopped("pdf_failed", "failed", deliveryError.message);

  const previousPath = text((existing as { delivery_storage_path?: string | null } | null)?.delivery_storage_path);
  if (previousPath && previousPath !== storagePath) {
    await admin.storage.from(LEAD_MAGNET_ASSETS_BUCKET).remove([previousPath]);
  }

  try {
    await recordPdfUse(admin, organizationId, usageDate);
  } catch (err) {
    console.error("[lead-magnet] pdf usage", err instanceof Error ? err.message : err);
  }

  return {
    status: 200,
    body: {
      ok: true,
      plan_id: planId,
      campaign_id: campaignId,
      file: "ready",
      code: null,
    },
  };
}
