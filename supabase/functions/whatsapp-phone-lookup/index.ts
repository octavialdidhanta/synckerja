/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  metaContentCorsHeaders,
  metaContentJson,
  requireActiveOrg,
} from "../_shared/metaContentAuth.ts";
import { isOrgOwnerOrAdmin } from "../_shared/orgDrive/access.ts";
import {
  META_GRAPH_API_VERSION,
  parsePhoneProfile,
  pickDisplayPhoneFromList,
} from "./phoneLookup.ts";

/**
 * Looks up a WhatsApp Phone Number ID at Meta for the connect form, using a token the browser never sees:
 * the token typed into the form (sent once, not stored here), else the number's stored token, else the
 * org's shared Meta token. Owner/admin only, same as saving the connection.
 */
type Body = {
  organization_id?: string;
  phone_number_id?: string;
  waba_id?: string;
  account_id?: string;
  access_token?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: metaContentCorsHeaders });
  if (req.method !== "POST") return metaContentJson({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return metaContentJson({ error: "Server misconfigured" }, 500);
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  const body = (await req.json().catch(() => ({}))) as Body;
  const organizationId = String(body.organization_id ?? "").trim();
  const pnId = String(body.phone_number_id ?? "").trim();
  const wabaId = String(body.waba_id ?? "").trim();
  if (!organizationId || !pnId) return metaContentJson({ error: "organization_id dan phone_number_id wajib diisi." }, 400);

  const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
  if (orgForbidden) return orgForbidden;
  if (!(await isOrgOwnerOrAdmin(admin, userRes.userId, organizationId))) {
    return metaContentJson({ error: "Hanya owner atau admin yang bisa menghubungkan WhatsApp." }, 403);
  }

  let token = String(body.access_token ?? "").trim();
  if (!token && body.account_id) {
    const { data } = await admin
      .from("organization_whatsapp_accounts")
      .select("meta_access_token")
      .eq("id", String(body.account_id))
      .eq("organization_id", organizationId)
      .maybeSingle();
    token = String((data as { meta_access_token?: string } | null)?.meta_access_token ?? "").trim();
  }
  if (!token) {
    const { data } = await admin
      .from("organization_meta_config")
      .select("meta_access_token")
      .eq("organization_id", organizationId)
      .maybeSingle();
    token = String((data as { meta_access_token?: string } | null)?.meta_access_token ?? "").trim();
  }
  if (!token) return metaContentJson({ error: "Access token belum ada. Isi token atau simpan token bersama dulu." }, 400);

  const graph = (path: string) =>
    fetch(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

  try {
    const res = await graph(encodeURIComponent(pnId));
    const profile = parsePhoneProfile(res.ok, await res.json().catch(() => null));
    if (!profile.display_phone_number && wabaId) {
      const list = await graph(`${encodeURIComponent(wabaId)}/phone_numbers`);
      profile.display_phone_number = pickDisplayPhoneFromList(list.ok, await list.json().catch(() => null), pnId);
    }
    return metaContentJson(profile, 200);
  } catch (error) {
    return metaContentJson({ error: error instanceof Error ? error.message : "Gagal mengecek nomor di Meta." }, 422);
  }
});
