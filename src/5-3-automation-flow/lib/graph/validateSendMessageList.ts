import {
  getListBranchHandles,
  isListMessageBranching,
  LIST_MESSAGE_LIMITS,
  normalizeSendMessageData,
} from "@/5-3-automation-flow/lib/graph/sendMessageData";
import { isBranchTerminalEndNode } from "@/5-3-automation-flow/lib/graph/branchTerminalEnd";
import type { GraphValidationIssue } from "@/5-3-automation-flow/lib/graph/validateGraph";
import type { AutomationFlowGraph } from "@/5-3-automation-flow/types/automationFlowGraph.types";

type GraphNode = { id: string; type: string; data?: Record<string, unknown> };
type GraphEdge = { source: string; target: string; sourceHandle?: string | null };

export function validateSendMessageListRules(
  node: GraphNode,
  edges: GraphEdge[],
  nodesById: Map<string, GraphNode>,
): GraphValidationIssue[] {
  const issues: GraphValidationIssue[] = [];
  const data = normalizeSendMessageData(node.data ?? {});

  if (data.buttonType !== "list_message") return issues;

  const buttonText = String(data.listButtonText ?? "").trim();
  if (!buttonText) {
    issues.push({
      code: "LIST_BUTTON_TEXT",
      message: "List message requires button text (e.g. Pilih Opsi).",
      nodeId: node.id,
    });
  } else if (buttonText.length > LIST_MESSAGE_LIMITS.listButtonTextMax) {
    issues.push({
      code: "LIST_BUTTON_TEXT",
      message: `List button text must be at most ${LIST_MESSAGE_LIMITS.listButtonTextMax} characters.`,
      nodeId: node.id,
    });
  }

  const options = data.listOptions ?? [];
  if (options.length === 0) {
    issues.push({
      code: "LIST_OPTIONS_MIN",
      message: "List message requires at least one option.",
      nodeId: node.id,
    });
  }
  if (options.length > LIST_MESSAGE_LIMITS.maxOptions) {
    issues.push({
      code: "LIST_OPTIONS_MAX",
      message: `List message supports at most ${LIST_MESSAGE_LIMITS.maxOptions} options.`,
      nodeId: node.id,
    });
  }

  const ids = new Set<string>();
  for (const opt of options) {
    if (ids.has(opt.id)) {
      issues.push({
        code: "DUPLICATE_OPTION_ID",
        message: "List options must have unique IDs.",
        nodeId: node.id,
      });
      break;
    }
    ids.add(opt.id);
    const title = String(opt.title ?? "").trim();
    if (!title) {
      issues.push({
        code: "LIST_OPTION_TITLE",
        message: "Each list option requires a name.",
        nodeId: node.id,
      });
    } else if (title.length > LIST_MESSAGE_LIMITS.optionTitleMax) {
      issues.push({
        code: "LIST_OPTION_TITLE",
        message: `Option name must be at most ${LIST_MESSAGE_LIMITS.optionTitleMax} characters.`,
        nodeId: node.id,
      });
    }
    const desc = String(opt.description ?? "");
    if (desc.length > LIST_MESSAGE_LIMITS.optionDescriptionMax) {
      issues.push({
        code: "LIST_OPTION_DESC",
        message: `Option description must be at most ${LIST_MESSAGE_LIMITS.optionDescriptionMax} characters.`,
        nodeId: node.id,
      });
    }
  }

  if (isListMessageBranching(data)) {
    const requiredHandles = getListBranchHandles(data);
    for (const handle of requiredHandles) {
      const branchEdge = edges.find((e) => e.source === node.id && e.sourceHandle === handle);
      if (!branchEdge) {
        issues.push({
          code: "BRANCH_EDGES_REQUIRED",
          message: `Branch "${handle}" must be connected to an action.`,
          nodeId: node.id,
        });
        continue;
      }
      const target = nodesById.get(branchEdge.target);
      if (!target) {
        issues.push({
          code: "BRANCH_EDGES_REQUIRED",
          message: `Branch "${handle}" must be connected to an action.`,
          nodeId: node.id,
        });
        continue;
      }
      const isStubTerminal = target.type === "end" && isBranchTerminalEndNode(target as GraphNode);
      if (target.type === "end" && !isStubTerminal) {
        issues.push({
          code: "BRANCH_EDGES_REQUIRED",
          message: `Branch "${handle}" must connect to a non-End step.`,
          nodeId: node.id,
        });
      }
    }
  }

  return issues;
}

export function validateSendMessageListRulesForGraph(graph: AutomationFlowGraph): GraphValidationIssue[] {
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const issues: GraphValidationIssue[] = [];
  for (const node of nodes) {
    if (node.type === "action_send_message") {
      issues.push(...validateSendMessageListRules(node, edges, nodesById));
    }
  }
  return issues;
}
