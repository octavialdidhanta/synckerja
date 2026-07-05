import {
  getInteractiveBranchHandles,
  isInteractiveBranching,
  isListMessageBranching,
  isQuickReplyBranching,
  LIST_MESSAGE_LIMITS,
  QUICK_REPLY_LIMITS,
  normalizeSendMessageData,
} from "@/5-3-automation-flow/lib/graph/sendMessageData";
import {
  branchStubEndId,
  isBranchTerminalEndNode,
} from "@/5-3-automation-flow/lib/graph/branchTerminalEnd";
import type { GraphValidationIssue } from "@/5-3-automation-flow/lib/graph/validateGraph";
import type { AutomationFlowGraph } from "@/5-3-automation-flow/types/automationFlowGraph.types";

type GraphNode = { id: string; type: string; data?: Record<string, unknown> };
type GraphEdge = { source: string; target: string; sourceHandle?: string | null };

function validateBranchEdges(
  node: GraphNode,
  data: ReturnType<typeof normalizeSendMessageData>,
  edges: GraphEdge[],
  nodesById: Map<string, GraphNode>,
): GraphValidationIssue[] {
  const issues: GraphValidationIssue[] = [];
  if (!isInteractiveBranching(data)) return issues;

  const requiredHandles = getInteractiveBranchHandles(data);
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
    const isStubTerminal =
      target.type === "end" && isBranchTerminalEndNode(target as { id: string; type: string; data?: Record<string, unknown> });
    if (target.type === "end" && !isStubTerminal) {
      issues.push({
        code: "BRANCH_EDGES_REQUIRED",
        message: `Branch "${handle}" must connect to a non-End step.`,
        nodeId: node.id,
      });
    }
  }
  return issues;
}

function validateOptionIds(
  node: GraphNode,
  options: Array<{ id: string; title?: string; description?: string }>,
): GraphValidationIssue[] {
  const issues: GraphValidationIssue[] = [];
  const ids = new Set<string>();
  for (const opt of options) {
    if (ids.has(opt.id)) {
      issues.push({
        code: "DUPLICATE_OPTION_ID",
        message: "Options must have unique IDs.",
        nodeId: node.id,
      });
      break;
    }
    ids.add(opt.id);
  }
  return issues;
}

export function validateSendMessageInteractiveRules(
  node: GraphNode,
  edges: GraphEdge[],
  nodesById: Map<string, GraphNode>,
): GraphValidationIssue[] {
  const issues: GraphValidationIssue[] = [];
  const data = normalizeSendMessageData(node.data ?? {});

  if (data.buttonType === "list_message") {
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

    issues.push(...validateOptionIds(node, options));

    for (const opt of options) {
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
      issues.push(...validateBranchEdges(node, data, edges, nodesById));
    }
  }

  if (data.buttonType === "quick_reply") {
    const options = data.listOptions ?? [];
    if (options.length === 0) {
      issues.push({
        code: "QUICK_REPLY_MIN",
        message: "Quick reply requires at least one button.",
        nodeId: node.id,
      });
    }
    if (options.length > QUICK_REPLY_LIMITS.maxButtons) {
      issues.push({
        code: "QUICK_REPLY_MAX",
        message: `Quick reply supports at most ${QUICK_REPLY_LIMITS.maxButtons} buttons.`,
        nodeId: node.id,
      });
    }

    issues.push(...validateOptionIds(node, options));

    for (const opt of options) {
      const title = String(opt.title ?? "").trim();
      if (!title) {
        issues.push({
          code: "QUICK_REPLY_TITLE",
          message: "Each quick reply button requires a name.",
          nodeId: node.id,
        });
      } else if (title.length > QUICK_REPLY_LIMITS.titleMax) {
        issues.push({
          code: "QUICK_REPLY_TITLE",
          message: `Button name must be at most ${QUICK_REPLY_LIMITS.titleMax} characters.`,
          nodeId: node.id,
        });
      }
    }

    if (isQuickReplyBranching(data)) {
      issues.push(...validateBranchEdges(node, data, edges, nodesById));
    }
  }

  return issues;
}

export function validateSendMessageInteractiveRulesForGraph(
  graph: AutomationFlowGraph,
): GraphValidationIssue[] {
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const issues: GraphValidationIssue[] = [];
  for (const node of nodes) {
    if (node.type === "action_send_message") {
      issues.push(...validateSendMessageInteractiveRules(node, edges, nodesById));
    }
  }
  return issues;
}

/** @deprecated Use validateSendMessageInteractiveRulesForGraph */
export const validateSendMessageListRulesForGraph = validateSendMessageInteractiveRulesForGraph;
