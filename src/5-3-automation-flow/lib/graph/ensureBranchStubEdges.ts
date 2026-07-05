import { collectLinearChain } from "@/5-3-automation-flow/lib/graph/layoutBranchingGraph";
import {
  branchStubEndId,
  createBranchStubEndNode,
  isBranchTerminalEndForSend,
  isBranchTerminalEndNode,
} from "@/5-3-automation-flow/lib/graph/branchTerminalEnd";
import {
  getInteractiveBranchHandles,
  isInteractiveBranching,
  normalizeSendMessageData,
} from "@/5-3-automation-flow/lib/graph/sendMessageData";
import type {
  AutomationFlowGraph,
  AutomationFlowGraphEdge,
  AutomationFlowGraphNode,
} from "@/5-3-automation-flow/types/automationFlowGraph.types";

function isBranchHandle(handle: string | null | undefined): boolean {
  return Boolean(handle?.startsWith("option:"));
}

function findPrimaryEndTarget(graph: AutomationFlowGraph, sendNodeId: string): string | null {
  const nonStubEnds = graph.nodes.filter((n) => n.type === "end" && !isBranchTerminalEndNode(n));
  const startNode = graph.nodes.find((n) => n.type === "start");
  if (startNode) {
    const chain = collectLinearChain(graph, startNode.id);
    const sendIndex = chain.findIndex((n) => n.id === sendNodeId);
    if (sendIndex >= 0) {
      for (let i = sendIndex + 1; i < chain.length; i++) {
        if (chain[i].type === "end" && !isBranchTerminalEndNode(chain[i])) {
          return chain[i].id;
        }
      }
    }
  }
  return nonStubEnds[0]?.id ?? null;
}

function removeBranchStubsForSend(graph: AutomationFlowGraph, sendNodeId: string): AutomationFlowGraph {
  const stubIds = new Set(
    graph.nodes.filter((n) => isBranchTerminalEndForSend(n, sendNodeId)).map((n) => n.id),
  );

  let nodes = graph.nodes.filter((n) => !stubIds.has(n.id));
  let edges = graph.edges.filter((e) => !stubIds.has(e.source) && !stubIds.has(e.target));

  edges = edges.filter((e) => {
    if (e.source !== sendNodeId) return true;
    return !isBranchHandle(e.sourceHandle);
  });

  const hasLinearOutgoing = edges.some(
    (e) => e.source === sendNodeId && !isBranchHandle(e.sourceHandle),
  );
  if (!hasLinearOutgoing) {
    const primaryEnd = findPrimaryEndTarget({ ...graph, nodes, edges }, sendNodeId);
    if (primaryEnd) {
      edges.push({
        id: `e-${sendNodeId}-${primaryEnd}-linear-restore`,
        source: sendNodeId,
        target: primaryEnd,
        sourceHandle: null,
      });
    }
  }

  return { ...graph, nodes, edges };
}

export function ensureBranchStubEdges(
  graph: AutomationFlowGraph,
  sendNodeId: string,
): AutomationFlowGraph {
  const sendNode = graph.nodes.find((n) => n.id === sendNodeId && n.type === "action_send_message");
  if (!sendNode) return graph;

  const data = normalizeSendMessageData(sendNode.data as Record<string, unknown>);
  if (!isInteractiveBranching(data)) {
    return removeBranchStubsForSend(graph, sendNodeId);
  }

  const validHandles = getInteractiveBranchHandles(data);
  const keepStubIds = new Set(validHandles.map((handle) => branchStubEndId(sendNodeId, handle)));

  let nodes: AutomationFlowGraphNode[] = graph.nodes.filter((node) => {
    if (!isBranchTerminalEndForSend(node, sendNodeId)) return true;
    return keepStubIds.has(node.id);
  });

  let edges: AutomationFlowGraphEdge[] = graph.edges.filter((edge) => {
    if (edge.source === sendNodeId && isInteractiveBranching(data)) {
      return isBranchHandle(edge.sourceHandle);
    }
    if (edge.source === sendNodeId && isBranchHandle(edge.sourceHandle)) {
      return validHandles.includes(String(edge.sourceHandle));
    }
    const targetNode = nodes.find((n) => n.id === edge.target);
    const sourceNode = nodes.find((n) => n.id === edge.source);
    if (targetNode && isBranchTerminalEndForSend(targetNode, sendNodeId)) {
      return keepStubIds.has(targetNode.id);
    }
    if (sourceNode && isBranchTerminalEndForSend(sourceNode, sendNodeId)) {
      return keepStubIds.has(sourceNode.id);
    }
    return true;
  });

  for (const handle of validHandles) {
    const stubId = branchStubEndId(sendNodeId, handle);
    if (!nodes.some((n) => n.id === stubId)) {
      nodes.push(createBranchStubEndNode(sendNodeId, handle));
    }

    const existingEdge = edges.find(
      (e) => e.source === sendNodeId && e.sourceHandle === handle,
    );
    if (!existingEdge) {
      edges.push({
        id: `e-${sendNodeId}-${stubId}-${handle}`,
        source: sendNodeId,
        target: stubId,
        sourceHandle: handle,
      });
    }
  }

  return { ...graph, nodes, edges };
}
