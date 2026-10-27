/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractMp4Audio } from "../_shared/mp4Audio.ts";
import { historyChargeFromItem, isUsageUuid, matchHistoryCharges, officialTokenCount, promptExcerpt, recordContentUsage, type HistoryCharge } from "../_shared/contentUsage.ts";
import { exactCreditCostFromHeader } from "../_shared/elevenLabsCredit.ts";
import { acceptTaggedNarration, narrationWithoutTags, resolveTaggedNarration, voiceModelSupportsAudioTags, withLanguageAccent } from "../_shared/voiceAudioTags.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const BUCKET = "brief-visual-images";
const STS_MODEL = "eleven_multilingual_sts_v2";
const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

type Admin = ReturnType<typeof createClient>;
type Json = (body: object, status?: number) => Response;

type VoiceConfig = {
  elevenlabs_api_key: string | null;
  api_key_configured: boolean;
  voice_id: string | null;
  tts_model: string | null;
  language_code: string | null;
  stability: number | null;
  similarity_boost: number | null;
  speed: number | null;
  daily_limit: number | null;
  auto_tag: boolean | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  const json: Json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice("Bearer ".length);
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Invalid token" }, 401);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    const orgId = profile?.active_organization_id ? String(profile.active_organization_id) : "";
    if (!orgId) return json({ error: "No active organization" }, 400);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (body.action === "sync") return await syncVoiceUsage(supabaseAdmin, orgId, String(body.planId ?? ""), json);
    if (body.action === "describe") return await describeVoice(supabaseAdmin, orgId, json);
    if (body.action === "tag") return await tagNarration(supabaseAdmin, orgId, userData.user.id, body, json);
    if (body.action === "tts") return await speakText(supabaseAdmin, orgId, userData.user.id, body, json);
    if (body.action === "sts") return await restyleVideo(supabaseAdmin, orgId, userData.user.id, body, json);
    if (body.action === "delete_clip") return await deleteVoiceClip(supabaseAdmin, orgId, userData.user.id, body, json);
    return json({ error: "Permintaan suara tidak dikenal" }, 400);
  } catch (error) {
    console.error("generate-brief-voice", error);
    return json({ error: error instanceof Error ? error.message : "Suara tidak bisa dibuat" }, 500);
  }
});

async function loadConfig(supabaseAdmin: Admin, orgId: string): Promise<VoiceConfig | null> {
  const { data } = await supabaseAdmin
    .from("organization_voice_ai_config")
    .select("elevenlabs_api_key, api_key_configured, voice_id, tts_model, language_code, stability, similarity_boost, speed, daily_limit, auto_tag")
    .eq("organization_id", orgId)
    .maybeSingle();
  return (data ?? null) as VoiceConfig | null;
}

function configured(config: VoiceConfig | null): { key: string; voiceId: string; model: string; language: string; stability: number; similarity: number; speed: number; limit: number; autoTag: boolean } | null {
  const key = String(config?.elevenlabs_api_key ?? "").trim();
  const voiceId = String(config?.voice_id ?? "").trim();
  if (!config?.api_key_configured || !key || !voiceId) return null;
  return {
    key,
    voiceId,
    model: String(config.tts_model ?? "").trim() || "eleven_v4",
    language: String(config.language_code ?? "").trim() || "id",
    stability: Number(config.stability ?? 0.5),
    similarity: Number(config.similarity_boost ?? 0.75),
    speed: Number(config.speed ?? 1),
    limit: Math.max(1, Number(config.daily_limit ?? 50)),
    autoTag: config.auto_tag !== false,
  };
}

function narrationBody(settings: { model: string; language: string; stability: number; similarity: number; speed: number }, text: string) {
  const voiceSettings: Record<string, number> = {
    stability: settings.stability,
    similarity_boost: settings.similarity,
  };
  if (settings.model !== "eleven_v4" && settings.model !== "eleven_v3") voiceSettings.speed = settings.speed;
  const payload: Record<string, unknown> = {
    text,
    model_id: settings.model,
    voice_settings: voiceSettings,
  };
  if (settings.model !== "eleven_multilingual_v2") payload.language_code = settings.language;
  return payload;
}

async function syncVoiceUsage(supabaseAdmin: Admin, orgId: string, planId: string, json: Json) {
  if (!isUsageUuid(planId)) return json({ error: "Content tidak ditemukan" }, 400);
  const { data: plan } = await supabaseAdmin
    .from("social_media_plans")
    .select("id, organization_id, pic_id")
    .eq("id", planId)
    .maybeSingle();
  if (!plan || plan.organization_id !== orgId) return json({ error: "Brief ini bukan milik organisasi aktif" }, 403);
  const picId = String(plan.pic_id ?? "").trim();
  const { data: pic } = picId
    ? await supabaseAdmin.from("employees").select("user_id").eq("id", picId).maybeSingle()
    : { data: null };
  const actorUserId = pic?.user_id && isUsageUuid(String(pic.user_id)) ? String(pic.user_id) : null;
  const settings = configured(await loadConfig(supabaseAdmin, orgId));
  if (!settings) return json({ error: "Voice AI belum dikonfigurasi. Buka Settings > Voice AI." }, 400);
  const { data: clips, error: clipError } = await supabaseAdmin
    .from("brief_voice_clips")
    .select("id, kind, row_index, spoken_text, credit_cost, created_at")
    .eq("social_media_plan_id", planId)
    .eq("organization_id", orgId);
  if (clipError) return json({ error: clipError.message }, 500);
  const clipRows = (clips ?? []) as Array<{ id: string; kind: string; row_index: number; spoken_text: string | null; credit_cost: number | null; created_at: string }>;
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("content_ai_usage")
    .select("id, source_id, usage_amount, actor_user_id")
    .eq("service", "voice")
    .eq("social_media_plan_id", planId);
  if (existingError) return json({ error: existingError.message }, 500);
  const bySource = new Map<string, { id: string; usage_amount: number | null; actor_user_id: string | null }>();
  for (const row of (existing ?? []) as Array<{ id: string; source_id: string | null; usage_amount: number | null; actor_user_id: string | null }>) {
    if (row.source_id) bySource.set(row.source_id, { id: row.id, usage_amount: row.usage_amount, actor_user_id: row.actor_user_id });
  }
  let history: HistoryCharge[] = [];
  try {
    history = await loadElevenHistory(settings.key, clipRows);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Riwayat ElevenLabs tidak bisa dibaca" }, 502);
  }
  const matches = matchHistoryCharges(
    clipRows.map((clip) => ({ id: clip.id, at: new Date(clip.created_at).getTime(), text: clip.spoken_text ?? "" })),
    history,
  );
  const matched = new Map(matches.map((match) => [match.clipId, match]));
  let added = 0;
  let priced = 0;
  for (const clip of clipRows) {
    const match = matched.get(clip.id);
    const stored = typeof clip.credit_cost === "number" ? clip.credit_cost : null;
    const amount = stored ?? match?.amount ?? null;
    const current = bySource.get(clip.id);
    if (!current) {
      const { error } = await supabaseAdmin.from("content_ai_usage").insert({
        organization_id: orgId,
        social_media_plan_id: planId,
        service: "voice",
        action: clip.kind === "seedance" ? "sts" : "vo",
        target_label: `Baris ${clip.row_index + 1}`,
        model: match?.model ?? null,
        usage_amount: amount,
        usage_unit: amount == null ? null : "character",
        status: "succeeded",
        provider_ref: match?.historyId ?? null,
        actor_user_id: actorUserId,
        source_id: clip.id,
        prompt_excerpt: promptExcerpt(clip.spoken_text),
        created_at: clip.created_at,
      });
      if (error) return json({ error: error.message }, 500);
      added += 1;
      if (amount != null) priced += 1;
      continue;
    }
    const patch: Record<string, unknown> = {};
    if (current.usage_amount == null && amount != null) {
      patch.usage_amount = amount;
      patch.usage_unit = "character";
      patch.model = match?.model ?? null;
      patch.provider_ref = match?.historyId ?? null;
    }
    if (!current.actor_user_id && actorUserId) patch.actor_user_id = actorUserId;
    if (Object.keys(patch).length === 0) continue;
    const { error } = await supabaseAdmin.from("content_ai_usage").update(patch).eq("id", current.id);
    if (error) return json({ error: error.message }, 500);
    if (patch.usage_amount != null) priced += 1;
  }
  return json({ ok: true, added, priced });
}

async function loadElevenHistory(
  key: string,
  clips: Array<{ created_at: string }>,
): Promise<HistoryCharge[]> {
  const oldest = clips.reduce((min, clip) => Math.min(min, new Date(clip.created_at).getTime()), Date.now()) - 30 * 60 * 1000;
  const charges: HistoryCharge[] = [];
  let startAfter = "";
  for (let page = 0; page < 5; page += 1) {
    const url = new URL("https://api.elevenlabs.io/v1/history");
    url.searchParams.set("page_size", "100");
    if (startAfter) url.searchParams.set("start_after_history_item_id", startAfter);
    const response = await fetch(url, { headers: { "xi-api-key": key } });
    if (!response.ok) throw new Error(await elevenError(response));
    const payload = await response.json().catch(() => ({})) as {
      history?: unknown[];
      has_more?: boolean;
      last_history_item_id?: string;
    };
    const items = Array.isArray(payload.history) ? payload.history : [];
    let pageOldest = Number.POSITIVE_INFINITY;
    for (const item of items) {
      const at = Number((item as { date_unix?: number }).date_unix) * 1000;
      if (Number.isFinite(at)) pageOldest = Math.min(pageOldest, at);
      const charge = historyChargeFromItem(item);
      if (charge) charges.push(charge);
    }
    if (!payload.has_more || !payload.last_history_item_id || pageOldest < oldest) break;
    startAfter = String(payload.last_history_item_id);
  }
  return charges;
}

async function describeVoice(supabaseAdmin: Admin, orgId: string, json: Json) {
  const settings = configured(await loadConfig(supabaseAdmin, orgId));
  if (!settings) return json({ error: "Isi API key dan Voice ID terlebih dahulu." }, 400);
  const response = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(settings.voiceId)}`, {
    headers: { "xi-api-key": settings.key },
  });
  if (!response.ok) return json({ error: await elevenError(response) }, response.status);
  const payload = await response.json().catch(() => ({})) as { name?: string };
  const voiceName = String(payload.name ?? "").trim() || settings.voiceId;
  await supabaseAdmin.from("organization_voice_ai_config").update({ voice_name: voiceName }).eq("organization_id", orgId);
  return json({ voiceName });
}

async function assertPic(supabaseAdmin: Admin, orgId: string, userId: string, planId: string, json: Json) {
  const { data: plan } = await supabaseAdmin
    .from("social_media_plans")
    .select("id, organization_id, pic_id")
    .eq("id", planId)
    .maybeSingle();
  if (!plan || plan.organization_id !== orgId) return { error: json({ error: "Brief ini bukan milik organisasi aktif" }, 403) };
  const picId = String(plan.pic_id ?? "").trim();
  const { data: employee } = picId
    ? await supabaseAdmin.from("employees").select("id").eq("id", picId).eq("user_id", userId).maybeSingle()
    : { data: null };
  if (!employee) return { error: json({ error: "Hanya PIC brief ini yang dapat membuat suara." }, 403) };
  return { planId };
}

async function reserveUsage(supabaseAdmin: Admin, orgId: string, limit: number, json: Json) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: usageRow } = await supabaseAdmin
    .from("voice_ai_daily_usage")
    .select("id, count")
    .eq("organization_id", orgId)
    .eq("usage_date", today)
    .maybeSingle();
  const count = usageRow?.count ?? 0;
  if (count >= limit) return { error: json({ error: `Batas harian suara tercapai (${limit} per hari).` }, 429) };
  return {
    commit: async () => {
      if (usageRow?.id) await supabaseAdmin.from("voice_ai_daily_usage").update({ count: count + 1 }).eq("id", usageRow.id);
      else await supabaseAdmin.from("voice_ai_daily_usage").insert({ organization_id: orgId, usage_date: today, count: 1 });
    },
  };
}

async function tagNarration(supabaseAdmin: Admin, orgId: string, userId: string, body: Record<string, unknown>, json: Json) {
  const planId = String(body.planId ?? "").trim();
  const text = narrationWithoutTags(String(body.text ?? ""));
  if (!planId || !text) return json({ error: "Narasi tidak lengkap" }, 400);
  if (text.length > 5000) return json({ error: "Narasi terlalu panjang." }, 400);
  const access = await assertPic(supabaseAdmin, orgId, userId, planId, json);
  if (access.error) return access.error;
  const settings = configured(await loadConfig(supabaseAdmin, orgId));
  if (!settings) return json({ error: "Voice AI belum dikonfigurasi. Buka Settings > Voice AI." }, 400);
  if (!settings.autoTag || !voiceModelSupportsAudioTags(settings.model)) return json({ text });
  const tagged = await autoTagNarration(supabaseAdmin, orgId, text);
  if ("error" in tagged) return json({ error: tagged.error }, 400);
  await recordContentUsage(supabaseAdmin, {
    organizationId: orgId,
    planId,
    actorUserId: userId,
    service: "script",
    action: "auto_tag",
    targetLabel: "Narasi",
    model: tagged.model,
    usageAmount: tagged.tokens,
    usageUnit: tagged.tokens == null ? null : "token",
    status: "succeeded",
    promptExcerpt: text,
  });
  return json({ text: tagged.text });
}

async function speakText(supabaseAdmin: Admin, orgId: string, userId: string, body: Record<string, unknown>, json: Json) {
  const planId = String(body.planId ?? "").trim();
  const rowIndex = Number(body.rowIndex);
  const text = String(body.text ?? "").trim();
  if (!planId || !Number.isInteger(rowIndex) || rowIndex < 0 || !text) return json({ error: "Narasi tidak lengkap" }, 400);
  if (text.length > 5000) return json({ error: "Narasi terlalu panjang." }, 400);
  const access = await assertPic(supabaseAdmin, orgId, userId, planId, json);
  if (access.error) return access.error;
  const settings = configured(await loadConfig(supabaseAdmin, orgId));
  if (!settings) return json({ error: "Voice AI belum dikonfigurasi. Buka Settings > Voice AI." }, 400);
  const plain = narrationWithoutTags(text);
  const existing = acceptTaggedNarration(plain, text);
  let narration = text;
  if (existing.ok) {
    narration = existing.text;
  } else if (settings.autoTag && voiceModelSupportsAudioTags(settings.model)) {
    const tagged = await autoTagNarration(supabaseAdmin, orgId, plain);
    if (!("error" in tagged)) {
      narration = tagged.text;
      await recordContentUsage(supabaseAdmin, {
        organizationId: orgId,
        planId,
        actorUserId: userId,
        service: "script",
        action: "auto_tag",
        targetLabel: `Baris ${rowIndex + 1}`,
        model: tagged.model,
        usageAmount: tagged.tokens,
        usageUnit: tagged.tokens == null ? null : "token",
        status: "succeeded",
        promptExcerpt: plain,
      });
    } else {
      console.error("generate-brief-voice auto-tag skipped", tagged.error);
    }
  }
  const usage = await reserveUsage(supabaseAdmin, orgId, settings.limit, json);
  if (usage.error) return usage.error;
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(settings.voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": settings.key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify(narrationBody(settings, withLanguageAccent(settings.model, settings.language, narration))),
  });
  if (!response.ok) return json({ error: await elevenError(response) }, response.status);
  const creditCost = exactCreditCostFromHeader(response.headers.get("character-cost"));
  const bytes = new Uint8Array(await response.arrayBuffer());
  const clip = await storeClip(supabaseAdmin, orgId, planId, { kind: "vo", rowIndex, videoId: null, bytes, spokenText: narration, creditCost });
  if (clip.error) return json({ error: clip.error }, 500);
  await recordContentUsage(supabaseAdmin, {
    organizationId: orgId,
    planId,
    actorUserId: userId,
    service: "voice",
    action: "vo",
    targetLabel: `Baris ${rowIndex + 1}`,
    model: settings.model,
    usageAmount: creditCost,
    usageUnit: creditCost == null ? null : "character",
    status: "succeeded",
    providerRef: response.headers.get("request-id"),
    sourceId: clip.row?.id ? String(clip.row.id) : null,
    promptExcerpt: narration,
  });
  await usage.commit();
  return json({ clip: clip.row, taggedText: narration === text ? null : narration });
}

async function autoTagNarration(supabaseAdmin: Admin, orgId: string, text: string): Promise<{ text: string; tokens: number | null; model: string } | { error: string }> {
  const { data: config } = await supabaseAdmin
    .from("organization_script_ai_config")
    .select("google_ai_api_key, text_ai_provider, model, is_active, daily_limit")
    .eq("organization_id", orgId)
    .maybeSingle();
  const provider = String(config?.text_ai_provider ?? (config?.is_active ? "groq" : "gemini")).trim();
  if (provider !== "gemini") return { error: "Auto-tag memakai Gemini. Atur provider Gemini di Settings > Script AI." };
  const apiKey = String(config?.google_ai_api_key ?? "").trim();
  if (!apiKey) return { error: "API key Gemini belum ada. Buka Settings > Script AI." };
  const today = new Date().toISOString().slice(0, 10);
  const limit = Math.max(1, Number(config?.daily_limit ?? 50));
  const { data: usageRow } = await supabaseAdmin.from("script_ai_daily_usage").select("id, count").eq("organization_id", orgId).eq("usage_date", today).maybeSingle();
  const count = usageRow?.count ?? 0;
  if (count >= limit) return { error: `Batas harian Script AI tercapai (${limit} per hari).` };
  const rawModel = String(config?.model ?? "").trim() || "gemini-2.5-flash";
  const retired: Record<string, string> = {
    "gemini-1.5-flash": "gemini-2.5-flash",
    "gemini-1.5-flash-latest": "gemini-2.5-flash",
    "gemini-1.5-pro": "gemini-2.5-flash",
    "gemini-2.0-flash": "gemini-2.5-flash",
    "gemini-2.0-flash-exp": "gemini-2.5-flash",
  };
  const model = retired[rawModel] ?? rawModel;
  const resolved = await resolveTaggedNarration(text, (prompt) => askGemini(apiKey, model, prompt));
  if ("error" in resolved) return resolved;
  if (usageRow?.id) await supabaseAdmin.from("script_ai_daily_usage").update({ count: count + 1 }).eq("id", usageRow.id);
  else await supabaseAdmin.from("script_ai_daily_usage").insert({ organization_id: orgId, usage_date: today, count: 1 });
  return { text: resolved.text, tokens: resolved.tokens, model };
}

async function askGemini(apiKey: string, model: string, prompt: string): Promise<{ text: string; tokens: number | null } | { error: string }> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
    return { error: payload.error?.message || "Gemini tidak bisa menandai narasi." };
  }
  const payload = await response.json().catch(() => ({})) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = String(payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
  if (!text) return { error: "Gemini tidak mengembalikan tanda suara." };
  return { text, tokens: officialTokenCount(payload) };
}

async function deleteVoiceClip(supabaseAdmin: Admin, orgId: string, userId: string, body: Record<string, unknown>, json: Json) {
  const clipId = String(body.clipId ?? "").trim();
  if (!clipId) return json({ error: "Suara tidak ditemukan" }, 400);
  const { data: clip } = await supabaseAdmin
    .from("brief_voice_clips")
    .select("id, organization_id, social_media_plan_id, storage_path")
    .eq("id", clipId)
    .maybeSingle();
  if (!clip || clip.organization_id !== orgId) return json({ error: "Suara tidak ditemukan" }, 404);
  const access = await assertPic(supabaseAdmin, orgId, userId, String(clip.social_media_plan_id), json);
  if (access.error) return access.error;
  const path = String(clip.storage_path ?? "").trim();
  if (path) await supabaseAdmin.storage.from(BUCKET).remove([path]);
  const { error } = await supabaseAdmin.from("brief_voice_clips").delete().eq("id", clipId).eq("organization_id", orgId);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

async function restyleVideo(supabaseAdmin: Admin, orgId: string, userId: string, body: Record<string, unknown>, json: Json) {
  const videoId = String(body.videoId ?? "").trim();
  if (!videoId) return json({ error: "Video tidak ditemukan" }, 400);
  const { data: video } = await supabaseAdmin
    .from("brief_shot_videos")
    .select("id, organization_id, social_media_plan_id, scope, row_index, status, generate_audio, storage_path")
    .eq("id", videoId)
    .maybeSingle();
  if (!video || video.organization_id !== orgId) return json({ error: "Video tidak ditemukan" }, 404);
  if (video.status !== "succeeded" || !video.storage_path) {
    return json({ error: "Suara video baru bisa diubah setelah video selesai dibuat." }, 400);
  }
  const access = await assertPic(supabaseAdmin, orgId, userId, String(video.social_media_plan_id), json);
  if (access.error) return access.error;
  const settings = configured(await loadConfig(supabaseAdmin, orgId));
  if (!settings) return json({ error: "Voice AI belum dikonfigurasi. Buka Settings > Voice AI." }, 400);
  const usage = await reserveUsage(supabaseAdmin, orgId, settings.limit, json);
  if (usage.error) return usage.error;
  const downloaded = await supabaseAdmin.storage.from(BUCKET).download(String(video.storage_path));
  if (downloaded.error || !downloaded.data) return json({ error: "Video asli tidak bisa diunduh." }, 500);
  const source = new Uint8Array(await downloaded.data.arrayBuffer());
  if (source.byteLength > MAX_VIDEO_BYTES) return json({ error: "Video terlalu besar untuk diubah suaranya." }, 400);
  let audio: Uint8Array;
  try {
    audio = extractMp4Audio(source);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Suara video tidak bisa dipisahkan." }, 400);
  }
  // Raw source audio only — no isolation, no remove_background_noise, no speaker boost.
  const converted = await convertSpeechToSpeech(settings, {
    bytes: audio,
    mime: "audio/mp4",
    fileName: "speech.m4a",
  });
  if ("error" in converted) return json({ error: converted.error }, converted.status);
  const clip = await storeClip(supabaseAdmin, orgId, String(video.social_media_plan_id), {
    kind: "seedance",
    rowIndex: Number(video.row_index) || 0,
    videoId,
    bytes: converted.bytes,
    creditCost: converted.creditCost,
    audioFormat: converted.format,
  });
  if (clip.error) return json({ error: clip.error }, 500);
  const response = converted.response;
  await recordContentUsage(supabaseAdmin, {
    organizationId: orgId,
    planId: String(video.social_media_plan_id),
    actorUserId: userId,
    service: "voice",
    action: "sts",
    targetLabel: `Baris ${(Number(video.row_index) || 0) + 1}`,
    model: STS_MODEL,
    usageAmount: converted.creditCost,
    usageUnit: converted.creditCost == null ? null : "character",
    status: "succeeded",
    providerRef: response.headers.get("request-id"),
    sourceId: clip.row?.id ? String(clip.row.id) : null,
  });
  await usage.commit();
  return json({ clip: clip.row, outputFormat: converted.outputFormat });
}

type StsAudioFormat = { ext: "wav"; contentType: "audio/wav" };

function pcmToWav(pcm: Uint8Array, sampleRate: number, channels = 1, bitsPerSample = 16): Uint8Array {
  const dataSize = pcm.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * (bitsPerSample / 8), true);
  view.setUint16(32, channels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  new Uint8Array(buffer, 44).set(pcm);
  return new Uint8Array(buffer);
}

/** Peak-normalize 16-bit PCM WAV so Organization Voice plays louder (target ~-1 dBFS). */
function normalizeWavLoudness(wav: Uint8Array, targetPeak = 0.95): Uint8Array {
  let offset = 12;
  let dataStart = -1;
  let dataSize = 0;
  while (offset + 8 <= wav.byteLength) {
    const id = String.fromCharCode(wav[offset]!, wav[offset + 1]!, wav[offset + 2]!, wav[offset + 3]!);
    const size = new DataView(wav.buffer, wav.byteOffset + offset + 4, 4).getUint32(0, true);
    if (id === "data") {
      dataStart = offset + 8;
      dataSize = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (dataStart < 0 || dataSize < 2) return wav;
  const src = new DataView(wav.buffer, wav.byteOffset + dataStart, dataSize);
  let peak = 1;
  for (let i = 0; i + 1 < dataSize; i += 2) {
    const sample = Math.abs(src.getInt16(i, true));
    if (sample > peak) peak = sample;
  }
  const gain = (targetPeak * 32767) / peak;
  if (gain <= 1.05) return wav;
  const out = new Uint8Array(wav);
  const dst = new DataView(out.buffer, out.byteOffset + dataStart, dataSize);
  for (let i = 0; i + 1 < dataSize; i += 2) {
    const sample = src.getInt16(i, true);
    dst.setInt16(i, Math.max(-32768, Math.min(32767, Math.round(sample * gain))), true);
  }
  return out;
}

function buildStsForm(input: { bytes: Uint8Array; mime: string; fileName: string }): FormData {
  const form = new FormData();
  form.append("audio", new Blob([input.bytes], { type: input.mime }), input.fileName);
  form.append("model_id", STS_MODEL);
  // No compression-related processing: no isolation, noise removal, speaker boost, or tone overrides.
  return form;
}

/** WAV only — never MP3. Prefer full-rate uncompressed; pcm_24000 only as last WAV fallback. */
async function convertSpeechToSpeech(
  settings: { key: string; voiceId: string },
  audio: { bytes: Uint8Array; mime: string; fileName: string },
): Promise<
  | { bytes: Uint8Array; creditCost: number | null; format: StsAudioFormat; outputFormat: string; response: Response }
  | { error: string; status: number }
> {
  const wavFormat: StsAudioFormat = { ext: "wav", contentType: "audio/wav" };
  const attempts: Array<{
    outputFormat: string;
    accept: string;
    wrapPcmHz?: number;
  }> = [
    { outputFormat: "wav_48000", accept: "audio/wav" },
    { outputFormat: "wav_44100", accept: "audio/wav" },
    { outputFormat: "pcm_48000", accept: "application/octet-stream", wrapPcmHz: 48000 },
    { outputFormat: "pcm_44100", accept: "application/octet-stream", wrapPcmHz: 44100 },
    // Last resort still WAV (no MP3). Prefer upgrading ElevenLabs plan for 44.1/48 kHz.
    { outputFormat: "pcm_24000", accept: "application/octet-stream", wrapPcmHz: 24000 },
  ];
  let lastError = "Speech to speech gagal (WAV).";
  let lastStatus = 500;
  for (const attempt of attempts) {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/speech-to-speech/${encodeURIComponent(settings.voiceId)}?output_format=${attempt.outputFormat}`,
      {
        method: "POST",
        headers: { "xi-api-key": settings.key, Accept: attempt.accept },
        body: buildStsForm(audio),
      },
    );
    if (!response.ok) {
      lastStatus = response.status;
      lastError = await elevenError(response);
      if (response.status === 400 || response.status === 403 || response.status === 422) continue;
      return { error: lastError, status: lastStatus };
    }
    const raw = new Uint8Array(await response.arrayBuffer());
    const wav = attempt.wrapPcmHz != null ? pcmToWav(raw, attempt.wrapPcmHz) : raw;
    const bytes = normalizeWavLoudness(wav);
    console.log("generate-brief-voice sts format", attempt.outputFormat, settings.voiceId);
    return {
      bytes,
      creditCost: exactCreditCostFromHeader(response.headers.get("character-cost")),
      format: wavFormat,
      outputFormat: attempt.outputFormat,
      response,
    };
  }
  return { error: lastError, status: lastStatus };
}

async function storeClip(
  supabaseAdmin: Admin,
  orgId: string,
  planId: string,
  input: {
    kind: "vo" | "seedance";
    rowIndex: number;
    videoId: string | null;
    bytes: Uint8Array;
    spokenText?: string | null;
    creditCost?: number | null;
    audioFormat?: StsAudioFormat;
  },
) {
  const id = crypto.randomUUID();
  const format = input.audioFormat ?? { ext: "wav" as const, contentType: "audio/wav" as const };
  const storagePath = `${orgId}/${planId}/voice/${id}.${format.ext}`;
  const fileName = input.kind === "vo" ? `vo-${input.rowIndex + 1}.${format.ext}` : `video-voice.${format.ext}`;
  const uploaded = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, input.bytes, {
    contentType: format.contentType,
    upsert: true,
  });
  if (uploaded.error) return { error: uploaded.error.message, row: null };
  const { data, error } = await supabaseAdmin.from("brief_voice_clips").insert({
    id,
    organization_id: orgId,
    social_media_plan_id: planId,
    kind: input.kind,
    row_index: input.rowIndex,
    video_id: input.videoId,
    storage_path: storagePath,
    file_name: fileName,
    spoken_text: input.spokenText ?? null,
    credit_cost: input.creditCost ?? null,
  }).select("id, kind, row_index, video_id, storage_path, file_name, spoken_text, credit_cost, created_at").single();
  if (error) return { error: error.message, row: null };
  return { error: null, row: data };
}

async function elevenError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => ({})) as { detail?: unknown };
  const detail = payload.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (detail && typeof detail === "object" && "message" in detail) {
    const message = String((detail as { message?: string }).message ?? "").trim();
    if (message) return message;
  }
  return `ElevenLabs menolak permintaan (${response.status}).`;
}
