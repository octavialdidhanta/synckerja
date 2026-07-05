import type { AutomationFlowGraph } from "@/5-3-automation-flow/types/automationFlowGraph.types";
import { ensureBranchStubEdges } from "@/5-3-automation-flow/lib/graph/ensureBranchStubEdges";
import {
  getInteractiveBranchHandles,
  isInteractiveBranching,
  LIST_BRANCH_OTHER_HANDLE,
  listOptionHandleId,
  normalizeSendMessageData,
} from "@/5-3-automation-flow/lib/graph/sendMessageData";

function isBranchHandle(handle: string | null | undefined): boolean {
  return Boolean(handle?.startsWith("option:"));
}

export function syncInteractiveBranchEdges(graph: AutomationFlowGraph, sendNodeId: string): AutomationFlowGraph {
  const sendNode = graph.nodes.find((n) => n.id === sendNodeId && n.type === "action_send_message");
  if (!sendNode) return graph;

  const data = normalizeSendMessageData(sendNode.data as Record<string, unknown>);
  const branching = isInteractiveBranching(data);
  const validHandles = new Set(branching ? getInteractiveBranchHandles(data) : []);

  let edges = graph.edges.filter((edge) => {
    if (edge.source !== sendNodeId) return true;
    if (!isBranchHandle(edge.sourceHandle)) return !branching;
    return validHandles.has(String(edge.sourceHandle));
  });

  if (branching) {
    edges = edges.filter((edge) => {
      if (edge.source !== sendNodeId) return true;
      return isBranchHandle(edge.sourceHandle);
    });
  }

  const seenHandles = new Set<string>();
  edges = edges.filter((edge) => {
    if (edge.source !== sendNodeId || !edge.sourceHandle) return true;
    if (!validHandles.has(edge.sourceHandle)) return false;
    if (seenHandles.has(edge.sourceHandle)) return false;
    seenHandles.add(edge.sourceHandle);
    return true;
  });

  return ensureBranchStubEdges({ ...graph, edges }, sendNodeId);
}

export function syncAllInteractiveBranchEdges(graph: AutomationFlowGraph): AutomationFlowGraph {
  let next = graph;
  for (const node of graph.nodes) {
    if (node.type === "action_send_message") {
      next = syncInteractiveBranchEdges(next, node.id);
    }
  }
  return next;
}

/** @deprecated Use syncInteractiveBranchEdges */
export const syncListBranchEdges = syncInteractiveBranchEdges;

/** @deprecated Use syncAllInteractiveBranchEdges */
export const syncAllListBranchEdges = syncAllInteractiveBranchEdges;

export function applySendMessagePatch(
  graph: AutomationFlowGraph,
  nodeId: string,
  patch: Record<string, unknown>,
): AutomationFlowGraph {
  const nodes = graph.nodes.map((n) =>
    n.id === nodeId ? { ...n, data: { ...(n.data as Record<string, unknown>), ...patch } as never } : n,
  );
  return syncInteractiveBranchEdges({ ...graph, nodes }, nodeId);
}

export { listOptionHandleId, LIST_BRANCH_OTHER_HANDLE };
