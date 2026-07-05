type GraphNode = {
  id: string;
  type: string;
  data?: Record<string, unknown>;
};

export function isBranchTerminalEndNode(node: GraphNode | undefined): boolean {
  if (!node || node.type !== "end") return false;
  return Boolean(node.data?.isBranchTerminal);
}

export function isBranchTerminalEndForSend(node: GraphNode, sendNodeId: string): boolean {
  if (!isBranchTerminalEndNode(node)) return false;
  return String(node.data?.branchParentSendId ?? "") === sendNodeId;
}
