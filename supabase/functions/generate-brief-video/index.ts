/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isUsageUuid, officialTokenCount, recordContentUsage, settleContentUsage } from "../_shared/contentUsage.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const ENDPOINT = "https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks";
const STORYBOARD_BUCKET = "brief-visual-images";
const CONCEPT_BUCKET = "digital-asset-character-images";
const MODELS = new Set(["dreamina-seedance-2-5-260628", "dreamina-seedance-2-0-260128"]);
const GOOGLE_VIDEO_MODELS = new Set([
  "gemini-omni-1.1-flash",
  "veo-3.1-lite-generate-preview",
  "veo-3.1-fast-generate-preview",
  "veo-3.1-generate-preview",
  "veo-3.0-generate-001",
  "veo-3.0-fast-generate-001",
]);
const RESOLUTIONS = new Set(["480p", "720p", "1080p"]);
const RATIOS = new Set(["9:16", "4:5", "1:1", "16:9"]);
const MENTION = /@(?:location|character|property)_[a-z0-9_]+/gi;
const VISUAL_PATH = /^[0-9a-f-]{36}\/(?:thinking-lab|brief)\/[0-9a-f-]{36}\/[a-z0-9_]{1,80}-(portrait|body|location|property)\.(jpg|png|webp)$/i;

type ConceptAsset = {
  handle?: string;
  portraitPath?: string;
  bodyPath?: string;
  locationPath?: string;
  propertyPath?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice("Bearer ".length);
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Invalid token" }, 401);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    const orgId = profile?.active_organization_id ? String(profile.active_organization_id) : "";
    if (!orgId) return json({ error: "No active organization" }, 400);

    const body = await req.json().catch(() => ({}));
    if (body.action === "status") return await refreshVideo(supabaseAdmin, orgId, String(body.videoId ?? ""));
    if (body.action === "sync") return await syncVideoUsage(supabaseAdmin, orgId, String(body.planId ?? ""), json);
    return await createVideo(supabaseAdmin, orgId, userData.user.id, body, json);
  } catch (error) {
    console.error("generate-brief-video", error);
    return json({ error: error instanceof Error ? error.message : "Video AI could not finish" }, 500);
  }
});

function seedanceTokens(task: unknown): number | null {
  const total = officialTokenCount(task);
  if (total != null) return total;
  if (!task || typeof task !== "object") return null;
  const usage = (task as { usage?: { completion_tokens?: unknown } }).usage;
  const raw = usage?.completion_tokens;
  if (typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0) return raw;
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) return Number(raw.trim());
  return null;
}

function videoTarget(video: { scope?: string; row_index?: number; duration_seconds?: number; resolution?: string }) {
  const label = video.scope === "master" ? "Master" : `Baris ${(Number(video.row_index) || 0) + 1}`;
  return `${label}${video.duration_seconds ? ` · ${video.duration_seconds} dtk` : ""}${video.resolution ? ` · ${video.resolution}` : ""}`;
}

async function syncVideoUsage(
  supabaseAdmin: ReturnType<typeof createClient>,
  orgId: string,
  planId: string,
  json: (body: object, status?: number) => Response,
) {
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
  const { data: videos, error: videoError } = await supabaseAdmin
    .from("brief_shot_videos")
    .select("id, scope, row_index, model, resolution, duration_seconds, status, provider_task_id, created_at")
    .eq("social_media_plan_id", planId)
    .eq("organization_id", orgId);
  if (videoError) return json({ error: videoError.message }, 500);
  const jobs = (videos ?? []) as Array<{
    id: string;
    scope: string;
    row_index: number;
    model: string;
    resolution: string;
    duration_seconds: number;
    status: string;
    provider_task_id: string | null;
    created_at: string;
  }>;
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("content_ai_usage")
    .select("id, source_id, usage_amount, actor_user_id")
    .eq("service", "video")
    .eq("social_media_plan_id", planId);
  if (existingError) return json({ error: existingError.message }, 500);
  const bySource = new Map<string, { id: string; usage_amount: number | null; actor_user_id: string | null }>();
  for (const row of (existing ?? []) as Array<{ id: string; source_id: string | null; usage_amount: number | null; actor_user_id: string | null }>) {
    if (row.source_id) bySource.set(row.source_id, { id: row.id, usage_amount: row.usage_amount, actor_user_id: row.actor_user_id });
  }
  const { data: config } = await supabaseAdmin
    .from("organization_video_ai_config")
    .select("byteplus_api_key")
    .eq("organization_id", orgId)
    .maybeSingle();
  const apiKey = String(config?.byteplus_api_key ?? "").trim();
  const needsGemini = jobs.some((video) => isGoogleVideo(String(video.model)) && video.provider_task_id && video.status !== "failed");
  let geminiKey = "";
  if (needsGemini) {
    const { data: scriptConfig } = await supabaseAdmin
      .from("organization_script_ai_config")
      .select("google_ai_api_key")
      .eq("organization_id", orgId)
      .maybeSingle();
    geminiKey = String(scriptConfig?.google_ai_api_key ?? "").trim();
  }
  let added = 0;
  let priced = 0;
  for (const video of jobs) {
    let status = video.status === "queued" || video.status === "running" || video.status === "succeeded" || video.status === "failed"
      ? video.status
      : "failed";
    let tokens: number | null = null;
    const needsLookup = !isGoogleVideo(String(video.model)) && Boolean(apiKey && video.provider_task_id && status !== "failed" && (!bySource.get(video.id) || bySource.get(video.id)?.usage_amount == null));
    if (needsLookup) {
      const response = await fetch(`${ENDPOINT}/${video.provider_task_id}`, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (response.ok) {
        const task = await response.json().catch(() => ({}));
        const remote = String((task as { status?: string }).status ?? "").toLowerCase();
        if (remote === "queued" || remote === "running" || remote === "succeeded" || remote === "failed") status = remote;
        if (status === "succeeded") tokens = seedanceTokens(task);
      }
    }
    if (isOmniModel(String(video.model)) && geminiKey && video.provider_task_id && status !== "failed" && (status !== "succeeded" || bySource.get(video.id)?.usage_amount == null)) {
      const response = await fetch(`${GEMINI_ENDPOINT}/${video.provider_task_id}`, { headers: { "x-goog-api-key": geminiKey } });
      if (response.ok) {
        const task = await response.json().catch(() => ({}));
        const remote = String((task as { status?: string }).status ?? "");
        if (remote === "completed") {
          tokens = seedanceTokens(task);
          if (status !== "succeeded") {
            const settled = await settleGeminiJob(supabaseAdmin, {
              id: video.id,
              organization_id: orgId,
              social_media_plan_id: planId,
              scope: video.scope,
              row_index: video.row_index,
              model: video.model,
              resolution: video.resolution,
              duration_seconds: video.duration_seconds,
              status,
              provider_task_id: video.provider_task_id,
            }, geminiKey, task);
            if (settled.status === "succeeded" || settled.status === "failed") status = settled.status;
          }
        } else if (remote === "failed" || remote === "cancelled" || remote === "incomplete") {
          status = "failed";
          const message = geminiError(task) || `Gemini selesai dengan status ${remote}`;
          await supabaseAdmin.from("brief_shot_videos").update({ status: "failed", error: message }).eq("id", video.id);
        }
      }
    }
    if (isVeoModel(String(video.model)) && geminiKey && video.provider_task_id && status !== "failed" && (status !== "succeeded" || bySource.get(video.id)?.usage_amount == null)) {
      const response = await fetch(googleOperationUrl(video.provider_task_id), { headers: { "x-goog-api-key": geminiKey } });
      if (response.ok) {
        const task = await response.json().catch(() => ({}));
        if ((task as { done?: boolean }).done) {
          tokens = seedanceTokens(task);
          if (status !== "succeeded") {
            const settled = await settleVeoJob(supabaseAdmin, {
              id: video.id,
              organization_id: orgId,
              social_media_plan_id: planId,
              scope: video.scope,
              row_index: video.row_index,
              model: video.model,
              resolution: video.resolution,
              duration_seconds: video.duration_seconds,
              status,
              provider_task_id: video.provider_task_id,
            }, geminiKey, task);
            if (settled.status === "succeeded" || settled.status === "failed") status = settled.status;
          }
        }
      }
    }
    const current = bySource.get(video.id);
    if (!current) {
      const { error } = await supabaseAdmin.from("content_ai_usage").insert({
        organization_id: orgId,
        social_media_plan_id: planId,
        actor_user_id: actorUserId,
        service: "video",
        action: video.scope === "master" ? "generate_master" : "generate_shot",
        target_label: videoTarget(video),
        model: video.model,
        usage_amount: tokens,
        usage_unit: tokens == null ? null : "token",
        status,
        provider_ref: video.provider_task_id,
        source_id: video.id,
        created_at: video.created_at,
      });
      if (error) return json({ error: error.message }, 500);
      added += 1;
      if (tokens != null) priced += 1;
      continue;
    }
    const patch: Record<string, unknown> = { status };
    if (current.usage_amount == null && tokens != null) {
      patch.usage_amount = tokens;
      patch.usage_unit = "token";
    }
    if (!current.actor_user_id && actorUserId) patch.actor_user_id = actorUserId;
    const { error } = await supabaseAdmin.from("content_ai_usage").update(patch).eq("id", current.id);
    if (error) return json({ error: error.message }, 500);
    if (current.usage_amount == null && tokens != null) priced += 1;
  }
  return json({ ok: true, added, priced });
}

async function createVideo(
  supabaseAdmin: ReturnType<typeof createClient>,
  orgId: string,
  userId: string,
  body: Record<string, unknown>,
  json: (body: object, status?: number) => Response,
) {
  const planId = String(body.planId ?? "").trim();
  const model = String(body.model ?? "").trim();
  const resolution = String(body.resolution ?? "").trim();
  const ratio = String(body.ratio ?? "").trim();
  const duration = Number(body.duration);
  const generateAudio = body.generateAudio === true;
  const prompt = String(body.prompt ?? "").trim();
  const scope = body.scope === "master" ? "master" : body.scope === "shot" ? "shot" : "";
  const rowIndexes = Array.isArray(body.rowIndexes)
    ? body.rowIndexes.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 0)
    : [];
  const provider = body.provider === "gemini" ? "gemini" : "byteplus";
  if (!planId || !scope || rowIndexes.length === 0 || !prompt) return json({ error: "Data video tidak lengkap" }, 400);
  if (provider === "gemini") {
    if (!GOOGLE_VIDEO_MODELS.has(model)) return json({ error: "Model video tidak dikenal" }, 400);
    if (!googleResolutions(model).has(resolution)) return json({ error: "Resolusi video tidak dikenal" }, 400);
    if (!googleDurations(model).has(duration)) {
      return json({ error: isOmniModel(model) ? "Durasi Omni adalah 4, 6, 8, atau 10 detik" : "Durasi Veo adalah 4, 6, atau 8 detik" }, 400);
    }
    if (isVeoModel(model) && (resolution === "1080p" || resolution === "4k") && duration !== 8) {
      return json({ error: "1080p dan 4K pada Veo hanya untuk durasi 8 detik" }, 400);
    }
  } else if (!MODELS.has(model)) {
    return json({ error: "Model video tidak dikenal" }, 400);
  }
  if (provider !== "gemini" && !RESOLUTIONS.has(resolution)) return json({ error: "Resolusi video tidak dikenal" }, 400);
  if (!RATIOS.has(ratio)) return json({ error: "Rasio video tidak dikenal" }, 400);
  const maxDuration = isOmniModel(model) ? 10 : isVeoModel(model) ? 8 : model === "dreamina-seedance-2-0-260128" ? 15 : 30;
  if (provider !== "gemini" && (![5, 10, 15, 20, 25, 30].includes(duration) || duration > maxDuration)) {
    return json({ error: `Durasi harus kelipatan 5, paling lama ${maxDuration} detik untuk model ini` }, 400);
  }

  const { data: plan } = await supabaseAdmin
    .from("social_media_plans")
    .select("id, organization_id, pic_id")
    .eq("id", planId)
    .maybeSingle();
  if (!plan || plan.organization_id !== orgId) return json({ error: "Brief ini bukan milik organisasi aktif" }, 403);
  const picId = String(plan.pic_id ?? "").trim();
  const { data: picEmployee } = picId
    ? await supabaseAdmin.from("employees").select("id").eq("id", picId).eq("user_id", userId).maybeSingle()
    : { data: null };
  if (!picEmployee) return json({ error: "Hanya PIC brief ini yang dapat membuat video." }, 403);

  const { data: config } = await supabaseAdmin
    .from("organization_video_ai_config")
    .select("byteplus_api_key, api_key_configured, daily_limit")
    .eq("organization_id", orgId)
    .maybeSingle();
  let apiKey = "";
  if (provider === "gemini") {
    const { data: scriptConfig } = await supabaseAdmin
      .from("organization_script_ai_config")
      .select("google_ai_api_key, api_key_configured")
      .eq("organization_id", orgId)
      .maybeSingle();
    apiKey = String(scriptConfig?.google_ai_api_key ?? "").trim();
    if (!apiKey) {
      return json({ error: "Gemini API key belum ada. Isi di Settings > Script AI Generator." }, 400);
    }
  } else {
    apiKey = String(config?.byteplus_api_key ?? "").trim();
    if (!config?.api_key_configured || !apiKey) {
      return json({ error: "Video AI belum dikonfigurasi. Buka Settings > Video AI Generator." }, 400);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: usageRow } = await supabaseAdmin
    .from("video_ai_daily_usage")
    .select("id, count")
    .eq("organization_id", orgId)
    .eq("usage_date", today)
    .maybeSingle();
  const dailyLimit = Math.max(1, Number(config?.daily_limit ?? 20));
  const currentCount = usageRow?.count ?? 0;
  if (currentCount >= dailyLimit) {
    return json({ error: `Batas harian video tercapai (${dailyLimit} per hari).` }, 429);
  }

  const { data: imageRows, error: imageError } = await supabaseAdmin
    .from("brief_storyboard_images")
    .select("id, row_index, sort_order, storage_path")
    .eq("social_media_plan_id", planId)
    .eq("column_index", 1)
    .in("row_index", rowIndexes)
    .order("sort_order", { ascending: true });
  if (imageError) return json({ error: imageError.message }, 500);
  const requestedIds = body.imageIds && typeof body.imageIds === "object"
    ? body.imageIds as Record<string, unknown>
    : {};
  const endImageId = scope === "shot" && rowIndexes.length === 1 ? String(body.endImageId ?? "").trim() : "";
  const rowsByIndex = new Map<number, Array<{ id: string; path: string }>>();
  for (const row of imageRows ?? []) {
    const index = Number(row.row_index);
    const path = String(row.storage_path ?? "");
    if (!path.startsWith(`${orgId}/`)) continue;
    const list = rowsByIndex.get(index) ?? [];
    list.push({ id: String(row.id), path });
    rowsByIndex.set(index, list);
  }
  const firstByRow = new Map<number, string>();
  for (const index of rowIndexes) {
    const list = rowsByIndex.get(index) ?? [];
    const requestedId = String(requestedIds[String(index)] ?? "");
    const chosen = list.find((item) => item.id === requestedId) ?? list[0];
    if (chosen) firstByRow.set(index, chosen.path);
  }
  const missingRows = rowIndexes.filter((index) => !firstByRow.has(index)).map((index) => index + 1);
  if (missingRows.length > 0) {
    return json({ error: `Gambar belum ada di shot ${missingRows.join(", ")}` }, 400);
  }

  let endPath = "";
  if (endImageId) {
    const list = rowsByIndex.get(rowIndexes[0]) ?? [];
    const startId = String(requestedIds[String(rowIndexes[0])] ?? "");
    const start = list.find((item) => item.id === startId) ?? list[0];
    const end = list.find((item) => item.id === endImageId);
    if (!start || !end || start.id === end.id) {
      return json({ error: "Gambar Awal dan Akhir harus dua gambar berbeda pada shot ini" }, 400);
    }
    firstByRow.set(rowIndexes[0], start.path);
    endPath = end.path;
  }

  const { data: audience } = await supabaseAdmin
    .from("brief_target_audiences")
    .select("description")
    .eq("social_media_plan_id", planId)
    .maybeSingle();
  const concept = parseConcept(audience?.description);
  const mentions = [...new Set((prompt.match(MENTION) ?? []).map((handle) => handle.toLowerCase()))];
  const missingMentions = mentions.filter((handle) => !conceptPath(concept, handle, orgId));
  // Single-shot generate uses the storyboard still. Concept mentions are required only for master generate.
  if (scope !== "shot" && !endImageId && missingMentions.length > 0) {
    return json({ error: `Gambar Concept belum ada untuk ${missingMentions.join(", ")}` }, 400);
  }

  const images = endImageId
    ? [
      { path: firstByRow.get(rowIndexes[0]) as string, bucket: STORYBOARD_BUCKET, label: "opening frame", role: "first_frame" },
      { path: endPath, bucket: STORYBOARD_BUCKET, label: "ending frame", role: "last_frame" },
    ]
    : [
      ...rowIndexes.map((index) => ({
        path: firstByRow.get(index) as string,
        bucket: STORYBOARD_BUCKET,
        label: `shot ${index + 1} selected angle`,
        role: "first_frame",
      })),
      ...mentions.flatMap((handle) => {
        const path = conceptPath(concept, handle, orgId);
        if (!path || rowIndexes.some((index) => firstByRow.get(index) === path)) return [];
        return [{ path, bucket: CONCEPT_BUCKET, label: handle, role: "reference_image" }];
      }),
    ];
  const imageCap = isOmniModel(model) ? 7 : isVeoModel(model) ? 3 : model === "dreamina-seedance-2-0-260128" ? 9 : 30;
  if (images.length > imageCap) return json({ error: `Model ini menerima paling banyak ${imageCap} gambar` }, 400);
  const signed = await Promise.all(images.map(async (item) => ({
    ...item,
    url: await signImage(supabaseAdmin, item.bucket, item.path),
  })));
  if (signed.some((item) => !item.url)) return json({ error: "Gambar brief tidak bisa dibaca" }, 500);
  if (provider === "gemini" && isVeoModel(model)) {
    return finishVeoVideo(supabaseAdmin, {
      orgId,
      userId,
      planId,
      apiKey,
      model,
      resolution,
      ratio,
      duration,
      generateAudio,
      prompt,
      scope,
      rowIndexes,
      images: signed,
      usageId: usageRow?.id ? String(usageRow.id) : null,
      currentCount,
      today,
      json,
    });
  }
  if (provider === "gemini") {
    return finishGeminiVideo(supabaseAdmin, {
      orgId,
      userId,
      planId,
      apiKey,
      model,
      resolution,
      ratio,
      duration,
      generateAudio,
      prompt,
      scope,
      rowIndexes,
      images: signed,
      usageId: usageRow?.id ? String(usageRow.id) : null,
      currentCount,
      today,
      json,
    });
  }

  const ugcLook = promptHasUgcLook(prompt);
  // UGC Look must not lock the still as first_frame — that copies cinematic grade from the photo.
  const useReference = !endImageId && (signed.length > 1 || ugcLook);
  const matchLines = ugcLook
    ? endImageId
      ? "Use the first image for opening subject and framing, and the second for ending subject and framing. Restyle camera and lighting to UGC: iPhone 17 Pro Max handheld, super high contrast, advertisement lighting. Do not preserve cinematic soft lighting or filmic bokeh from the stills."
      : signed.map((item, index) => `@Image${index + 1} (${item.label}) supplies subject and framing only. Restyle camera and lighting to UGC: iPhone 17 Pro Max handheld, super high contrast, advertisement lighting. Do not preserve cinematic soft lighting or filmic bokeh.`).join("\n")
    : endImageId
      ? "The opening frame must match the first image exactly. The ending frame must match the second image exactly."
      : useReference
        ? signed.map((item, index) => `@Image${index + 1} (${item.label}) must match that image exactly for the whole shot.`).join("\n")
        : "The opening frame must match the supplied image exactly.";
  const content = [
    { type: "text", text: `${matchLines}\n\n${prompt}` },
    ...signed.map((item) => ({
      type: "image_url",
      role: endImageId ? item.role : useReference ? "reference_image" : "first_frame",
      image_url: { url: item.url },
    })),
  ];
  const payload: Record<string, unknown> = {
    model,
    content,
    resolution,
    duration,
    ratio: endImageId
      ? (model === "dreamina-seedance-2-5-260628" ? "adaptive" : ratio)
      : (useReference || model !== "dreamina-seedance-2-5-260628" ? ratio : "adaptive"),
    generate_audio: generateAudio,
    watermark: false,
  };
  if (useReference) payload.omni_reference_task_type = "reference";

  const created = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const createdBody = await created.json().catch(() => ({}));
  const taskId = String((createdBody as { id?: string }).id ?? "");
  if (!created.ok || !taskId) {
    const providerMessage = (createdBody as { error?: { message?: string } }).error?.message || "Seedance menolak permintaan video";
    return json({ error: seedanceFailure(providerMessage, signed.map((item) => item.label)) }, created.status || 502);
  }

  const { data: saved, error: saveError } = await supabaseAdmin
    .from("brief_shot_videos")
    .insert({
      organization_id: orgId,
      social_media_plan_id: planId,
      scope,
      row_index: rowIndexes[0],
      row_indexes: rowIndexes,
      status: "running",
      provider_task_id: taskId,
      model,
      resolution,
      duration_seconds: duration,
      ratio,
      generate_audio: generateAudio,
    })
    .select("id, status, row_index, row_indexes, scope, storage_path, error, created_at")
    .single();
  if (saveError) return json({ error: saveError.message }, 500);

  const rowLabel = scope === "master" ? "Master" : `Baris ${rowIndexes[0] + 1}`;
  await recordContentUsage(supabaseAdmin, {
    organizationId: orgId,
    planId,
    actorUserId: userId,
    service: "video",
    action: scope === "master" ? "generate_master" : "generate_shot",
    targetLabel: `${rowLabel} · ${duration} dtk · ${resolution}`,
    model,
    status: "running",
    providerRef: taskId,
    sourceId: saved?.id ? String(saved.id) : null,
    promptExcerpt: prompt,
  });

  if (usageRow?.id) {
    await supabaseAdmin.from("video_ai_daily_usage").update({ count: currentCount + 1 }).eq("id", usageRow.id);
  } else {
    await supabaseAdmin.from("video_ai_daily_usage").insert({ organization_id: orgId, usage_date: today, count: 1 });
  }
  return json({ video: saved });
}

async function refreshVideo(supabaseAdmin: ReturnType<typeof createClient>, orgId: string, videoId: string) {
  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (!videoId) return json({ error: "Video tidak ditemukan" }, 400);
  const { data: video } = await supabaseAdmin
    .from("brief_shot_videos")
    .select("id, organization_id, social_media_plan_id, scope, row_index, model, resolution, duration_seconds, status, provider_task_id, storage_path")
    .eq("id", videoId)
    .maybeSingle();
  if (!video || video.organization_id !== orgId) return json({ error: "Video tidak ditemukan" }, 404);
  if (video.status === "succeeded" || video.status === "failed" || !video.provider_task_id) return json({ video });
  if (isOmniModel(String(video.model))) return refreshGeminiVideo(supabaseAdmin, orgId, video, json);
  if (isVeoModel(String(video.model))) return refreshVeoVideo(supabaseAdmin, orgId, video, json);

  const { data: config } = await supabaseAdmin
    .from("organization_video_ai_config")
    .select("byteplus_api_key")
    .eq("organization_id", orgId)
    .maybeSingle();
  const apiKey = String(config?.byteplus_api_key ?? "").trim();
  if (!apiKey) return json({ error: "Video AI belum dikonfigurasi." }, 400);

  const response = await fetch(`${ENDPOINT}/${video.provider_task_id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const task = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (task as { error?: { message?: string } }).error?.message || "Status video tidak bisa dibaca";
    return json({ error: message }, response.status);
  }
  const status = String((task as { status?: string }).status ?? "").toLowerCase();
  if (status === "queued" || status === "running") {
    await supabaseAdmin.from("brief_shot_videos").update({ status: status === "queued" ? "queued" : "running" }).eq("id", video.id);
    return json({ video: { ...video, status: status === "queued" ? "queued" : "running" } });
  }
  if (status !== "succeeded") {
    const message = (task as { error?: { message?: string } }).error?.message || `Seedance selesai dengan status ${status || "failed"}`;
    await supabaseAdmin.from("brief_shot_videos").update({ status: "failed", error: message }).eq("id", video.id);
    await settleVideoUsage(supabaseAdmin, video, "failed", task);
    return json({ video: { ...video, status: "failed", error: message } });
  }
  const videoUrl = findVideoUrl(task);
  if (!videoUrl) {
    await supabaseAdmin.from("brief_shot_videos").update({ status: "failed", error: "URL video tidak ada" }).eq("id", video.id);
    await settleVideoUsage(supabaseAdmin, video, "failed", task);
    return json({ video: { ...video, status: "failed", error: "URL video tidak ada" } });
  }
  const downloaded = await fetch(videoUrl);
  if (!downloaded.ok) {
    await supabaseAdmin.from("brief_shot_videos").update({ status: "failed", error: "Video tidak bisa diunduh" }).eq("id", video.id);
    await settleVideoUsage(supabaseAdmin, video, "failed", task);
    return json({ video: { ...video, status: "failed", error: "Video tidak bisa diunduh" } });
  }
  const bytes = new Uint8Array(await downloaded.arrayBuffer());
  const storagePath = `${orgId}/${video.social_media_plan_id}/videos/${video.id}.mp4`;
  const { error: uploadError } = await supabaseAdmin.storage.from(STORYBOARD_BUCKET).upload(storagePath, bytes, {
    contentType: "video/mp4",
    upsert: true,
  });
  if (uploadError) {
    await supabaseAdmin.from("brief_shot_videos").update({ status: "failed", error: uploadError.message }).eq("id", video.id);
    await settleVideoUsage(supabaseAdmin, video, "failed", task);
    return json({ video: { ...video, status: "failed", error: uploadError.message } });
  }
  await supabaseAdmin.from("brief_shot_videos").update({ status: "succeeded", storage_path: storagePath, error: null }).eq("id", video.id);
  await settleVideoUsage(supabaseAdmin, video, "succeeded", task);
  return json({ video: { ...video, status: "succeeded", storage_path: storagePath, error: null } });
}

async function settleVideoUsage(
  supabaseAdmin: ReturnType<typeof createClient>,
  video: { id: string; organization_id: string; social_media_plan_id: string; scope?: string; row_index?: number; model?: string; resolution?: string; duration_seconds?: number },
  status: "succeeded" | "failed",
  task: unknown,
) {
  const tokens = seedanceTokens(task);
  const settled = await supabaseAdmin
    .from("content_ai_usage")
    .select("id")
    .eq("service", "video")
    .eq("source_id", video.id)
    .maybeSingle();
  if (settled.data?.id) {
    await settleContentUsage(supabaseAdmin, "video", video.id, {
      status,
      usageAmount: tokens,
      usageUnit: tokens == null ? null : "token",
    });
    return;
  }
  const scope = video.scope === "master" ? "master" : "shot";
  await recordContentUsage(supabaseAdmin, {
    organizationId: String(video.organization_id),
    planId: String(video.social_media_plan_id),
    service: "video",
    action: scope === "master" ? "generate_master" : "generate_shot",
    targetLabel: videoTarget(video),
    model: video.model ?? null,
    usageAmount: tokens,
    usageUnit: tokens == null ? null : "token",
    status,
    sourceId: video.id,
  });
}

function parseConcept(raw: unknown): ConceptAsset[] {
  if (typeof raw !== "string" || !raw.trim().startsWith("{")) return [];
  try {
    const parsed = JSON.parse(raw) as { locations?: ConceptAsset[]; characters?: ConceptAsset[]; properties?: ConceptAsset[] };
    return [...(parsed.locations ?? []), ...(parsed.characters ?? []), ...(parsed.properties ?? [])];
  } catch {
    return [];
  }
}

function conceptPath(assets: ConceptAsset[], handle: string, orgId: string): string | null {
  const asset = assets.find((item) => String(item.handle ?? "").toLowerCase() === handle);
  const path = String(asset?.portraitPath || asset?.bodyPath || asset?.locationPath || asset?.propertyPath || "");
  if (!path.startsWith(`${orgId}/`) || !VISUAL_PATH.test(path)) return null;
  return path;
}

async function signImage(supabaseAdmin: ReturnType<typeof createClient>, bucket: string, path: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 60 * 60 * 2);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

function seedanceFailure(providerMessage: string, imageLabels: string[]): string {
  if (!/real person/i.test(providerMessage)) return providerMessage;
  const names = [...providerMessage.matchAll(/content\[(\d+)\]/g)]
    .map((match) => imageLabels[Number(match[1]) - 1])
    .filter((label) => Boolean(label));
  const shown = names.length > 0 ? names.join(" dan ") : "gambar yang dikirim";
  return `Seedance menolak ${shown} karena terdeteksi sebagai foto orang sungguhan. Gunakan gambar tanpa wajah orang sungguhan.`;
}

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const GOOGLE_API = "https://generativelanguage.googleapis.com/v1beta";

function isOmniModel(model: string): boolean {
  return model.startsWith("gemini-omni");
}

function isVeoModel(model: string): boolean {
  return model.startsWith("veo-");
}

function isGoogleVideo(model: string): boolean {
  return isOmniModel(model) || isVeoModel(model);
}

function googleDurations(model: string): Set<number> {
  return isOmniModel(model) ? new Set([4, 6, 8, 10]) : new Set([4, 6, 8]);
}

function googleResolutions(model: string): Set<string> {
  if (isOmniModel(model)) return new Set(["360p", "720p", "1080p", "4k"]);
  if (model === "veo-3.1-generate-preview" || model === "veo-3.1-fast-generate-preview") return new Set(["720p", "1080p", "4k"]);
  return new Set(["720p", "1080p"]);
}

function veoSupportsReferences(model: string): boolean {
  return model === "veo-3.1-generate-preview" || model === "veo-3.1-fast-generate-preview";
}

function promptHasUgcLook(prompt: string): boolean {
  return /ugc look components|iphone 17 pro max|advertisement lighting|super high contrast/i.test(prompt);
}

function googleOperationUrl(name: string): string {
  if (name.startsWith("http")) return name;
  return `${GOOGLE_API}/${name.replace(/^\//, "")}`;
}

type GeminiImage = { path: string; bucket: string; label: string; role: string };
type ShotVideoRow = {
  id: string;
  organization_id: string;
  social_media_plan_id: string;
  scope?: string;
  row_index?: number;
  model?: string;
  resolution?: string;
  duration_seconds?: number;
  status?: string;
  provider_task_id?: string | null;
  storage_path?: string | null;
  error?: string | null;
};

async function finishGeminiVideo(
  supabaseAdmin: ReturnType<typeof createClient>,
  input: {
    orgId: string;
    userId: string;
    planId: string;
    apiKey: string;
    model: string;
    resolution: string;
    ratio: string;
    duration: number;
    generateAudio: boolean;
    prompt: string;
    scope: string;
    rowIndexes: number[];
    images: GeminiImage[];
    usageId: string | null;
    currentCount: number;
    today: string;
    json: (body: object, status?: number) => Response;
  },
) {
  const parts: Array<{ type: "image"; data: string; mime_type: string }> = [];
  for (const item of input.images) {
    const part = await geminiImagePart(supabaseAdmin, item);
    if (!part) return input.json({ error: "Gambar brief tidak bisa dibaca" }, 500);
    parts.push(part);
  }
  const endPair = input.images.length === 2 && input.images[0]?.role === "first_frame" && input.images[1]?.role === "last_frame";
  const ugcLook = promptHasUgcLook(input.prompt);
  const task = endPair
    ? ""
    : input.images.length > 1 || ugcLook
      ? "reference_to_video"
      : "image_to_video";
  const payload: Record<string, unknown> = {
    model: input.model,
    background: true,
    store: true,
    input: [
      ...parts,
      { type: "text", text: geminiPrompt(input.prompt, input.images.length, endPair, input.generateAudio) },
    ],
    response_format: {
      type: "video",
      aspect_ratio: input.ratio === "16:9" ? "16:9" : "9:16",
      resolution: input.resolution,
      duration: `${input.duration}s`,
      delivery: "uri",
    },
  };
  if (task) payload.generation_config = { video_config: { task } };

  const created = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: { "x-goog-api-key": input.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const createdBody = await created.json().catch(() => ({}));
  const interactionId = String((createdBody as { id?: string }).id ?? "");
  if (!created.ok || !interactionId) {
    const message = geminiError(createdBody) || "Gemini menolak permintaan video";
    return input.json({ error: message }, created.status || 502);
  }

  const { data: saved, error: saveError } = await supabaseAdmin
    .from("brief_shot_videos")
    .insert({
      organization_id: input.orgId,
      social_media_plan_id: input.planId,
      scope: input.scope,
      row_index: input.rowIndexes[0],
      row_indexes: input.rowIndexes,
      status: "running",
      provider_task_id: interactionId,
      model: input.model,
      resolution: input.resolution,
      duration_seconds: input.duration,
      ratio: input.ratio === "16:9" ? "16:9" : "9:16",
      generate_audio: input.generateAudio,
    })
    .select("id, organization_id, social_media_plan_id, scope, row_index, row_indexes, status, provider_task_id, storage_path, error, model, resolution, duration_seconds, created_at")
    .single();
  if (saveError || !saved) return input.json({ error: saveError?.message || "Video tidak tersimpan" }, 500);

  const rowLabel = input.scope === "master" ? "Master" : `Baris ${input.rowIndexes[0] + 1}`;
  await recordContentUsage(supabaseAdmin, {
    organizationId: input.orgId,
    planId: input.planId,
    actorUserId: input.userId,
    service: "video",
    action: input.scope === "master" ? "generate_master" : "generate_shot",
    targetLabel: `${rowLabel} · ${input.duration} dtk · ${input.resolution}`,
    model: input.model,
    status: "running",
    providerRef: interactionId,
    sourceId: String(saved.id),
    promptExcerpt: input.prompt,
  });
  if (input.usageId) {
    await supabaseAdmin.from("video_ai_daily_usage").update({ count: input.currentCount + 1 }).eq("id", input.usageId);
  } else {
    await supabaseAdmin.from("video_ai_daily_usage").insert({ organization_id: input.orgId, usage_date: input.today, count: 1 });
  }

  const remoteStatus = String((createdBody as { status?: string }).status ?? "");
  if (remoteStatus === "completed" || remoteStatus === "failed" || remoteStatus === "cancelled" || remoteStatus === "incomplete") {
    const settled = await settleGeminiJob(supabaseAdmin, saved as ShotVideoRow, input.apiKey, createdBody);
    return input.json({ video: settled });
  }
  return input.json({ video: saved });
}

async function refreshGeminiVideo(
  supabaseAdmin: ReturnType<typeof createClient>,
  orgId: string,
  video: ShotVideoRow,
  json: (body: object, status?: number) => Response,
) {
  const { data: scriptConfig } = await supabaseAdmin
    .from("organization_script_ai_config")
    .select("google_ai_api_key")
    .eq("organization_id", orgId)
    .maybeSingle();
  const apiKey = String(scriptConfig?.google_ai_api_key ?? "").trim();
  if (!apiKey) return json({ error: "Gemini API key belum ada. Isi di Settings > Script AI Generator." }, 400);
  const response = await fetch(`${GEMINI_ENDPOINT}/${video.provider_task_id}`, {
    headers: { "x-goog-api-key": apiKey },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return json({ error: geminiError(body) || "Status video Gemini tidak bisa dibaca" }, response.status);
  }
  const settled = await settleGeminiJob(supabaseAdmin, video, apiKey, body);
  return json({ video: settled });
}

async function settleGeminiJob(
  supabaseAdmin: ReturnType<typeof createClient>,
  video: ShotVideoRow,
  apiKey: string,
  body: unknown,
): Promise<ShotVideoRow> {
  const status = String((body as { status?: string }).status ?? "");
  if (status === "in_progress" || status === "requires_action" || status === "") return video;
  if (status !== "completed") {
    const message = geminiError(body) || `Gemini selesai dengan status ${status || "failed"}`;
    await supabaseAdmin.from("brief_shot_videos").update({ status: "failed", error: message }).eq("id", video.id);
    await settleVideoUsage(supabaseAdmin, video, "failed", body);
    return { ...video, status: "failed", error: message };
  }
  const ref = geminiVideoRef(body);
  const bytes = ref ? await downloadGeminiVideo(apiKey, ref) : null;
  if (!bytes) return video;
  const storagePath = `${video.organization_id}/${video.social_media_plan_id}/videos/${video.id}.mp4`;
  const { error: uploadError } = await supabaseAdmin.storage.from(STORYBOARD_BUCKET).upload(storagePath, bytes, {
    contentType: "video/mp4",
    upsert: true,
  });
  if (uploadError) {
    await supabaseAdmin.from("brief_shot_videos").update({ status: "failed", error: uploadError.message }).eq("id", video.id);
    await settleVideoUsage(supabaseAdmin, video, "failed", body);
    return { ...video, status: "failed", error: uploadError.message };
  }
  await supabaseAdmin.from("brief_shot_videos").update({ status: "succeeded", storage_path: storagePath, error: null }).eq("id", video.id);
  await settleVideoUsage(supabaseAdmin, video, "succeeded", body);
  return { ...video, status: "succeeded", storage_path: storagePath, error: null };
}

async function finishVeoVideo(
  supabaseAdmin: ReturnType<typeof createClient>,
  input: {
    orgId: string;
    userId: string;
    planId: string;
    apiKey: string;
    model: string;
    resolution: string;
    ratio: string;
    duration: number;
    generateAudio: boolean;
    prompt: string;
    scope: string;
    rowIndexes: number[];
    images: GeminiImage[];
    usageId: string | null;
    currentCount: number;
    today: string;
    json: (body: object, status?: number) => Response;
  },
) {
  const endPair = input.images.length === 2 && input.images[0]?.role === "first_frame" && input.images[1]?.role === "last_frame";
  const ugcLook = promptHasUgcLook(input.prompt);
  const wantReferences = !endPair && (input.images.length > 1 || (ugcLook && input.images.length === 1 && veoSupportsReferences(input.model)));
  if (wantReferences && !veoSupportsReferences(input.model)) {
    return input.json({ error: "Model ini menerima satu gambar, atau gambar awal dan akhir." }, 400);
  }
  if (wantReferences && input.images.length > 1 && input.duration !== 8) {
    return input.json({ error: "Beberapa gambar pada Veo hanya untuk durasi 8 detik." }, 400);
  }
  const inline = async (item: GeminiImage) => {
    const part = await geminiImagePart(supabaseAdmin, item);
    return part ? { inlineData: { mimeType: part.mime_type, data: part.data } } : null;
  };
  const ugcPromptTail = ugcLook
    ? "\n\nRestyle camera and lighting to UGC: iPhone 17 Pro Max handheld, super high contrast, advertisement lighting. Do not preserve cinematic soft lighting or filmic bokeh from the still."
    : "";
  const instance: Record<string, unknown> = {
    prompt: `${input.generateAudio ? input.prompt : `${input.prompt}\n\nSilent video. No speech, music, or sound effects.`}${ugcPromptTail}`,
  };
  if (endPair) {
    const first = await inline(input.images[0]);
    const last = await inline(input.images[1]);
    if (!first || !last) return input.json({ error: "Gambar brief tidak bisa dibaca" }, 500);
    instance.image = first;
    instance.lastFrame = last;
  } else if (wantReferences) {
    const referenceImages = [];
    for (const item of input.images) {
      const image = await inline(item);
      if (!image) return input.json({ error: "Gambar brief tidak bisa dibaca" }, 500);
      referenceImages.push({ image, referenceType: "asset" });
    }
    instance.referenceImages = referenceImages;
  } else if (input.images[0]) {
    const image = await inline(input.images[0]);
    if (!image) return input.json({ error: "Gambar brief tidak bisa dibaca" }, 500);
    instance.image = image;
  }

  const created = await fetch(`${GOOGLE_API}/models/${input.model}:predictLongRunning`, {
    method: "POST",
    headers: { "x-goog-api-key": input.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [instance],
      parameters: {
        aspectRatio: input.ratio === "16:9" ? "16:9" : "9:16",
        durationSeconds: String(input.duration),
        resolution: input.resolution,
        personGeneration: input.images.length > 0 ? "allow_adult" : "allow_all",
      },
    }),
  });
  const createdBody = await created.json().catch(() => ({}));
  const operationName = String((createdBody as { name?: string }).name ?? "");
  if (!created.ok || !operationName) {
    return input.json({ error: geminiError(createdBody) || veoFailure(createdBody) || "Veo menolak permintaan video" }, created.status || 502);
  }

  const { data: saved, error: saveError } = await supabaseAdmin
    .from("brief_shot_videos")
    .insert({
      organization_id: input.orgId,
      social_media_plan_id: input.planId,
      scope: input.scope,
      row_index: input.rowIndexes[0],
      row_indexes: input.rowIndexes,
      status: "running",
      provider_task_id: operationName,
      model: input.model,
      resolution: input.resolution,
      duration_seconds: input.duration,
      ratio: input.ratio === "16:9" ? "16:9" : "9:16",
      generate_audio: input.generateAudio,
    })
    .select("id, organization_id, social_media_plan_id, scope, row_index, row_indexes, status, provider_task_id, storage_path, error, model, resolution, duration_seconds, created_at")
    .single();
  if (saveError || !saved) return input.json({ error: saveError?.message || "Video tidak tersimpan" }, 500);

  const rowLabel = input.scope === "master" ? "Master" : `Baris ${input.rowIndexes[0] + 1}`;
  await recordContentUsage(supabaseAdmin, {
    organizationId: input.orgId,
    planId: input.planId,
    actorUserId: input.userId,
    service: "video",
    action: input.scope === "master" ? "generate_master" : "generate_shot",
    targetLabel: `${rowLabel} · ${input.duration} dtk · ${input.resolution}`,
    model: input.model,
    status: "running",
    providerRef: operationName,
    sourceId: String(saved.id),
    promptExcerpt: input.prompt,
  });
  if (input.usageId) {
    await supabaseAdmin.from("video_ai_daily_usage").update({ count: input.currentCount + 1 }).eq("id", input.usageId);
  } else {
    await supabaseAdmin.from("video_ai_daily_usage").insert({ organization_id: input.orgId, usage_date: input.today, count: 1 });
  }

  if ((createdBody as { done?: boolean }).done) {
    const settled = await settleVeoJob(supabaseAdmin, saved as ShotVideoRow, input.apiKey, createdBody);
    return input.json({ video: settled });
  }
  return input.json({ video: saved });
}

async function refreshVeoVideo(
  supabaseAdmin: ReturnType<typeof createClient>,
  orgId: string,
  video: ShotVideoRow,
  json: (body: object, status?: number) => Response,
) {
  const { data: scriptConfig } = await supabaseAdmin
    .from("organization_script_ai_config")
    .select("google_ai_api_key")
    .eq("organization_id", orgId)
    .maybeSingle();
  const apiKey = String(scriptConfig?.google_ai_api_key ?? "").trim();
  if (!apiKey) return json({ error: "Gemini API key belum ada. Isi di Settings > Script AI Generator." }, 400);
  const response = await fetch(googleOperationUrl(String(video.provider_task_id ?? "")), {
    headers: { "x-goog-api-key": apiKey },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return json({ error: geminiError(body) || "Status video Veo tidak bisa dibaca" }, response.status);
  }
  const settled = await settleVeoJob(supabaseAdmin, video, apiKey, body);
  return json({ video: settled });
}

async function settleVeoJob(
  supabaseAdmin: ReturnType<typeof createClient>,
  video: ShotVideoRow,
  apiKey: string,
  body: unknown,
): Promise<ShotVideoRow> {
  if (!(body as { done?: boolean }).done) return video;
  const uri = veoVideoUri(body);
  if (!uri) {
    const message = veoFailure(body) || "Video Veo tidak ditemukan";
    await supabaseAdmin.from("brief_shot_videos").update({ status: "failed", error: message }).eq("id", video.id);
    await settleVideoUsage(supabaseAdmin, video, "failed", body);
    return { ...video, status: "failed", error: message };
  }
  const downloaded = await fetch(uri, { headers: { "x-goog-api-key": apiKey } });
  if (!downloaded.ok) {
    const message = "Video Veo tidak bisa diunduh";
    await supabaseAdmin.from("brief_shot_videos").update({ status: "failed", error: message }).eq("id", video.id);
    await settleVideoUsage(supabaseAdmin, video, "failed", body);
    return { ...video, status: "failed", error: message };
  }
  const bytes = new Uint8Array(await downloaded.arrayBuffer());
  const storagePath = `${video.organization_id}/${video.social_media_plan_id}/videos/${video.id}.mp4`;
  const { error: uploadError } = await supabaseAdmin.storage.from(STORYBOARD_BUCKET).upload(storagePath, bytes, {
    contentType: "video/mp4",
    upsert: true,
  });
  if (uploadError) {
    await supabaseAdmin.from("brief_shot_videos").update({ status: "failed", error: uploadError.message }).eq("id", video.id);
    await settleVideoUsage(supabaseAdmin, video, "failed", body);
    return { ...video, status: "failed", error: uploadError.message };
  }
  await supabaseAdmin.from("brief_shot_videos").update({ status: "succeeded", storage_path: storagePath, error: null }).eq("id", video.id);
  await settleVideoUsage(supabaseAdmin, video, "succeeded", body);
  return { ...video, status: "succeeded", storage_path: storagePath, error: null };
}

function veoVideoUri(body: unknown): string {
  const response = (body as { response?: { generateVideoResponse?: { generatedSamples?: Array<{ video?: { uri?: string } }> }; generatedVideos?: Array<{ video?: { uri?: string } }> } }).response;
  return response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
    || response?.generatedVideos?.[0]?.video?.uri
    || "";
}

function veoFailure(body: unknown): string {
  const response = (body as { response?: { generateVideoResponse?: { raiMediaFilteredReasons?: string[] } } }).response;
  const reasons = response?.generateVideoResponse?.raiMediaFilteredReasons?.filter((reason) => Boolean(reason)) ?? [];
  if (reasons.length > 0) return reasons.join(" ");
  return geminiError(body);
}

function geminiPrompt(prompt: string, imageCount: number, endPair: boolean, generateAudio: boolean): string {
  const silent = generateAudio ? "" : "\n\nSilent video. No speech, music, or sound effects.";
  const ugcLook = promptHasUgcLook(prompt);
  const ugcRestyle = ugcLook
    ? " Restyle camera and lighting to UGC: iPhone 17 Pro Max handheld, super high contrast, advertisement lighting. Use the still for subject and framing only. Do not keep cinematic soft lighting or filmic shallow depth of field from the still."
    : "";
  if (endPair) {
    return `[# Sources <FIRST_FRAME>@Image1 <LAST_FRAME>@Image2]\n${prompt}\nUse Image1 as the starting frame and Image2 as the ending frame.${ugcRestyle}${silent}`;
  }
  if (ugcLook || imageCount > 1) {
    const refs = Array.from({ length: Math.max(1, imageCount) }, (_, index) => `<IMAGE_REF_${index}>@Image${index + 1}`).join(" ");
    return `[# References ${refs}]\n${prompt}\nUse the given images as references for video generation. The images should not be used as literal initial frames.${ugcRestyle}${silent}`;
  }
  return `[# Sources <FIRST_FRAME>@Image1]\n${prompt}\nUse Image1 as the starting frame.${silent}`;
}

async function geminiImagePart(
  supabaseAdmin: ReturnType<typeof createClient>,
  item: GeminiImage,
): Promise<{ type: "image"; data: string; mime_type: string } | null> {
  const { data, error } = await supabaseAdmin.storage.from(item.bucket).download(item.path);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  const extension = item.path.split(".").pop()?.toLowerCase();
  const mime = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
  return { type: "image", data: bytesToBase64(bytes), mime_type: mime };
}

function geminiVideoRef(body: unknown): { data?: string; uri?: string } | null {
  const record = body as {
    output_video?: { data?: string; uri?: string };
    steps?: Array<{ type?: string; content?: Array<{ type?: string; data?: string; uri?: string }> }>;
  };
  if (record.output_video?.data || record.output_video?.uri) return record.output_video;
  for (const step of record.steps ?? []) {
    if (step.type !== "model_output") continue;
    for (const part of step.content ?? []) {
      if (part.type === "video" && (part.data || part.uri)) return { data: part.data, uri: part.uri };
    }
  }
  return null;
}

async function downloadGeminiVideo(apiKey: string, ref: { data?: string; uri?: string }): Promise<Uint8Array | null> {
  if (ref.data) return base64ToBytes(ref.data);
  const fileId = String(ref.uri ?? "").match(/files\/([^/:?]+)/)?.[1] ?? "";
  if (!fileId) return null;
  let active = false;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const info = await fetch(`https://generativelanguage.googleapis.com/v1beta/files/${fileId}?key=${encodeURIComponent(apiKey)}`);
    const meta = await info.json().catch(() => ({}));
    const state = fileState(meta);
    if (state === "FAILED") return null;
    if (state === "ACTIVE") {
      active = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  if (!active) return null;
  const downloaded = await fetch(`https://generativelanguage.googleapis.com/v1beta/files/${fileId}:download?alt=media&key=${encodeURIComponent(apiKey)}`);
  if (!downloaded.ok) return null;
  return new Uint8Array(await downloaded.arrayBuffer());
}

function fileState(meta: unknown): string {
  if (!meta || typeof meta !== "object") return "";
  const state = (meta as { state?: unknown }).state;
  if (typeof state === "string") return state.toUpperCase();
  if (state && typeof state === "object" && typeof (state as { name?: string }).name === "string") {
    return String((state as { name: string }).name).toUpperCase();
  }
  return "";
}

function geminiError(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const record = body as { error?: { message?: string } | string; message?: string };
  if (typeof record.error === "string") return record.error;
  if (record.error && typeof record.error === "object" && record.error.message) return String(record.error.message);
  return typeof record.message === "string" ? record.message : "";
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const size = 0x8000;
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function findVideoUrl(task: unknown): string {
  const record = task && typeof task === "object" ? task as Record<string, unknown> : {};
  const content = record.content && typeof record.content === "object" ? record.content as Record<string, unknown> : {};
  const output = record.output && typeof record.output === "object" ? record.output as Record<string, unknown> : {};
  const candidates = [content.video_url, output.video_url, record.video_url];
  const found = candidates.find((value) => typeof value === "string" && value.startsWith("http"));
  return typeof found === "string" ? found : "";
}
