import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  evaluateConditionRules,
  matchesEnrollmentFilters,
  canEnroll,
} from "./enrollmentRules.ts";
import { delayToMs, interpolateContactVariables } from "./interpolateVariables.ts";
import {
  buildWhatsAppListInteractive,
  buildWhatsAppReplyButtonsInteractive,
  isInteractiveBranching,
  LIST_BRANCH_OTHER_HANDLE,
  normalizeSendMessageData,
  resolveListBranchHandle,
} from "./sendMessageRuntime.ts";
import { normalizeEndNodeData } from "./endNodeRuntime.ts";
import { sendFlowWhatsAppMessage } from "./flowRuntimeSendMessage.ts";

type GraphNode = {
  id: string;
  type: string;
  data?: Record<string, unknown>;
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
};

type Graph = {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
};

export type RuntimeInbound = {
  organizationId: string;
  conversationId: string;
  messageId: string;
  messageBody: string;
  phoneNumberId: string | null;
  customerWaId: string;
  customerName?: string | null;
  isResumeFromWait?: boolean;
  replyId?: string | null;
};

async function logEvent(
  admin: SupabaseClient,
  orgId: string,
  flowId: string,
  enrollmentId: string | null,
  eventType: string,
  nodeId: string | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await admin.from("omnichannel_flow_run_events").insert({
    organization_id: orgId,
    flow_id: flowId,
    enrollment_id: enrollmentId,
    event_type: eventType,
    node_id: nodeId,
    payload,
  });
}

function logEventAsync(
  admin: SupabaseClient,
  orgId: string,
  flowId: string,
  enrollmentId: string | null,
  eventType: string,
  nodeId: string | null,
  payload: Record<string, unknown> = {},
): void {
  void logEvent(admin, orgId, flowId, enrollmentId, eventType, nodeId, payload);
}

async function getConversationLabels(
  admin: SupabaseClient,
  conversationId: string,
): Promise<string[]> {
  const { data } = await admin
    .from("omnichannel_conversation_labels")
    .select("label_id, omnichannel_labels(name)")
    .eq("conversation_id", conversationId);
  const names: string[] = [];
  for (const row of data ?? []) {
    const labels = row as { omnichannel_labels?: { name?: string } | { name?: string }[] };
    const label = labels.omnichannel_labels;
    if (Array.isArray(label)) {
      for (const l of label) if (l?.name) names.push(String(l.name));
    } else if (label?.name) {
      names.push(String(label.name));
    }
  }
  return names;
}

function nextEdge(edges: GraphEdge[], nodeId: string, handle?: string | null): GraphEdge | null {
  const matches = edges.filter((e) => e.source === nodeId);
  if (handle) {
    const h = matches.find((e) => (e.sourceHandle ?? null) === handle);
    if (h) return h;
  }
  return matches[0] ?? null;
}

async function pickTeamAgent(
  admin: SupabaseClient,
  orgId: string,
  departmentId: string,
): Promise<string | null> {
  const { data: staffRows } = await admin
    .from("organization_omnichannel_staff")
    .select("employee_id, created_at, employees:employee_id(id, department_id)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });

  for (const row of staffRows ?? []) {
    const empRaw = (row as { employees?: { department_id?: string } | { department_id?: string }[] }).employees;
    const emp = Array.isArray(empRaw) ? empRaw[0] : empRaw;
    if (emp?.department_id && String(emp.department_id) === departmentId) {
      return String((row as { employee_id: string }).employee_id);
    }
  }
  return null;
}

function nodeById(nodes: GraphNode[], id: string): GraphNode | null {
  return nodes.find((n) => n.id === id) ?? null;
}

type FlowEnrollmentRow = {
  id: string;
  flow_id: string;
  organization_id: string;
  status: string;
  current_node_id: string | null;
  context_json: Record<string, unknown>;
  omnichannel_automation_flows: {
    published_graph_json: Graph | null;
    graph_json: Graph;
  };
};

async function findEnrollmentToResume(
  admin: SupabaseClient,
  conversationId: string,
): Promise<FlowEnrollmentRow | null> {
  const { data: rows } = await admin
    .from("omnichannel_flow_enrollments")
    .select("*, omnichannel_automation_flows(*)")
    .eq("conversation_id", conversationId)
    .in("status", ["waiting_for_reply", "active"])
    .order("updated_at", { ascending: false });

  for (const row of rows ?? []) {
    const enrollment = row as FlowEnrollmentRow;
    if (enrollment.status === "waiting_for_reply") return enrollment;

    const graph =
      enrollment.omnichannel_automation_flows.published_graph_json ??
      enrollment.omnichannel_automation_flows.graph_json;
    const currentNode = nodeById(graph.nodes ?? [], enrollment.current_node_id ?? "");
    if (currentNode?.type === "action_send_message" && isInteractiveBranching(currentNode.data ?? {})) {
      return enrollment;
    }
  }

  return null;
}

async function resumeInteractiveBranchReply(
  admin: SupabaseClient,
  args: {
    enrollment: FlowEnrollmentRow;
    inbound: RuntimeInbound;
    convCustomerName: string | null;
  },
): Promise<boolean> {
  const { enrollment, inbound, convCustomerName } = args;
  const graph =
    enrollment.omnichannel_automation_flows.published_graph_json ??
    enrollment.omnichannel_automation_flows.graph_json;
  const context = { ...(enrollment.context_json ?? {}) };
  context.last_customer_reply = inbound.messageBody;
  if (inbound.replyId) context.last_list_reply_id = inbound.replyId;
  context.last_list_reply_title = inbound.messageBody;

  const waitNode = nodeById(graph.nodes ?? [], enrollment.current_node_id ?? "");
  if (waitNode?.type !== "action_send_message" || !isInteractiveBranching(waitNode.data ?? {})) {
    return false;
  }

  const branchHandle = resolveListBranchHandle(
    waitNode.data ?? {},
    inbound.replyId ?? null,
    inbound.messageBody,
  );
  const edge = nextEdge(graph.edges ?? [], enrollment.current_node_id ?? "", branchHandle);

  if (!edge) {
    await admin
      .from("omnichannel_flow_enrollments")
      .update({
        status: "waiting_for_reply",
        context_json: context,
        updated_at: new Date().toISOString(),
      })
      .eq("id", enrollment.id);
    await logEvent(
      admin,
      enrollment.organization_id,
      enrollment.flow_id,
      enrollment.id,
      "branch_edge_missing",
      enrollment.current_node_id,
      { branchHandle, replyBody: inbound.messageBody, replyId: inbound.replyId },
    );
    console.error("flow branch edge missing", {
      enrollmentId: enrollment.id,
      nodeId: enrollment.current_node_id,
      branchHandle,
      replyBody: inbound.messageBody,
    });
    return true;
  }

  await admin
    .from("omnichannel_flow_enrollments")
    .update({
      status: "active",
      context_json: context,
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollment.id);

  await walkFromNode(admin, {
    graph,
    enrollmentId: enrollment.id,
    flowId: enrollment.flow_id,
    orgId: enrollment.organization_id,
    conversationId: inbound.conversationId,
    nodeId: edge.target,
    context,
    customerName: inbound.customerName ?? convCustomerName,
    customerWaId: inbound.customerWaId,
    phoneNumberId: inbound.phoneNumberId,
  });
  return true;
}

async function invokeFlowSend(
  admin: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const result = await sendFlowWhatsAppMessage(admin, payload as Parameters<typeof sendFlowWhatsAppMessage>[1]);
  return { ok: result.ok, error: result.error };
}

export async function executeAutomationFlowRuntime(
  admin: SupabaseClient,
  inbound: RuntimeInbound,
): Promise<void> {
  if (inbound.isResumeFromWait) {
    const [{ data: conv }, waitingEnrollment] = await Promise.all([
      admin
        .from("whatsapp_conversations")
        .select("assignee_id, customer_name")
        .eq("id", inbound.conversationId)
        .maybeSingle(),
      findEnrollmentToResume(admin, inbound.conversationId),
    ]);

    if (conv?.assignee_id) return;

    if (waitingEnrollment) {
      const flow = waitingEnrollment;
      const graph =
        flow.omnichannel_automation_flows.published_graph_json ??
        flow.omnichannel_automation_flows.graph_json;
      const waitNode = nodeById(graph.nodes ?? [], flow.current_node_id ?? "");
      if (waitNode?.type === "action_send_message" && isInteractiveBranching(waitNode.data ?? {})) {
        const handled = await resumeInteractiveBranchReply(admin, {
          enrollment: flow,
          inbound,
          convCustomerName: conv?.customer_name ?? null,
        });
        if (handled) return;
      }

      const context = { ...(flow.context_json ?? {}) };
      context.last_customer_reply = inbound.messageBody;
      if (inbound.replyId) context.last_list_reply_id = inbound.replyId;
      context.last_list_reply_title = inbound.messageBody;
      const saveVar = String(waitNode?.data?.saveAsVariable ?? "last_customer_reply");
      context[saveVar] = inbound.messageBody;

      await admin
        .from("omnichannel_flow_enrollments")
        .update({
          status: "active",
          context_json: context,
          updated_at: new Date().toISOString(),
        })
        .eq("id", waitingEnrollment.id);

      const edge = nextEdge(graph.edges ?? [], flow.current_node_id ?? "");
      if (edge) {
        await walkFromNode(admin, {
          graph,
          enrollmentId: waitingEnrollment.id,
          flowId: flow.flow_id,
          orgId: flow.organization_id,
          conversationId: inbound.conversationId,
          nodeId: edge.target,
          context,
          customerName: inbound.customerName ?? conv?.customer_name ?? null,
          customerWaId: inbound.customerWaId,
          phoneNumberId: inbound.phoneNumberId,
        });
      }
      return;
    }
  }

  const { data: conv } = await admin
    .from("whatsapp_conversations")
    .select("assignee_id, lead_status_id, customer_name, lead_statuses(name)")
    .eq("id", inbound.conversationId)
    .maybeSingle();

  if (conv?.assignee_id) {
    return;
  }

  let statusName: string | null = null;
  const ls = conv as { lead_statuses?: { name?: string } | { name?: string }[] };
  if (Array.isArray(ls.lead_statuses)) {
    statusName = ls.lead_statuses[0]?.name ?? null;
  } else {
    statusName = ls.lead_statuses?.name ?? null;
  }

  const labelNames = await getConversationLabels(admin, inbound.conversationId);
  const ctx = {
    messageBody: inbound.messageBody,
    conversationStatus: statusName,
    labelNames,
  };

  const { data: flows } = await admin
    .from("omnichannel_automation_flows")
    .select("*")
    .eq("organization_id", inbound.organizationId)
    .eq("status", "active");

  for (const flowRow of flows ?? []) {
    const flow = flowRow as {
      id: string;
      organization_id: string;
      re_enrollment_rule: string;
      trigger_config: Record<string, unknown>;
      published_graph_json: Graph | null;
      graph_json: Graph;
    };

    const graph = flow.published_graph_json ?? flow.graph_json;
    const start = (graph.nodes ?? []).find((n) => n.type === "start");
    if (!start) continue;

    const phoneIds = (start.data?.phoneNumberIds as string[] | undefined) ?? [];
    if (inbound.phoneNumberId && phoneIds.length > 0 && !phoneIds.includes(inbound.phoneNumberId)) {
      continue;
    }

    const enrollmentFilters = (start.data?.enrollmentFilters as unknown[]) ?? [];
    if (!matchesEnrollmentFilters(enrollmentFilters as never[], ctx)) continue;

    const { data: existingEnrollments } = await admin
      .from("omnichannel_flow_enrollments")
      .select("id, status")
      .eq("flow_id", flow.id)
      .eq("conversation_id", inbound.conversationId);

    const hasActive = (existingEnrollments ?? []).some((e) =>
      ["active", "waiting_for_reply"].includes(String((e as { status: string }).status))
    );
    const hasAny = (existingEnrollments ?? []).length > 0;
    if (!canEnroll(flow.re_enrollment_rule as never, hasActive, hasAny)) continue;

    const { data: enrollment, error: enrollErr } = await admin
      .from("omnichannel_flow_enrollments")
      .insert({
        organization_id: flow.organization_id,
        flow_id: flow.id,
        conversation_id: inbound.conversationId,
        channel: "whatsapp",
        status: "active",
        current_node_id: start.id,
        context_json: { last_customer_reply: inbound.messageBody },
      })
      .select("id")
      .single();

    if (enrollErr || !enrollment) continue;

    await logEvent(admin, flow.organization_id, flow.id, enrollment.id, "enrolled", start.id, {
      messageId: inbound.messageId,
    });

    const firstEdge = nextEdge(graph.edges ?? [], start.id);
    if (!firstEdge) continue;

    await walkFromNode(admin, {
      graph,
      enrollmentId: enrollment.id,
      flowId: flow.id,
      orgId: flow.organization_id,
      conversationId: inbound.conversationId,
      nodeId: firstEdge.target,
      context: { last_customer_reply: inbound.messageBody },
      customerName: inbound.customerName ?? conv?.customer_name ?? null,
      customerWaId: inbound.customerWaId,
      phoneNumberId: inbound.phoneNumberId,
    });
  }
}

type WalkArgs = {
  graph: Graph;
  enrollmentId: string;
  flowId: string;
  orgId: string;
  conversationId: string;
  nodeId: string;
  context: Record<string, unknown>;
  customerName: string | null;
  customerWaId: string;
  phoneNumberId: string | null;
};

async function walkFromNode(admin: SupabaseClient, args: WalkArgs): Promise<void> {
  let currentId: string | null = args.nodeId;
  let safety = 0;

  while (currentId && safety < 50) {
    safety += 1;
    const node = nodeById(args.graph.nodes ?? [], currentId);
    if (!node) break;

    if (node.type === "action_send_message") {
      const sendData = normalizeSendMessageData(node.data ?? {});
      const body = interpolateContactVariables(String(sendData.body ?? ""), {
        fullName: args.customerName,
        lastCustomerReply: String(args.context.last_customer_reply ?? ""),
      });

      const isList = sendData.buttonType === "list_message";
      const isQuickReply = sendData.buttonType === "quick_reply";
      // WhatsApp quick-reply: 3rd button tap often never reaches webhook; list_reply is reliable for 3 options.
      const quickReplyAsList = isQuickReply && (sendData.listOptions?.length ?? 0) >= 3;
      const branching = isInteractiveBranching(node.data ?? {});

      const sendPayload: Record<string, unknown> = {
        organization_id: args.orgId,
        conversation_id: args.conversationId,
        enrollment_id: args.enrollmentId,
        flow_id: args.flowId,
        node_id: node.id,
        text: body,
        to: args.customerWaId,
      };
      if (args.phoneNumberId) sendPayload.phone_number_id = args.phoneNumberId;

      if (isList || quickReplyAsList) {
        sendPayload.interactive = buildWhatsAppListInteractive(node.data ?? {}, body);
      } else if (isQuickReply) {
        sendPayload.interactive = buildWhatsAppReplyButtonsInteractive(node.data ?? {}, body);
      }

      const sendRes = await invokeFlowSend(admin, sendPayload);
      if (!sendRes.ok) {
        await admin
          .from("omnichannel_flow_enrollments")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", args.enrollmentId);
        await logEvent(admin, args.orgId, args.flowId, args.enrollmentId, "send_failed", node.id, {
          error: sendRes.error,
        });
        break;
      }

      logEventAsync(admin, args.orgId, args.flowId, args.enrollmentId, "message_sent", node.id);

      if (branching) {
        await admin
          .from("omnichannel_flow_enrollments")
          .update({
            status: "waiting_for_reply",
            current_node_id: node.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", args.enrollmentId);
        logEventAsync(admin, args.orgId, args.flowId, args.enrollmentId, "waiting_for_reply", node.id, {
          listBranch: true,
        });
        break;
      }

      void admin
        .from("omnichannel_flow_enrollments")
        .update({ current_node_id: node.id, updated_at: new Date().toISOString() })
        .eq("id", args.enrollmentId);

      const edge = nextEdge(args.graph.edges ?? [], node.id);
      currentId = edge?.target ?? null;
      continue;
    }

    await admin
      .from("omnichannel_flow_enrollments")
      .update({ current_node_id: node.id, updated_at: new Date().toISOString() })
      .eq("id", args.enrollmentId);

    const { data: enrollCheck } = await admin
      .from("omnichannel_flow_enrollments")
      .select("status")
      .eq("id", args.enrollmentId)
      .maybeSingle();
    if (enrollCheck?.status === "paused") break;

    if (node.type === "end") {
      const endData = normalizeEndNodeData(node.data);
      if (endData.mode === "jump_to") {
        if (!endData.jumpToNodeId) {
          await logEvent(admin, args.orgId, args.flowId, args.enrollmentId, "jump_to_failed", node.id, {
            reason: "target_missing",
          });
          console.error("flow jump_to failed: target missing", {
            enrollmentId: args.enrollmentId,
            endNodeId: node.id,
          });
          await admin
            .from("omnichannel_flow_enrollments")
            .update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("id", args.enrollmentId);
          break;
        }

        const target = (args.graph.nodes ?? []).find((n) => n.id === endData.jumpToNodeId);
        if (target && target.type !== "end" && target.type !== "start") {
          await admin
            .from("omnichannel_flow_enrollments")
            .update({
              status: "active",
              current_node_id: endData.jumpToNodeId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", args.enrollmentId);
          await logEvent(admin, args.orgId, args.flowId, args.enrollmentId, "jump_to", node.id, {
            targetNodeId: endData.jumpToNodeId,
          });
          currentId = endData.jumpToNodeId;
          continue;
        }

        const reason = !target
          ? "target_not_found"
          : target.type === "end" || target.type === "start"
            ? "target_invalid_type"
            : "unknown";
        await logEvent(admin, args.orgId, args.flowId, args.enrollmentId, "jump_to_failed", node.id, {
          targetNodeId: endData.jumpToNodeId,
          reason,
        });
        console.error("flow jump_to failed", {
          enrollmentId: args.enrollmentId,
          endNodeId: node.id,
          targetNodeId: endData.jumpToNodeId,
          reason,
        });
        await admin
          .from("omnichannel_flow_enrollments")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", args.enrollmentId);
        break;
      }

      await admin
        .from("omnichannel_flow_enrollments")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", args.enrollmentId);
      await logEvent(admin, args.orgId, args.flowId, args.enrollmentId, "completed", node.id);
      break;
    }

    if (node.type === "condition") {
      const matchMode = (node.data?.matchMode as "all" | "any") ?? "all";
      const rules = (node.data?.rules as unknown[]) ?? [];
      const labelNames = await getConversationLabels(admin, args.conversationId);
      const passed = evaluateConditionRules(rules as never[], matchMode, {
        messageBody: String(args.context.last_customer_reply ?? ""),
        conversationStatus: null,
        labelNames,
      });
      const edge = nextEdge(args.graph.edges ?? [], node.id, passed ? "yes" : "no");
      currentId = edge?.target ?? null;
      continue;
    }

    if (node.type === "time_delay") {
      const duration = Number(node.data?.duration ?? 0);
      const unit = String(node.data?.unit ?? "minutes");
      const ms = delayToMs(duration, unit);
      const resumeAt = new Date(Date.now() + ms).toISOString();
      const edge = nextEdge(args.graph.edges ?? [], node.id);
      const targetNodeId = edge?.target ?? null;
      if (!targetNodeId) break;

      await admin.from("omnichannel_flow_delay_jobs").insert({
        enrollment_id: args.enrollmentId,
        organization_id: args.orgId,
        resume_at: resumeAt,
        target_node_id: targetNodeId,
        status: "pending",
      });
      await logEvent(admin, args.orgId, args.flowId, args.enrollmentId, "delay_scheduled", node.id, {
        resumeAt,
        targetNodeId,
      });
      break;
    }

    if (node.type === "action_wait_reply") {
      await admin
        .from("omnichannel_flow_enrollments")
        .update({
          status: "waiting_for_reply",
          current_node_id: node.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", args.enrollmentId);
      await logEvent(admin, args.orgId, args.flowId, args.enrollmentId, "waiting_for_reply", node.id);
      break;
    }

    if (node.type === "action_assign_to") {
      const mode = String(node.data?.assignMode ?? "specific_user");
      let assigneeId: string | null = null;
      const nowIso = new Date().toISOString();

      if (mode === "specific_user") {
        const empId = String(node.data?.employeeId ?? "").trim();
        assigneeId = empId || null;
      } else if (mode === "specific_team") {
        const deptId = String(node.data?.departmentId ?? "").trim();
        if (deptId) {
          assigneeId = await pickTeamAgent(admin, args.orgId, deptId);
        }
      }

      const { error: assignErr } = await admin
        .from("whatsapp_conversations")
        .update({ assignee_id: assigneeId, updated_at: nowIso })
        .eq("id", args.conversationId);

      if (assignErr) {
        await logEvent(admin, args.orgId, args.flowId, args.enrollmentId, "assign_failed", node.id, {
          error: assignErr.message,
        });
      } else {
        await logEvent(admin, args.orgId, args.flowId, args.enrollmentId, "conversation_assigned", node.id, {
          assigneeId,
          mode,
        });
      }

      if (assigneeId) {
        break;
      }
      const assignEdge = nextEdge(args.graph.edges ?? [], node.id);
      currentId = assignEdge?.target ?? null;
      continue;
    }

    if (node.type === "action_update_contact") {
      const leadStatusId = node.data?.leadStatusId as string | null | undefined;
      const category = node.data?.category as string | null | undefined;
      const services = node.data?.services as string | null | undefined;
      const convUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (leadStatusId) convUpdate.lead_status_id = leadStatusId;
      await admin.from("whatsapp_conversations").update(convUpdate).eq("id", args.conversationId);

      const { data: convRow } = await admin
        .from("whatsapp_conversations")
        .select("ticket_id")
        .eq("id", args.conversationId)
        .maybeSingle();
      if (convRow?.ticket_id && (category || services)) {
        const leadUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (category) leadUpdate.category = category;
        if (services) leadUpdate.services = services;
        await admin.from("leads").update(leadUpdate).eq("ticket_id", convRow.ticket_id);
      }
      await logEvent(admin, args.orgId, args.flowId, args.enrollmentId, "contact_updated", node.id);
      const edge = nextEdge(args.graph.edges ?? [], node.id);
      currentId = edge?.target ?? null;
      continue;
    }

    if (node.type === "action_http_request") {
      const url = String(node.data?.url ?? "").trim();
      const method = String(node.data?.method ?? "POST").toUpperCase();
      const bodyTemplate = String(node.data?.bodyTemplate ?? "");
      const body = interpolateContactVariables(bodyTemplate, {
        fullName: args.customerName,
        lastCustomerReply: String(args.context.last_customer_reply ?? ""),
      });
      try {
        if (url) {
          await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: method === "GET" ? undefined : body,
          });
        }
        await logEvent(admin, args.orgId, args.flowId, args.enrollmentId, "http_request", node.id, { url });
      } catch (err) {
        await logEvent(admin, args.orgId, args.flowId, args.enrollmentId, "http_request_failed", node.id, {
          error: String(err),
        });
      }
      const edge = nextEdge(args.graph.edges ?? [], node.id);
      currentId = edge?.target ?? null;
      continue;
    }

    const edge = nextEdge(args.graph.edges ?? [], node.id);
    currentId = edge?.target ?? null;
  }
}

export async function resumeEnrollmentFromDelayJob(
  admin: SupabaseClient,
  jobId: string,
): Promise<void> {
  const { data: job } = await admin
    .from("omnichannel_flow_delay_jobs")
    .select("*, omnichannel_flow_enrollments(*, omnichannel_automation_flows(*))")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) return;

  const row = job as {
    id: string;
    target_node_id: string;
    status: string;
    omnichannel_flow_enrollments: {
      id: string;
      flow_id: string;
      organization_id: string;
      conversation_id: string;
      status: string;
      context_json: Record<string, unknown>;
      omnichannel_automation_flows: {
        published_graph_json: Graph | null;
        graph_json: Graph;
      };
    };
  };

  if (row.status !== "processing" && row.status !== "pending") return;
  const enrollment = row.omnichannel_flow_enrollments;
  if (!enrollment || enrollment.status === "paused") {
    await admin.from("omnichannel_flow_delay_jobs").update({ status: "done" }).eq("id", jobId);
    return;
  }

  const { data: conv } = await admin
    .from("whatsapp_conversations")
    .select("customer_name, customer_wa_id, assignee_id, phone_number_id")
    .eq("id", enrollment.conversation_id)
    .maybeSingle();

  if (conv?.assignee_id) {
    await admin.from("omnichannel_flow_delay_jobs").update({ status: "done" }).eq("id", jobId);
    return;
  }

  const graph =
    enrollment.omnichannel_automation_flows.published_graph_json ??
    enrollment.omnichannel_automation_flows.graph_json;

  await walkFromNode(admin, {
    graph,
    enrollmentId: enrollment.id,
    flowId: enrollment.flow_id,
    orgId: enrollment.organization_id,
    conversationId: enrollment.conversation_id,
    nodeId: row.target_node_id,
    context: enrollment.context_json ?? {},
    customerName: conv?.customer_name ?? null,
    customerWaId: conv?.customer_wa_id ?? "",
    phoneNumberId: (conv?.phone_number_id as string | null) ?? null,
  });

  await admin
    .from("omnichannel_flow_delay_jobs")
    .update({ status: "done", updated_at: new Date().toISOString() })
    .eq("id", jobId);
}
