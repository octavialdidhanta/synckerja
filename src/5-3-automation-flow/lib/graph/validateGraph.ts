import type { AutomationFlowGraph } from "@/5-3-automation-flow/types/automationFlowGraph.types";
import { validateEndNodeRules } from "@/5-3-automation-flow/lib/graph/endNodeData";
import { validateSendMessageInteractiveRulesForGraph } from "@/5-3-automation-flow/lib/graph/validateSendMessageInteractive";
import { validateAssignToRulesForGraph } from "@/5-3-automation-flow/lib/graph/validateAssignTo";

export type GraphValidationIssue = {
  code: string;
  message: string;
  nodeId?: string;
};

export function validateAutomationFlowGraph(graph: AutomationFlowGraph): GraphValidationIssue[] {
  const issues: GraphValidationIssue[] = [];
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];

  const startNodes = nodes.filter((n) => n.type === "start");
  if (startNodes.length !== 1) {
    issues.push({
      code: "START_COUNT",
      message: "Flow must have exactly one Start node.",
    });
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push({ code: "ORPHAN_EDGE", message: "Graph contains orphan edges." });
      break;
    }
  }

  const startId = startNodes[0]?.id;
  if (startId) {
    const reachable = new Set<string>();
    const queue = [startId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (reachable.has(current)) continue;
      reachable.add(current);
      for (const edge of edges) {
        if (edge.source === current) queue.push(edge.target);
      }
    }
    for (const node of nodes) {
      if (node.type === "end" || node.type === "start") continue;
      if (!reachable.has(node.id)) {
        issues.push({
          code: "UNREACHABLE",
          message: `Node "${node.id}" is not reachable from Start.`,
          nodeId: node.id,
        });
      }
    }
  }

  for (const node of nodes) {
    if (node.type === "action_send_message") {
      const body = String((node.data as { body?: string }).body ?? "").trim();
      if (!body) {
        issues.push({
          code: "EMPTY_MESSAGE",
          message: "Send Message node requires non-empty body.",
          nodeId: node.id,
        });
      }
    }
    if (node.type === "time_delay") {
      const duration = Number((node.data as { duration?: number }).duration ?? 0);
      if (!Number.isFinite(duration) || duration <= 0) {
        issues.push({
          code: "INVALID_DELAY",
          message: "Time Delay must have a positive duration.",
          nodeId: node.id,
        });
      }
    }
    if (node.type === "start") {
      const phoneIds = (node.data as { phoneNumberIds?: string[] }).phoneNumberIds ?? [];
      if (phoneIds.length === 0) {
        issues.push({
          code: "NO_PHONE",
          message: "Start trigger requires at least one WhatsApp account.",
          nodeId: node.id,
        });
      }
    }
  }

  issues.push(...validateSendMessageInteractiveRulesForGraph({ nodes, edges, viewport: graph.viewport ?? { x: 0, y: 0, zoom: 1 } }));
  issues.push(...validateAssignToRulesForGraph({ nodes, edges, viewport: graph.viewport ?? { x: 0, y: 0, zoom: 1 } }));

  for (const node of nodes) {
    if (node.type === "end") {
      issues.push(...validateEndNodeRules(node, graph));
    }
  }

  return issues;
}

export function isAutomationFlowGraphValid(graph: AutomationFlowGraph): boolean {
  return validateAutomationFlowGraph(graph).length === 0;
}
