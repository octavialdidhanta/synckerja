import { createClient } from "@supabase/supabase-js";
import { signAccessToken } from "../src/oauth/tokens";

const config = {
  publicUrl: (process.env.MCP_PUBLIC_URL || "").replace(/\/+$/, ""),
  officeOrigin: process.env.OFFICE_ORIGIN || "",
  jwtSecret: process.env.MCP_JWT_SECRET || "",
  port: 8787,
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  scheduledPostsInternalSecret: "probe",
};
const admin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await admin
  .from("mcp_oauth_refresh_tokens")
  .select("user_id, profile_id, organization_id, employee_id, scope, client_id, expires_at, revoked_at")
  .is("revoked_at", null)
  .gt("expires_at", new Date().toISOString())
  .order("created_at", { ascending: false })
  .limit(5);

if (error) throw error;
const grant = (data ?? []).find((row) => String(row.scope).includes("tasks:write")) ?? data?.[0];
if (!grant) throw new Error("no_grant");

const accessToken = await signAccessToken(config, {
  userId: grant.user_id,
  profileId: grant.profile_id,
  organizationId: grant.organization_id,
  employeeId: grant.employee_id,
  scope: grant.scope,
  clientId: grant.client_id,
});

const response = await fetch(`${config.publicUrl}/mcp`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  },
  body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
});

const text = await response.text();
if (!response.ok) {
  console.log("status", response.status, text.slice(0, 300));
  process.exit(1);
}

const body = JSON.parse(text) as {
  result?: { tools?: { name: string; inputSchema?: { properties?: Record<string, unknown>; required?: string[]; additionalProperties?: boolean } }[] };
  error?: unknown;
};
if (body.error) {
  console.log("rpc_error", JSON.stringify(body.error).slice(0, 400));
  process.exit(1);
}

for (const name of ["tasks.create", "tasks.update", "tasks.list"]) {
  const tool = body.result?.tools?.find((item) => item.name === name);
  if (!tool) {
    console.log(name, "MISSING");
    continue;
  }
  const schema = tool.inputSchema;
  console.log(name, "required", schema?.required ?? []);
  console.log(name, "properties", Object.keys(schema?.properties ?? {}));
  console.log(name, "plan_month", JSON.stringify(schema?.properties?.plan_month ?? null));
  console.log(name, "month", JSON.stringify(schema?.properties?.month ?? null));
  console.log(name, "additional", schema?.additionalProperties);
}
