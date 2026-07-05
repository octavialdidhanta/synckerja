import { createFlowNode } from "@/5-3-automation-flow/components/editor/panels/NodeInspectorPanel";
import { prepareAutomationFlowGraph } from "@/5-3-automation-flow/lib/graph/prepareAutomationFlowGraph";
import { reorderNodesByTopology } from "@/5-3-automation-flow/lib/graph/layoutBranchingGraph";
import type {
  AutomationFlowGraph,
  AutomationFlowNodeType,
} from "@/5-3-automation-flow/types/automationFlowGraph.types";

export function insertNodeBetween(
  graph: AutomationFlowGraph,
  sourceId: string,
  targetId: string,
  nodeType: AutomationFlowNodeType,
): { graph: AutomationFlowGraph; newNodeId: string } {
  const sourceNode = graph.nodes.find((n) => n.id === sourceId);
  if (sourceNode?.type === "end") {
    throw new Error("Cannot insert a step after an End node.");
  }

  const newNode = createFlowNode(nodeType, graph.nodes.length);
  const existingEdge = graph.edges.find((e) => e.source === sourceId && e.target === targetId);
  const filteredEdges = graph.edges.filter(
    (edge) => !(edge.source === sourceId && edge.target === targetId),
  );
  const newEdges = [
    ...filteredEdges,
    {
      id: `e-${sourceId}-${newNode.id}`,
      source: sourceId,
      target: newNode.id,
      sourceHandle: existingEdge?.sourceHandle ?? null,
    },
    {
      id: `e-${newNode.id}-${targetId}`,
      source: newNode.id,
      target: targetId,
      sourceHandle: null,
    },
  ];

  const withNewNode = { ...graph, nodes: [...graph.nodes, newNode], edges: newEdges };
  const orderedNodes = reorderNodesByTopology(withNewNode);
  const nextGraph = prepareAutomationFlowGraph({ ...withNewNode, nodes: orderedNodes });

  return {
    graph: nextGraph,
    newNodeId: newNode.id,
  };
}

export function insertNodeOnBranch(
  graph: AutomationFlowGraph,
  sourceId: string,
  sourceHandle: string,
  nodeType: AutomationFlowNodeType,
): { graph: AutomationFlowGraph; newNodeId: string } {
  const existing = graph.edges.find(
    (e) => e.source === sourceId && e.sourceHandle === sourceHandle,
  );
  if (existing) {
    return insertNodeBetween(graph, sourceId, existing.target, nodeType);
  }

  const newNode = createFlowNode(nodeType, graph.nodes.length);
  const newEdges = [
    ...graph.edges,
    {
      id: `e-${sourceId}-${newNode.id}-${sourceHandle}`,
      source: sourceId,
      target: newNode.id,
      sourceHandle,
    },
  ];
  const withNewNode = { ...graph, nodes: [...graph.nodes, newNode], edges: newEdges };
  const orderedNodes = reorderNodesByTopology(withNewNode);
  const nextGraph = prepareAutomationFlowGraph({ ...withNewNode, nodes: orderedNodes });
  return { graph: nextGraph, newNodeId: newNode.id };
}
