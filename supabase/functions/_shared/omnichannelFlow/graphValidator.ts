import {
  getInteractiveBranchHandles,
  isInteractiveBranching,
  isListMessageBranching,
  isQuickReplyBranching,
  LIST_BRANCH_OTHER_HANDLE,
  QUICK_REPLY_LIMITS,
  normalizeSendMessageData,
} from "./sendMessageRuntime.ts";
import { normalizeEndNodeData } from "./endNodeRuntime.ts";
import { isBranchTerminalEndNode } from "./branchTerminalEnd.ts";

export type GraphValidationIssue = {
  code: string;
  message: string;
  nodeId?: string;
};

type GraphNode = {
  id: string;
  type: string;
  data?: Record<string, unknown>;
};

type GraphEdge = {
  source: string;
  target: string;
  sourceHandle?: string | null;
};

type Graph = {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
};

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
    const isStubTerminal = target.type === "end" && isBranchTerminalEndNode(target);
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

function validateSendMessageInteractiveRules(
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
    } else if (buttonText.length > 20) {
      issues.push({
        code: "LIST_BUTTON_TEXT",
        message: "List button text must be at most 20 characters.",
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
    if (options.length > 10) {
      issues.push({
        code: "LIST_OPTIONS_MAX",
        message: "List message supports at most 10 options.",
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
      } else if (title.length > 24) {
        issues.push({
          code: "LIST_OPTION_TITLE",
          message: "Option name must be at most 24 characters.",
          nodeId: node.id,
        });
      }
      const desc = String(opt.description ?? "");
      if (desc.length > 72) {
        issues.push({
          code: "LIST_OPTION_DESC",
          message: "Option description must be at most 72 characters.",
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

export function validateAutomationFlowGraph(graph: Graph): GraphValidationIssue[] {
  const issues: GraphValidationIssue[] = [];
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  const startNodes = nodes.filter((n) => n.type === "start");
  if (startNodes.length !== 1) {
    issues.push({ code: "START_COUNT", message: "Flow must have exactly one Start node." });
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
      if (node.type !== "end" && !reachable.has(node.id)) {
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
      const body = String(node.data?.body ?? "").trim();
      if (!body) {
        issues.push({
          code: "EMPTY_MESSAGE",
          message: "Send Message node requires non-empty body.",
          nodeId: node.id,
        });
      }
      issues.push(...validateSendMessageInteractiveRules(node, edges, nodesById));
    }
    if (node.type === "time_delay") {
      const duration = Number(node.data?.duration ?? 0);
      if (!Number.isFinite(duration) || duration <= 0) {
        issues.push({
          code: "INVALID_DELAY",
          message: "Time Delay must have a positive duration.",
          nodeId: node.id,
        });
      }
    }
    if (node.type === "start") {
      const phoneIds = (node.data?.phoneNumberIds as string[] | undefined) ?? [];
      if (phoneIds.length === 0) {
        issues.push({
          code: "NO_PHONE",
          message: "Start trigger requires at least one WhatsApp account.",
          nodeId: node.id,
        });
      }
    }
    if (node.type === "action_assign_to") {
      const mode = String(node.data?.assignMode ?? "specific_user");
      if (mode === "specific_user") {
        const employeeId = String(node.data?.employeeId ?? "").trim();
        if (!employeeId) {
          issues.push({
            code: "ASSIGN_USER_REQUIRED",
            message: "Assign to Specific user requires selecting an agent.",
            nodeId: node.id,
          });
        }
      }
      if (mode === "specific_team") {
        const departmentId = String(node.data?.departmentId ?? "").trim();
        if (!departmentId) {
          issues.push({
            code: "ASSIGN_TEAM_REQUIRED",
            message: "Assign to Specific team requires selecting a department.",
            nodeId: node.id,
          });
        }
      }
    }
    if (node.type === "end") {
      const endData = normalizeEndNodeData(node.data);
      if (endData.mode === "jump_to") {
        if (!endData.jumpToNodeId) {
          issues.push({
            code: "END_JUMP_TARGET_MISSING",
            message: "Jump to requires selecting a target Action.",
            nodeId: node.id,
          });
        } else if (endData.jumpToNodeId === node.id) {
          issues.push({
            code: "END_JUMP_TARGET_SELF",
            message: "End node cannot jump to itself.",
            nodeId: node.id,
          });
        } else {
          const target = nodesById.get(endData.jumpToNodeId);
          if (!target || target.type === "start" || target.type === "end") {
            issues.push({
              code: "END_JUMP_TARGET_INVALID",
              message: "Jump target must be a valid Action block in this flow.",
              nodeId: node.id,
            });
          }
        }
      }
    }
  }

  return issues;
}

export function isAutomationFlowGraphValid(graph: Graph): boolean {
  return validateAutomationFlowGraph(graph).length === 0;
}

export function extractTriggerConfigFromGraph(graph: Graph): Record<string, unknown> {
  const start = (graph.nodes ?? []).find((n) => n.type === "start");
  const data = start?.data ?? {};
  return {
    triggerType: data.triggerType ?? "incoming_message_received",
    phoneNumberIds: data.phoneNumberIds ?? [],
    enrollmentFilters: data.enrollmentFilters ?? [],
  };
}

export { LIST_BRANCH_OTHER_HANDLE };
