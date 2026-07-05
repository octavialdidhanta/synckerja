import type { AutomationFlowGraphNode } from "@/5-3-automation-flow/types/automationFlowGraph.types";
import { LIST_BRANCH_OTHER_HANDLE } from "@/5-3-automation-flow/lib/graph/sendMessageData";

export type BranchTerminalEndData = {
  isBranchTerminal: true;
  branchParentSendId: string;
  branchHandle: string;
};

export function branchStubEndId(sendNodeId: string, handle: string): string {
  const slug = handle === LIST_BRANCH_OTHER_HANDLE ? "other" : handle.replace("option:", "");
  const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, "-");
  return `end-branch-${sendNodeId}-${safeSlug}`;
}

export function isBranchTerminalEndNode(node: AutomationFlowGraphNode | undefined): boolean {
  if (!node || node.type !== "end") return false;
  return Boolean((node.data as Record<string, unknown>)?.isBranchTerminal);
}

export function isBranchTerminalEndForSend(
  node: AutomationFlowGraphNode,
  sendNodeId: string,
): boolean {
  if (!isBranchTerminalEndNode(node)) return false;
  return (node.data as BranchTerminalEndData).branchParentSendId === sendNodeId;
}

export function createBranchStubEndNode(
  sendNodeId: string,
  handle: string,
): AutomationFlowGraphNode {
  return {
    id: branchStubEndId(sendNodeId, handle),
    type: "end",
    position: { x: 0, y: 0 },
    data: {
      isBranchTerminal: true,
      branchParentSendId: sendNodeId,
      branchHandle: handle,
    },
  };
}
