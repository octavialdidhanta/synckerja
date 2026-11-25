import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildDescribePrompt,
  draftLanguage,
  geminiModel,
  parseDraftFields,
  resolveProductLook,
  templateFields,
  type LookSubcategory,
  type TemplateField,
} from "../_shared/describeCatalogProduct.ts";

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
  if (ext === "gif") return "image/gif";
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

  const body = await req.json().catch(() => ({})) as { menu_id?: unknown };
  const menuId = String(body.menu_id ?? "").trim();
  if (!UUID.test(menuId)) return json({ error: "invalid_input" }, 400);

  const { data: menu, error: menuError } = await admin
    .from("catalog_menus")
    .select("id,name,default_price_id,feature_id,sub_service_id")
    .eq("id", menuId)
    .eq("organization_id", orgId)
    .maybeSingle();
  let product = menu;
  if (menuError && /default_price_id|feature_id|sub_service_id|does not exist/i.test(menuError.message)) {
    const again = await admin
      .from("catalog_menus")
      .select("id,name")
      .eq("id", menuId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (again.error) return json({ error: again.error.message }, 500);
    product = again.data
      ? { ...again.data, default_price_id: null, feature_id: null, sub_service_id: null }
      : null;
  } else if (menuError) {
    return json({ error: menuError.message }, 500);
  }
  if (!product) return json({ error: "not_found" }, 404);

  const [{ data: fieldRows }, { data: photoRows }, { data: defRows }, { data: config }] = await Promise.all([
    admin.from("catalog_menu_fields").select("body").eq("organization_id", orgId).eq("menu_id", menuId),
    admin
      .from("catalog_menu_photos")
      .select("storage_path,position")
      .eq("organization_id", orgId)
      .eq("menu_id", menuId)
      .is("deleted_at", null)
      .order("position"),
    admin
      .from("catalog_menu_field_defs")
      .select("field_key,label,position")
      .eq("organization_id", orgId)
      .order("position"),
    admin.from("organization_script_ai_config").select("google_ai_api_key,model").eq("organization_id", orgId).maybeSingle(),
  ]);

  const priceId = product.default_price_id ?? null;
  const featureId = product.feature_id ?? null;
  const subId = product.sub_service_id ?? null;
  let itemPath: string | null = null;
  let linkedSubcategoryPath: string | null = null;
  let items: Array<{ name: string }> = [];
  let subcategories: LookSubcategory[] = [];
  if (priceId) {
    const { data: price } = await admin
      .from("default_prices")
      .select("photo_path")
      .eq("id", priceId)
      .eq("organization_id", orgId)
      .eq("kind", "product")
      .maybeSingle();
    itemPath = price?.photo_path ?? null;
  } else if (subId) {
    const { data: sub } = await admin
      .from("sub_services")
      .select("image_path")
      .eq("id", subId)
      .eq("organization_id", orgId)
      .maybeSingle();
    linkedSubcategoryPath = sub?.image_path ?? null;
  } else if (!featureId) {
    const [prices, subs] = await Promise.all([
      admin.from("default_prices").select("name").eq("organization_id", orgId).eq("kind", "product"),
      admin
        .from("sub_services")
        .select("name,image_path,catalog_product_id")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("name"),
    ]);
    if (!prices.error && !subs.error) {
      items = (prices.data ?? []).map((row) => ({ name: row.name ?? "" }));
      subcategories = (subs.data ?? []).map((row) => ({
        name: row.name ?? "",
        imagePath: row.image_path ?? null,
        catalogProductId: row.catalog_product_id ?? null,
      }));
    }
  }

  const photo = resolveProductLook({
    menuName: product.name,
    defaultPriceId: priceId,
    featureId,
    subServiceId: subId,
    itemPath,
    linkedSubcategoryPath,
    items,
    subcategories,
    catalogPaths: (photoRows ?? []).map((row) => row.storage_path),
  });
  if (!photo) return json({ error: "no_photo" }, 400);

  const apiKey = String(config?.google_ai_api_key ?? "").trim();
  if (!apiKey) return json({ error: "Kunci Gemini belum diisi di Settings > Script AI." }, 400);

  const downloaded = await admin.storage.from(photo.bucket).download(photo.path);
  if (downloaded.error || !downloaded.data) return json({ error: "Foto tidak bisa dibaca." }, 400);
  const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
  if (bytes.byteLength < 32 || bytes.byteLength > 5_000_000) return json({ error: "Foto tidak bisa dibaca." }, 400);

  const fields: TemplateField[] = templateFields(
    (defRows ?? []).map((row) => ({ key: row.field_key, label: row.label, position: row.position })),
  );
  const language = draftLanguage((fieldRows ?? []).map((row) => row.body ?? ""));
  const model = geminiModel(config?.model);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType: mimeFromPath(photo.path), data: bytesToBase64(bytes) } },
            { text: buildDescribePrompt({ name: product.name, fields, language }) },
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
  const draft = parseDraftFields(text, fields.map((field) => field.key));
  if (Object.keys(draft).length === 0) return json({ error: "Gemini tidak mengembalikan draf." }, 502);
  return json({ fields: draft });
});
