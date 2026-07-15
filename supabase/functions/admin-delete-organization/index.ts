import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DeleteRequest = {
  organization_id: string;
  confirm_name: string;
  confirm_phrase: string;
  reason: string;
};

type RpcDeleteResult = {
  audit_id: string;
  organization_id: string;
  company_name: string;
  deleted_counts: Record<string, number>;
  auth_users_to_delete: string[];
  storage_prefix: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function removeStorageFolder(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  folder: string,
): Promise<number> {
  const { data: entries, error } = await admin.storage.from(bucket).list(folder, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });

  if (error || !entries?.length) {
    return 0;
  }

  let deleted = 0;
  const filePaths: string[] = [];

  for (const entry of entries) {
    const path = folder ? `${folder}/${entry.name}` : entry.name;
    if (entry.id === null) {
      deleted += await removeStorageFolder(admin, bucket, path);
    } else {
      filePaths.push(path);
    }
  }

  if (filePaths.length > 0) {
    const { error: removeError } = await admin.storage.from(bucket).remove(filePaths);
    if (!removeError) {
      deleted += filePaths.length;
    }
  }

  return deleted;
}

async function purgeOrganizationStorage(
  admin: ReturnType<typeof createClient>,
  organizationId: string,
): Promise<number> {
  const prefix = `${organizationId}/`;
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error || !buckets?.length) {
    return 0;
  }

  let deleted = 0;
  for (const bucket of buckets) {
    deleted += await removeStorageFolder(admin, bucket.name, prefix.slice(0, -1));
  }
  return deleted;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ error: "server misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let body: DeleteRequest;
  try {
    body = (await req.json()) as DeleteRequest;
  } catch {
    return jsonResponse({ error: "invalid json body" }, 400);
  }

  const { organization_id, confirm_name, confirm_phrase, reason } = body;
  if (!organization_id || !confirm_name || !confirm_phrase || !reason) {
    return jsonResponse({ error: "missing required fields" }, 400);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const { data: isAdmin, error: adminError } = await userClient.rpc("is_cms_admin");
  if (adminError || !isAdmin) {
    return jsonResponse({ error: "not allowed" }, 403);
  }

  const { data: rpcResult, error: rpcError } = await userClient.rpc("admin_delete_organization", {
    p_organization_id: organization_id,
    p_confirm_name: confirm_name,
    p_confirm_phrase: confirm_phrase,
    p_reason: reason,
  });

  if (rpcError) {
    const message = rpcError.message ?? "delete failed";
    const status = message.includes("not allowed") ? 403 : 400;
    return jsonResponse({ error: message }, status);
  }

  const result = rpcResult as RpcDeleteResult;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  let deletedAuthUsers = 0;
  const authUserIds = result.auth_users_to_delete ?? [];

  for (const userId of authUserIds) {
    await adminClient.auth.admin.signOut(userId, "global");
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (!deleteError) {
      deletedAuthUsers += 1;
    }
  }

  const deletedStorageObjects = await purgeOrganizationStorage(adminClient, organization_id);

  return jsonResponse({
    audit_id: result.audit_id,
    organization_id: result.organization_id,
    company_name: result.company_name,
    deleted_counts: result.deleted_counts,
    auth_users_to_delete: authUserIds,
    deleted_auth_users: deletedAuthUsers,
    deleted_storage_objects: deletedStorageObjects,
    storage_prefix: result.storage_prefix,
  });
});
