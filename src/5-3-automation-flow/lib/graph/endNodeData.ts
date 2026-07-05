import { computeActionNumbers } from "@/5-3-automation-flow/lib/graph/computeActionNumbers";
import type {
  AutomationFlowEndData,
  AutomationFlowEndMode,
  AutomationFlowGraph,
  AutomationFlowGraphNode,
} from "@/5-3-automation-flow/types/automationFlowGraph.types";

export type JumpTargetCandidate = {
  nodeId: string;
  actionNumber: number;
  nodeType: string;
};

export function normalizeEndNodeData(data: Record<string, unknown>): AutomationFlowEndData {
  const mode = (data.mode as AutomationFlowEndMode | undefined) ?? "flow_end";
  const jumpToNodeId =
    mode === "jump_to" && typeof data.jumpToNodeId === "string" && data.jumpToNodeId.trim()
      ? data.jumpToNodeId.trim()
      : null;

  return {
    ...(Boolean(data.isBranchTerminal) ? { isBranchTerminal: true } : {}),
    ...(typeof data.branchParentSendId === "string"
      ? { branchParentSendId: data.branchParentSendId }
      : {}),
    ...(typeof data.branchHandle === "string" ? { branchHandle: data.branchHandle } : {}),
    mode,
    jumpToNodeId: mode === "jump_to" ? jumpToNodeId : null,
  };
}

export function mergeEndNodePatch(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
): AutomationFlowEndData {
  return normalizeEndNodeData({ ...existing, ...patch });
}

export function getJumpTargetCandidates(graph: AutomationFlowGraph): JumpTargetCandidate[] {
  const actionNumbers = computeActionNumbers(graph);
  const candidates: JumpTargetCandidate[] = [];

  for (const node of graph.nodes) {
    const actionNumber = actionNumbers.get(node.id);
    if (actionNumber === undefined) continue;
    candidates.push({
      nodeId: node.id,
      actionNumber,
      nodeType: node.type,
    });
  }

  return candidates.sort((a, b) => a.actionNumber - b.actionNumber);
}

export function isValidJumpTarget(graph: AutomationFlowGraph, targetNodeId: string): boolean {
  return getJumpTargetCandidates(graph).some((c) => c.nodeId === targetNodeId);
}

export function resolveJumpTargetLabel(
  graph: AutomationFlowGraph,
  jumpToNodeId: string | null | undefined,
  formatActionLabel: (actionNumber: number) => string,
): string | null {
  if (!jumpToNodeId) return null;
  const actionNumbers = computeActionNumbers(graph);
  const actionNumber = actionNumbers.get(jumpToNodeId);
  if (actionNumber === undefined) return null;
  return formatActionLabel(actionNumber);
}

export function validateEndNodeRules(
  node: AutomationFlowGraphNode,
  graph: AutomationFlowGraph,
): Array<{ code: string; message: string; nodeId: string }> {
  if (node.type !== "end") return [];

  const data = normalizeEndNodeData(node.data as Record<string, unknown>);
  if (data.mode !== "jump_to") return [];

  const issues: Array<{ code: string; message: string; nodeId: string }> = [];

  if (!data.jumpToNodeId) {
    issues.push({
      code: "END_JUMP_TARGET_MISSING",
      message: "Jump to requires selecting a target Action.",
      nodeId: node.id,
    });
    return issues;
  }

  if (data.jumpToNodeId === node.id) {
    issues.push({
      code: "END_JUMP_TARGET_SELF",
      message: "End node cannot jump to itself.",
      nodeId: node.id,
    });
    return issues;
  }

  if (!isValidJumpTarget(graph, data.jumpToNodeId)) {
    issues.push({
      code: "END_JUMP_TARGET_INVALID",
      message: "Jump target must be a valid Action block in this flow.",
      nodeId: node.id,
    });
  }

  return issues;
}
