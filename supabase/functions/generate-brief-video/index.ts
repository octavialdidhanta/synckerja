/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    return await createVideo(supabaseAdmin, orgId, body, json);
  } catch (error) {
    console.error("generate-brief-video", error);
    return json({ error: error instanceof Error ? error.message : "Video AI could not finish" }, 500);
  }
});

async function createVideo(
  supabaseAdmin: ReturnType<typeof createClient>,
  orgId: string,
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
  if (!planId || !scope || rowIndexes.length === 0 || !prompt) return json({ error: "Data video tidak lengkap" }, 400);
  if (!MODELS.has(model)) return json({ error: "Model video tidak dikenal" }, 400);
  if (!RESOLUTIONS.has(resolution)) return json({ error: "Resolusi video tidak dikenal" }, 400);
  if (!RATIOS.has(ratio)) return json({ error: "Rasio video tidak dikenal" }, 400);
  const maxDuration = model === "dreamina-seedance-2-0-260128" ? 15 : 30;
  if (![5, 10, 15, 20, 25, 30].includes(duration) || duration > maxDuration) {
    return json({ error: `Durasi harus kelipatan 5, paling lama ${maxDuration} detik untuk model ini` }, 400);
  }

  const { data: plan } = await supabaseAdmin
    .from("social_media_plans")
    .select("id, organization_id")
    .eq("id", planId)
    .maybeSingle();
  if (!plan || plan.organization_id !== orgId) return json({ error: "Brief ini bukan milik organisasi aktif" }, 403);

  const { data: config } = await supabaseAdmin
    .from("organization_video_ai_config")
    .select("byteplus_api_key, api_key_configured, daily_limit")
    .eq("organization_id", orgId)
    .maybeSingle();
  const apiKey = String(config?.byteplus_api_key ?? "").trim();
  if (!config?.api_key_configured || !apiKey) {
    return json({ error: "Video AI belum dikonfigurasi. Buka Settings > Video AI Generator." }, 400);
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: usageRow } = await supabaseAdmin
    .from("video_ai_daily_usage")
    .select("id, count")
    .eq("organization_id", orgId)
    .eq("usage_date", today)
    .maybeSingle();
  const dailyLimit = Math.max(1, config.daily_limit ?? 20);
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
  if (!endImageId && missingMentions.length > 0) {
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
  const imageCap = model === "dreamina-seedance-2-0-260128" ? 9 : 30;
  if (images.length > imageCap) return json({ error: `Model ini menerima paling banyak ${imageCap} gambar` }, 400);
  const signed = await Promise.all(images.map(async (item) => ({
    ...item,
    url: await signImage(supabaseAdmin, item.bucket, item.path),
  })));
  if (signed.some((item) => !item.url)) return json({ error: "Gambar brief tidak bisa dibaca" }, 500);

  const useReference = !endImageId && signed.length > 1;
  const matchLines = endImageId
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
    const message = (createdBody as { error?: { message?: string } }).error?.message || "Seedance menolak permintaan video";
    return json({ error: message }, created.status || 502);
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
    .select("id, organization_id, social_media_plan_id, status, provider_task_id, storage_path")
    .eq("id", videoId)
    .maybeSingle();
  if (!video || video.organization_id !== orgId) return json({ error: "Video tidak ditemukan" }, 404);
  if (video.status === "succeeded" || video.status === "failed" || !video.provider_task_id) return json({ video });

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
    return json({ video: { ...video, status: "failed", error: message } });
  }
  const videoUrl = findVideoUrl(task);
  if (!videoUrl) {
    await supabaseAdmin.from("brief_shot_videos").update({ status: "failed", error: "URL video tidak ada" }).eq("id", video.id);
    return json({ video: { ...video, status: "failed", error: "URL video tidak ada" } });
  }
  const downloaded = await fetch(videoUrl);
  if (!downloaded.ok) {
    await supabaseAdmin.from("brief_shot_videos").update({ status: "failed", error: "Video tidak bisa diunduh" }).eq("id", video.id);
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
    return json({ video: { ...video, status: "failed", error: uploadError.message } });
  }
  await supabaseAdmin.from("brief_shot_videos").update({ status: "succeeded", storage_path: storagePath, error: null }).eq("id", video.id);
  return json({ video: { ...video, status: "succeeded", storage_path: storagePath, error: null } });
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

function findVideoUrl(task: unknown): string {
  const record = task && typeof task === "object" ? task as Record<string, unknown> : {};
  const content = record.content && typeof record.content === "object" ? record.content as Record<string, unknown> : {};
  const output = record.output && typeof record.output === "object" ? record.output as Record<string, unknown> : {};
  const candidates = [content.video_url, output.video_url, record.video_url];
  const found = candidates.find((value) => typeof value === "string" && value.startsWith("http"));
  return typeof found === "string" ? found : "";
}
