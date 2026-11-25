import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { draftLanguage, geminiModel, parseDraftFields } from "../_shared/describeCatalogProduct.ts";
import { LOCATION_DRAFT_FIELDS, buildLocationDescribePrompt } from "../_shared/describeCatalogLocation.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return btoa(binary);
}

function mimeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

async function memberOf(admin: SupabaseClient, userId: string, orgId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("user_organizations")
    .select("user_id")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .or("is_active.is.null,is_active.eq.true")
    .maybeSingle();
  return !error && Boolean(data);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!supabaseUrl || !serviceKey || !token) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, serviceKey, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Invalid token" }, 401);

  const { data: profile } = await admin
    .from("profiles")
    .select("active_organization_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  const orgId = profile?.active_organization_id ?? "";
  if (!orgId || !(await memberOf(admin, userData.user.id, orgId))) {
    return json({ error: "No active organization" }, 403);
  }

  const body = await req.json().catch(() => ({})) as { photo_id?: unknown };
  const photoId = String(body.photo_id ?? "").trim();
  if (!UUID.test(photoId)) return json({ error: "invalid_input" }, 400);

  const { data: photo, error: photoError } = await admin
    .from("catalog_location_photos")
    .select("id,location_id,label,storage_path,description")
    .eq("id", photoId)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  if (photoError) return json({ error: photoError.message }, 500);
  if (!photo) return json({ error: "not_found" }, 404);
  const storagePath = String(photo.storage_path ?? "").trim();
  if (!storagePath) return json({ error: "no_photo" }, 400);

  const [{ data: location, error: locationError }, { data: photoTexts, error: textsError }, { data: sectionRows, error: sectionError }, { data: config }] = await Promise.all([
    admin.from("catalog_locations").select("id,name").eq("id", photo.location_id).eq("organization_id", orgId).maybeSingle(),
    admin
      .from("catalog_location_photos")
      .select("description")
      .eq("organization_id", orgId)
      .eq("location_id", photo.location_id)
      .is("deleted_at", null),
    admin.from("catalog_location_sections").select("body").eq("organization_id", orgId).eq("location_id", photo.location_id),
    admin.from("organization_script_ai_config").select("google_ai_api_key,model").eq("organization_id", orgId).maybeSingle(),
  ]);
  if (locationError) return json({ error: locationError.message }, 500);
  if (textsError) return json({ error: textsError.message }, 500);
  if (sectionError) return json({ error: sectionError.message }, 500);
  if (!location) return json({ error: "not_found" }, 404);

  const apiKey = String(config?.google_ai_api_key ?? "").trim();
  if (!apiKey) return json({ error: "Kunci Gemini belum diisi di Settings > Script AI." }, 400);

  const downloaded = await admin.storage.from("catalog-media").download(storagePath);
  if (downloaded.error || !downloaded.data) return json({ error: "Foto tidak bisa dibaca." }, 400);
  const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
  if (bytes.byteLength < 32 || bytes.byteLength > 5_000_000) return json({ error: "Foto tidak bisa dibaca." }, 400);

  const bodies = [
    ...(photoTexts ?? []).map((row) => row.description ?? ""),
    ...(sectionRows ?? []).map((row) => row.body ?? ""),
  ];
  const language = draftLanguage(bodies);
  const model = geminiModel(config?.model);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType: mimeFromPath(storagePath), data: bytesToBase64(bytes) } },
            { text: buildLocationDescribePrompt({ name: location.name ?? "", photoLabel: photo.label ?? "", language }) },
          ],
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } },
      }),
    },
  );
  if (!response.ok) {
    const errText = await response.text();
    let message = errText.slice(0, 500);
    try {
      const parsed = JSON.parse(errText) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      // Keep the raw text when Gemini did not return JSON.
    }
    return json({ error: message }, response.status);
  }
  const payload = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = (payload.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? "").join("\n");
  const draft = parseDraftFields(text, LOCATION_DRAFT_FIELDS.map((field) => field.key));
  if (Object.keys(draft).length === 0) return json({ error: "Gemini tidak mengembalikan draf." }, 502);
  return json({ fields: draft });
});
