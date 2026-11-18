/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  decryptPassword,
  encryptPassword,
  passwordStrength,
} from "../_shared/passwordVaultCrypto.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function isEmployee(admin: SupabaseClient, userId: string, organizationId: string): Promise<boolean> {
  const { data } = await admin
    .from("employees")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

type PasswordRow = {
  id: string;
  user_id: string;
  organization_id: string;
  password_ciphertext?: string | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Server configuration error" }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Unauthorized" }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const action = String(body.action ?? "").trim();

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user ?? null;
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  if (action === "reveal") {
    const id = String(body.id ?? "").trim();
    if (!id) return json({ error: "Missing id" }, 400);
    const { data: row, error } = await admin
      .from("passwords")
      .select("id, user_id, organization_id, password_ciphertext")
      .eq("id", id)
      .maybeSingle();
    if (error) return json({ error: "reveal_failed" }, 500);
    if (!row) return json({ error: "Not found" }, 404);
    const record = row as PasswordRow;
    if (record.user_id !== user.id) return json({ error: "Forbidden" }, 403);
    if (!(await isEmployee(admin, user.id, record.organization_id))) {
      return json({ error: "Forbidden" }, 403);
    }
    if (!record.password_ciphertext) return json({ error: "password_unavailable" }, 404);
    const password = await decryptPassword(record.password_ciphertext);
    return json({ password }, 200);
  }

  if (action !== "save" && action !== "update") return json({ error: "Unknown action" }, 400);

  const organizationId = String(body.organization_id ?? "").trim();
  const title = String(body.title ?? "").trim();
  const username = String(body.username ?? "").trim();
  const categoryId = String(body.category_id ?? "").trim();
  const password = String(body.password ?? "");
  if (!organizationId || !title || !username || !categoryId) {
    return json({ error: "Missing required fields" }, 400);
  }
  if (!(await isEmployee(admin, user.id, organizationId))) return json({ error: "Forbidden" }, 403);

  const fields = {
    title,
    username,
    url: body.url != null && String(body.url).trim() ? String(body.url).trim() : null,
    category_id: categoryId,
    notes: body.notes != null && String(body.notes).trim() ? String(body.notes) : null,
    is_favorite: Boolean(body.is_favorite),
    updated_at: new Date().toISOString(),
  };

  if (action === "save") {
    if (!password) return json({ error: "Missing password" }, 400);
    const { error } = await admin.from("passwords").insert({
      user_id: user.id,
      organization_id: organizationId,
      ...fields,
      password_ciphertext: await encryptPassword(password),
      password_strength: passwordStrength(password),
    });
    if (error) return json({ error: "save_failed" }, 400);
    return json({ ok: true }, 200);
  }

  const id = String(body.id ?? "").trim();
  if (!id) return json({ error: "Missing id" }, 400);
  const { data: existing, error: existingError } = await admin
    .from("passwords")
    .select("id, user_id, organization_id")
    .eq("id", id)
    .maybeSingle();
  if (existingError) return json({ error: "update_failed" }, 500);
  if (!existing) return json({ error: "Not found" }, 404);
  const record = existing as PasswordRow;
  if (record.user_id !== user.id || record.organization_id !== organizationId) {
    return json({ error: "Forbidden" }, 403);
  }

  const update: Record<string, unknown> = { ...fields };
  if (password) {
    update.password_ciphertext = await encryptPassword(password);
    update.password_strength = passwordStrength(password);
  }
  const { error } = await admin.from("passwords").update(update).eq("id", id).eq("user_id", user.id);
  if (error) return json({ error: "update_failed" }, 400);
  return json({ ok: true }, 200);
});
