/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  extractTriggerConfigFromGraph,
  isAutomationFlowGraphValid,
  validateAutomationFlowGraph,
} from "../_shared/omnichannelFlow/graphValidator.ts";
import {
  getUserFromBearer,
  omnichannelFlowCorsHeaders,
  omnichannelFlowJson,
  requireOmnichannelFlowAdmin,
  resolveEmployeeIdForUser,
} from "../_shared/omnichannelFlow/omnichannelFlowAuth.ts";

const DEFAULT_GRAPH = {
  nodes: [
    {
      id: "start-1",
      type: "start",
      position: { x: 0, y: 0 },
      data: {
        triggerType: "incoming_message_received",
        phoneNumberIds: [],
        enrollmentFilters: [],
      },
    },
    {
      id: "end-1",
      type: "end",
      position: { x: 0, y: 200 },
      data: {},
    },
  ],
  edges: [{ id: "e-start-end", source: "start-1", target: "end-1" }],
  viewport: { x: 0, y: 0, zoom: 1 },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: omnichannelFlowCorsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const authResult = await getUserFromBearer(admin, req.headers.get("Authorization"));
    if ("error" in authResult) return authResult.error;
    const userId = authResult.userId;

    const { data: profile } = await admin
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", userId)
      .maybeSingle();
    const orgId = profile?.active_organization_id as string | null;
    if (!orgId) {
      return omnichannelFlowJson({ error: "No active organization" }, 400);
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const fnIndex = pathParts.indexOf("automation-flow-api");
    const subPath = fnIndex >= 0 ? pathParts.slice(fnIndex + 1) : [];
    const flowId = subPath[0] ?? null;
    const action = subPath[1] ?? null;

    const employeeId = await resolveEmployeeIdForUser(admin, userId, orgId);

    if (req.method === "GET" && !flowId) {
      const { data, error } = await admin
        .from("omnichannel_automation_flows")
        .select("*")
        .eq("organization_id", orgId)
        .order("updated_at", { ascending: false });
      if (error) return omnichannelFlowJson({ error: error.message }, 500);
      return omnichannelFlowJson({ flows: data ?? [] }, 200);
    }

    if (req.method === "GET" && flowId) {
      const { data, error } = await admin
        .from("omnichannel_automation_flows")
        .select("*")
        .eq("organization_id", orgId)
        .eq("id", flowId)
        .maybeSingle();
      if (error) return omnichannelFlowJson({ error: error.message }, 500);
      if (!data) return omnichannelFlowJson({ error: "Not found" }, 404);
      return omnichannelFlowJson({ flow: data }, 200);
    }

    if (req.method === "POST" && !flowId) {
      const body = await req.json().catch(() => ({}));
      const name = String(body.name ?? "").trim();
      if (!name) return omnichannelFlowJson({ error: "name is required" }, 400);

      const graph = body.graph_json ?? DEFAULT_GRAPH;
      const triggerConfig = extractTriggerConfigFromGraph(graph);

      const { data, error } = await admin
        .from("omnichannel_automation_flows")
        .insert({
          organization_id: orgId,
          name,
          status: "draft",
          graph_json: graph,
          trigger_config: triggerConfig,
          re_enrollment_rule: body.re_enrollment_rule ?? "not_in_flow",
          created_by_employee_id: employeeId,
          updated_by_employee_id: employeeId,
        })
        .select("*")
        .single();

      if (error) return omnichannelFlowJson({ error: error.message }, 500);
      return omnichannelFlowJson({ flow: data }, 201);
    }

    if (req.method === "PATCH" && flowId && action !== "publish") {
      const body = await req.json().catch(() => ({}));
      const patch: Record<string, unknown> = {
        updated_by_employee_id: employeeId,
        updated_at: new Date().toISOString(),
      };
      if (body.name != null) patch.name = String(body.name).trim();
      if (body.graph_json != null) {
        patch.graph_json = body.graph_json;
        patch.trigger_config = extractTriggerConfigFromGraph(body.graph_json);
      }
      if (body.re_enrollment_rule != null) patch.re_enrollment_rule = body.re_enrollment_rule;
      if (body.status != null && ["draft", "archived"].includes(String(body.status))) {
        patch.status = body.status;
      }

      const { data, error } = await admin
        .from("omnichannel_automation_flows")
        .update(patch)
        .eq("organization_id", orgId)
        .eq("id", flowId)
        .select("*")
        .single();

      if (error) return omnichannelFlowJson({ error: error.message }, 500);
      return omnichannelFlowJson({ flow: data }, 200);
    }

    if (req.method === "POST" && flowId && action === "publish") {
      const forbidden = await requireOmnichannelFlowAdmin(admin, userId, orgId);
      if (forbidden) return forbidden;

      const { data: existing, error: fetchErr } = await admin
        .from("omnichannel_automation_flows")
        .select("*")
        .eq("organization_id", orgId)
        .eq("id", flowId)
        .maybeSingle();
      if (fetchErr) return omnichannelFlowJson({ error: fetchErr.message }, 500);
      if (!existing) return omnichannelFlowJson({ error: "Not found" }, 404);

      const graph = existing.graph_json as Record<string, unknown>;
      const issues = validateAutomationFlowGraph(graph);
      if (!isAutomationFlowGraphValid(graph)) {
        return omnichannelFlowJson({ error: "Invalid graph", issues }, 400);
      }

      const { data, error } = await admin
        .from("omnichannel_automation_flows")
        .update({
          status: "active",
          published_graph_json: graph,
          published_at: new Date().toISOString(),
          published_by_employee_id: employeeId,
          version: Number(existing.version ?? 1) + 1,
          trigger_config: extractTriggerConfigFromGraph(graph),
          updated_by_employee_id: employeeId,
        })
        .eq("id", flowId)
        .select("*")
        .single();

      if (error) return omnichannelFlowJson({ error: error.message }, 500);
      return omnichannelFlowJson({ flow: data }, 200);
    }

    if (req.method === "DELETE" && flowId) {
      const { error } = await admin
        .from("omnichannel_automation_flows")
        .delete()
        .eq("organization_id", orgId)
        .eq("id", flowId);
      if (error) return omnichannelFlowJson({ error: error.message }, 500);
      return omnichannelFlowJson({ ok: true }, 200);
    }

    return omnichannelFlowJson({ error: "Not found" }, 404);
  } catch (err) {
    console.error("automation-flow-api error:", err);
    return omnichannelFlowJson({ error: String(err) }, 500);
  }
});
