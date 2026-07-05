import {
  getInteractiveBranchHandles,
  isInteractiveBranching,
  normalizeSendMessageData,
} from "@/5-3-automation-flow/lib/graph/sendMessageData";
import {
  collectBranchChain,
  collectLinearChain,
  layoutAutomationFlowGraph,
  reorderNodesByTopology,
} from "@/5-3-automation-flow/lib/graph/layoutBranchingGraph";
import type {
  AutomationFlowGraph,
  AutomationFlowGraphEdge,
  AutomationFlowGraphNode,
} from "@/5-3-automation-flow/types/automationFlowGraph.types";

function isBranchHandle(handle: string | null | undefined): boolean {
  return Boolean(handle?.startsWith("option:"));
}

function assertMutableNode(node: AutomationFlowGraphNode | undefined, nodeId: string): AutomationFlowGraphNode {
  if (!node) throw new Error(`Node "${nodeId}" not found.`);
  if (node.type === "start" || node.type === "end") {
    throw new Error("Cannot modify Start or End blocks.");
  }
  return node;
}

function newNodeId(type: string, suffix: number): string {
  return `${type}-${Date.now()}-${suffix}-${Math.random().toString(36).slice(2, 7)}`;
}

function getPrimaryOutgoingEdge(
  graph: AutomationFlowGraph,
  nodeId: string,
): AutomationFlowGraphEdge | undefined {
  return graph.edges.find((e) => e.source === nodeId && !isBranchHandle(e.sourceHandle));
}

function getIncomingEdge(graph: AutomationFlowGraph, nodeId: string): AutomationFlowGraphEdge | undefined {
  return graph.edges.find((e) => e.target === nodeId);
}

function cloneNodeData(node: AutomationFlowGraphNode): AutomationFlowGraphNode["data"] {
  const data = JSON.parse(JSON.stringify(node.data)) as Record<string, unknown>;
  if (node.type === "action_send_message" && Array.isArray(data.listOptions)) {
    data.listOptions = (data.listOptions as Array<Record<string, unknown>>).map((opt, index) => ({
      ...opt,
      id: `${String(opt.id ?? `opt-${index}`)}-copy-${Date.now()}-${index}`,
    }));
  }
  if (node.type === "condition" && Array.isArray(data.rules)) {
    data.rules = (data.rules as Array<Record<string, unknown>>).map((rule, index) => ({
      ...rule,
      id: `r-${Date.now()}-${index}`,
    }));
  }
  return data as AutomationFlowGraphNode["data"];
}

function finalizeGraph(graph: AutomationFlowGraph): AutomationFlowGraph {
  const orderedNodes = reorderNodesByTopology(graph);
  return layoutAutomationFlowGraph({ ...graph, nodes: orderedNodes });
}

function collectBranchSubtreeNodeIds(graph: AutomationFlowGraph, sendNodeId: string): string[] {
  const sendNode = graph.nodes.find((n) => n.id === sendNodeId);
  if (!sendNode || sendNode.type !== "action_send_message") return [];

  const data = normalizeSendMessageData(sendNode.data as Record<string, unknown>);
  if (!isInteractiveBranching(data)) return [];

  const ids: string[] = [];
  for (const handle of getInteractiveBranchHandles(data)) {
    for (const chainNode of collectBranchChain(graph, sendNodeId, handle)) {
      ids.push(chainNode.id);
    }
  }
  return ids;
}

/** Non-End nodes strictly below `nodeId` on the primary (non-branch) path. */
export function collectPathNodesBelowExclusive(graph: AutomationFlowGraph, nodeId: string): string[] {
  const outgoing = getPrimaryOutgoingEdge(graph, nodeId);
  if (!outgoing) return [];

  const ids: string[] = [];
  let currentId = outgoing.target;

  while (true) {
    const node = graph.nodes.find((n) => n.id === currentId);
    if (!node || node.type === "end") break;
    ids.push(node.id);
    const next = getPrimaryOutgoingEdge(graph, currentId);
    if (!next) break;
    currentId = next.target;
  }

  return ids;
}

export function hasStepsBelow(graph: AutomationFlowGraph, nodeId: string): boolean {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node || node.type === "start" || node.type === "end") return false;

  if (node.type === "action_send_message") {
    const data = normalizeSendMessageData(node.data as Record<string, unknown>);
    if (isInteractiveBranching(data)) return false;
  }

  return collectPathNodesBelowExclusive(graph, nodeId).length > 0;
}

/** Inclusive chain from nodeId following primary edges, stopping before End. */
function collectPathChainInclusive(graph: AutomationFlowGraph, nodeId: string): string[] {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return [];

  const ids = [nodeId];
  let currentId = nodeId;

  while (true) {
    const edge = getPrimaryOutgoingEdge(graph, currentId);
    if (!edge) break;
    const nextNode = graph.nodes.find((n) => n.id === edge.target);
    if (!nextNode || nextNode.type === "end") break;
    ids.push(nextNode.id);
    currentId = nextNode.id;
  }

  return ids;
}

function cloneNodesWithIdMap(
  graph: AutomationFlowGraph,
  nodeIds: string[],
): { nodes: AutomationFlowGraphNode[]; idMap: Map<string, string> } {
  const idMap = new Map<string, string>();
  const nodes: AutomationFlowGraphNode[] = [];

  nodeIds.forEach((oldId, index) => {
    const original = graph.nodes.find((n) => n.id === oldId);
    if (!original) return;
    const id = newNodeId(original.type, index);
    idMap.set(oldId, id);
    nodes.push({
      ...original,
      id,
      data: cloneNodeData(original),
      position: { ...original.position },
    });
  });

  return { nodes, idMap };
}

function cloneSubgraphEdges(
  graph: AutomationFlowGraph,
  nodeIds: string[],
  idMap: Map<string, string>,
  clonedNodes: AutomationFlowGraphNode[],
): AutomationFlowGraphEdge[] {
  const idSet = new Set(nodeIds);
  const internalEdges = graph.edges.filter((e) => idSet.has(e.source) && idSet.has(e.target));

  return internalEdges.map((edge) => {
    let sourceHandle = edge.sourceHandle ?? null;
    if (sourceHandle && isBranchHandle(sourceHandle) && sourceHandle !== "option:other") {
      const oldSourceNode = graph.nodes.find((n) => n.id === edge.source);
      const newSourceNode = clonedNodes.find((n) => n.id === idMap.get(edge.source));
      if (oldSourceNode?.type === "action_send_message" && newSourceNode) {
        const oldData = normalizeSendMessageData(oldSourceNode.data as Record<string, unknown>);
        const newData = normalizeSendMessageData(newSourceNode.data as Record<string, unknown>);
        const oldOptionId = sourceHandle.replace("option:", "");
        const oldOptionIndex = oldData.listOptions?.findIndex((o) => o.id === oldOptionId) ?? -1;
        if (oldOptionIndex >= 0 && newData.listOptions?.[oldOptionIndex]) {
          sourceHandle = `option:${newData.listOptions[oldOptionIndex].id}`;
        }
      }
    }
    return {
      id: `e-${idMap.get(edge.source)!}-${idMap.get(edge.target)!}-${sourceHandle ?? "main"}`,
      source: idMap.get(edge.source)!,
      target: idMap.get(edge.target)!,
      sourceHandle,
      targetHandle: edge.targetHandle ?? null,
    };
  });
}

function cloneBranchSubtreesForSendNode(
  graph: AutomationFlowGraph,
  sendNodeId: string,
  clonedSendId: string,
  clonedSendNode: AutomationFlowGraphNode,
): { nodes: AutomationFlowGraphNode[]; edges: AutomationFlowGraphEdge[] } {
  const branchNodeIds = collectBranchSubtreeNodeIds(graph, sendNodeId);
  if (branchNodeIds.length === 0) return { nodes: [], edges: [] };

  const { nodes, idMap } = cloneNodesWithIdMap(graph, branchNodeIds);
  const edges = cloneSubgraphEdges(graph, branchNodeIds, idMap, nodes);

  const sendData = normalizeSendMessageData(clonedSendNode.data as Record<string, unknown>);
  const oldSendData = normalizeSendMessageData(
    graph.nodes.find((n) => n.id === sendNodeId)!.data as Record<string, unknown>,
  );

  for (const handle of getInteractiveBranchHandles(sendData)) {
    let oldHandle = handle;
    if (handle !== "option:other") {
      const optionId = handle.replace("option:", "");
      const oldIndex = oldSendData.listOptions?.findIndex((o) => o.id === optionId) ?? -1;
      if (oldIndex >= 0 && sendData.listOptions?.[oldIndex]) {
        oldHandle = `option:${oldSendData.listOptions![oldIndex].id}`;
      }
    }
    const firstInBranch = collectBranchChain(graph, sendNodeId, oldHandle)[0];
    if (firstInBranch) {
      const clonedFirst = idMap.get(firstInBranch.id);
      if (clonedFirst) {
        edges.push({
          id: `e-${clonedSendId}-${clonedFirst}-${handle}`,
          source: clonedSendId,
          target: clonedFirst,
          sourceHandle: handle,
        });
      }
    }
  }

  return { nodes, edges };
}

function splitPrimaryEdge(
  edges: AutomationFlowGraphEdge[],
  nodeId: string,
  clonedId: string,
  childTarget: string | undefined,
  sourceHandle: string | null,
): AutomationFlowGraphEdge[] {
  const filtered = edges.filter(
    (e) => !(e.source === nodeId && e.target === childTarget && !isBranchHandle(e.sourceHandle)),
  );
  filtered.push({
    id: `e-${nodeId}-${clonedId}`,
    source: nodeId,
    target: clonedId,
    sourceHandle,
  });
  if (childTarget) {
    filtered.push({
      id: `e-${clonedId}-${childTarget}`,
      source: clonedId,
      target: childTarget,
      sourceHandle: null,
    });
  }
  return filtered;
}

export function deleteBlock(
  graph: AutomationFlowGraph,
  nodeId: string,
): { graph: AutomationFlowGraph; removedNodeId: string } {
  const node = assertMutableNode(graph.nodes.find((n) => n.id === nodeId), nodeId);

  const removeIds = new Set<string>([nodeId]);
  for (const id of collectBranchSubtreeNodeIds(graph, nodeId)) {
    removeIds.add(id);
  }

  const incoming = getIncomingEdge(graph, nodeId);
  const outgoing = getPrimaryOutgoingEdge(graph, nodeId);

  let remainingEdges = graph.edges.filter(
    (e) => !removeIds.has(e.source) && !removeIds.has(e.target),
  );

  if (incoming && outgoing && !removeIds.has(outgoing.target)) {
    remainingEdges.push({
      id: `e-${incoming.source}-${outgoing.target}-${Date.now()}`,
      source: incoming.source,
      target: outgoing.target,
      sourceHandle: incoming.sourceHandle ?? null,
      targetHandle: outgoing.targetHandle ?? null,
    });
  }

  const remainingNodes = graph.nodes.filter((n) => !removeIds.has(n.id));

  return {
    graph: finalizeGraph({ ...graph, nodes: remainingNodes, edges: remainingEdges }),
    removedNodeId: nodeId,
  };
}

export function deleteBlocksBelow(
  graph: AutomationFlowGraph,
  nodeId: string,
): { graph: AutomationFlowGraph; removedNodeIds: string[] } {
  assertMutableNode(graph.nodes.find((n) => n.id === nodeId), nodeId);

  const toRemove = collectPathNodesBelowExclusive(graph, nodeId);
  if (toRemove.length === 0) {
    throw new Error("No steps below this block.");
  }

  const removeIds = new Set(toRemove);
  const outgoing = getPrimaryOutgoingEdge(graph, nodeId);
  let tailTarget: string | null = null;

  if (outgoing) {
    let currentId = outgoing.target;
    while (true) {
      const currentNode = graph.nodes.find((n) => n.id === currentId);
      if (!currentNode) break;
      if (currentNode.type === "end") {
        tailTarget = currentId;
        break;
      }
      if (!removeIds.has(currentId)) {
        tailTarget = currentId;
        break;
      }
      const next = getPrimaryOutgoingEdge(graph, currentId);
      if (!next) break;
      currentId = next.target;
    }
  }

  let remainingEdges = graph.edges.filter(
    (e) => !removeIds.has(e.source) && !removeIds.has(e.target),
  );

  if (tailTarget) {
    remainingEdges = remainingEdges.filter(
      (e) => !(e.source === nodeId && !isBranchHandle(e.sourceHandle)),
    );
    remainingEdges.push({
      id: `e-${nodeId}-${tailTarget}-${Date.now()}`,
      source: nodeId,
      target: tailTarget,
      sourceHandle: null,
    });
  }

  const remainingNodes = graph.nodes.filter((n) => !removeIds.has(n.id));

  return {
    graph: finalizeGraph({ ...graph, nodes: remainingNodes, edges: remainingEdges }),
    removedNodeIds: toRemove,
  };
}

export function copyBlock(
  graph: AutomationFlowGraph,
  nodeId: string,
): { graph: AutomationFlowGraph; newNodeId: string } {
  const node = assertMutableNode(graph.nodes.find((n) => n.id === nodeId), nodeId);

  const cloned: AutomationFlowGraphNode = {
    ...node,
    id: newNodeId(node.type, graph.nodes.length),
    data: cloneNodeData(node),
    position: { ...node.position },
  };

  const outgoing = getPrimaryOutgoingEdge(graph, nodeId);
  let newEdges = splitPrimaryEdge(
    graph.edges,
    nodeId,
    cloned.id,
    outgoing?.target,
    outgoing?.sourceHandle ?? null,
  );

  let extraNodes: AutomationFlowGraphNode[] = [];
  if (node.type === "action_send_message") {
    const data = normalizeSendMessageData(node.data as Record<string, unknown>);
    if (isInteractiveBranching(data)) {
      const branchClone = cloneBranchSubtreesForSendNode(graph, nodeId, cloned.id, cloned);
      extraNodes = branchClone.nodes;
      newEdges = [...newEdges, ...branchClone.edges];
    }
  }

  return {
    graph: finalizeGraph({
      ...graph,
      nodes: [...graph.nodes, cloned, ...extraNodes],
      edges: newEdges,
    }),
    newNodeId: cloned.id,
  };
}

export function copyBlockAndBelow(
  graph: AutomationFlowGraph,
  nodeId: string,
): { graph: AutomationFlowGraph; newRootNodeId: string } {
  assertMutableNode(graph.nodes.find((n) => n.id === nodeId), nodeId);

  const chainIds = collectPathChainInclusive(graph, nodeId);
  const tailId = chainIds[chainIds.length - 1] ?? nodeId;
  const afterChainEdge = getPrimaryOutgoingEdge(graph, tailId);
  const afterChainTarget = afterChainEdge?.target;

  const { nodes: clonedNodes, idMap } = cloneNodesWithIdMap(graph, chainIds);
  const clonedEdges = cloneSubgraphEdges(graph, chainIds, idMap, clonedNodes);

  const clonedRootId = idMap.get(nodeId)!;
  const clonedTailId = idMap.get(tailId)!;
  const firstOriginalChild = chainIds.length > 1 ? chainIds[1] : afterChainTarget;

  let newEdges = graph.edges.filter(
    (e) => !(e.source === nodeId && e.target === chainIds[1] && chainIds.length > 1),
  );

  if (chainIds.length === 1) {
    newEdges = splitPrimaryEdge(
      newEdges,
      nodeId,
      clonedRootId,
      afterChainTarget,
      getPrimaryOutgoingEdge(graph, nodeId)?.sourceHandle ?? null,
    );
  } else {
    newEdges.push({
      id: `e-${nodeId}-${clonedRootId}`,
      source: nodeId,
      target: clonedRootId,
      sourceHandle: getPrimaryOutgoingEdge(graph, nodeId)?.sourceHandle ?? null,
    });
    if (firstOriginalChild) {
      newEdges.push({
        id: `e-${clonedTailId}-${firstOriginalChild}`,
        source: clonedTailId,
        target: firstOriginalChild,
        sourceHandle: null,
      });
    }
  }

  return {
    graph: finalizeGraph({
      ...graph,
      nodes: [...graph.nodes, ...clonedNodes],
      edges: [...newEdges, ...clonedEdges],
    }),
    newRootNodeId: clonedRootId,
  };
}

export function computeHasStepsBelowForGraph(graph: AutomationFlowGraph): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const node of graph.nodes) {
    if (node.type !== "start" && node.type !== "end") {
      result[node.id] = hasStepsBelow(graph, node.id);
    }
  }
  return result;
}

/** @internal for tests */
export function getLinearChainFromStart(graph: AutomationFlowGraph) {
  const start = graph.nodes.find((n) => n.type === "start");
  if (!start) return [];
  return collectLinearChain(graph, start.id);
}
