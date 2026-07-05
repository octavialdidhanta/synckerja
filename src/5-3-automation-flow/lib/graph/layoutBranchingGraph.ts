import {
  branchFanHalfWidthFromGap,
  CANVAS_BRANCH_STUB_CLEARANCE,
  CANVAS_COLUMN_GUTTER,
  CANVAS_NODE_VERTICAL_GAP,
  CANVAS_NODE_WIDTH,
  estimateCanvasNodeHeight,
  estimateSendNodeHalfWidth,
  MIN_BRANCH_CENTER_GAP,
  resolveBranchColumnGap,
} from "@/5-3-automation-flow/components/editor/canvas/nodes/canvasNodeDimensions";
import {
  getInteractiveBranchHandles,
  isInteractiveBranching,
  normalizeSendMessageData,
} from "@/5-3-automation-flow/lib/graph/sendMessageData";
import { layoutAutomationFlowGraphVertically } from "@/5-3-automation-flow/lib/graph/layoutGraph";
import type { AutomationFlowGraph, AutomationFlowGraphNode } from "@/5-3-automation-flow/types/automationFlowGraph.types";

const BRANCH_ROW_GAP = 140;

/** @deprecated Use CANVAS_NODE_VERTICAL_GAP */
const NODE_VERTICAL_GAP = CANVAS_NODE_VERTICAL_GAP;

/** @deprecated Use CANVAS_BRANCH_STUB_CLEARANCE */
const BRANCH_STUB_CLEARANCE = CANVAS_BRANCH_STUB_CLEARANCE;

function estimateNodeHeight(node: AutomationFlowGraphNode): number {
  return estimateCanvasNodeHeight(node.type);
}

/** @deprecated Prefer estimateNodeHeight + BRANCH_STUB_CLEARANCE */
const BRANCH_SEND_TO_STUB_GAP = 280;

function isBranchHandle(handle: string | null | undefined): boolean {
  return Boolean(handle?.startsWith("option:"));
}

function columnContentHalfWidth(
  graph: AutomationFlowGraph,
  sendNodeId: string,
  handle: string,
  memo: Map<string, number>,
): number {
  const chain = collectBranchChain(graph, sendNodeId, handle);
  if (chain.length === 0) return estimateSendNodeHalfWidth();

  const head = chain[0];
  if (head.type === "action_send_message") {
    const headData = normalizeSendMessageData(head.data as Record<string, unknown>);
    if (isInteractiveBranching(headData)) {
      return columnSpreadHalfWidth(graph, head.id, memo);
    }
  }

  return estimateSendNodeHalfWidth();
}

function columnSpreadHalfWidth(
  graph: AutomationFlowGraph,
  sendNodeId: string,
  memo: Map<string, number>,
): number {
  const cached = memo.get(sendNodeId);
  if (cached !== undefined) return cached;

  const node = graph.nodes.find((n) => n.id === sendNodeId);
  if (!node || node.type !== "action_send_message") {
    const leaf = estimateSendNodeHalfWidth();
    memo.set(sendNodeId, leaf);
    return leaf;
  }

  const data = normalizeSendMessageData(node.data as Record<string, unknown>);
  if (!isInteractiveBranching(data)) {
    const leaf = estimateSendNodeHalfWidth();
    memo.set(sendNodeId, leaf);
    return leaf;
  }

  const handles = getInteractiveBranchHandles(data);
  const columnHalfWidths = handles.map((handle) =>
    columnContentHalfWidth(graph, sendNodeId, handle, memo),
  );

  let centerGap = resolveBranchColumnGap(handles.length);
  for (let i = 0; i < columnHalfWidths.length - 1; i += 1) {
    const needed = columnHalfWidths[i] + columnHalfWidths[i + 1] + CANVAS_COLUMN_GUTTER;
    centerGap = Math.max(centerGap, needed);
  }

  const spread = branchFanHalfWidthFromGap(handles.length, centerGap);
  memo.set(sendNodeId, spread);
  return spread;
}

function resolveBranchCenterGap(
  graph: AutomationFlowGraph,
  sendNode: AutomationFlowGraphNode,
  handles: string[],
): number {
  if (handles.length <= 1) return MIN_BRANCH_CENTER_GAP;

  const memo = new Map<string, number>();
  const columnHalfWidths = handles.map((handle) =>
    columnContentHalfWidth(graph, sendNode.id, handle, memo),
  );

  let centerGap = resolveBranchColumnGap(handles.length);
  for (let i = 0; i < columnHalfWidths.length - 1; i += 1) {
    const needed = columnHalfWidths[i] + columnHalfWidths[i + 1] + CANVAS_COLUMN_GUTTER;
    centerGap = Math.max(centerGap, needed);
  }

  return centerGap;
}

export function collectBranchChain(
  graph: AutomationFlowGraph,
  sendNodeId: string,
  sourceHandle: string,
): AutomationFlowGraphNode[] {
  const chain: AutomationFlowGraphNode[] = [];
  let currentEdge = graph.edges.find(
    (e) => e.source === sendNodeId && e.sourceHandle === sourceHandle,
  );
  const visited = new Set<string>();

  while (currentEdge && !visited.has(currentEdge.target)) {
    visited.add(currentEdge.target);
    const node = graph.nodes.find((n) => n.id === currentEdge!.target);
    if (!node) break;
    chain.push(node);
    if (node.type === "end") break;
    currentEdge = graph.edges.find((e) => e.source === node.id && !isBranchHandle(e.sourceHandle));
  }

  return chain;
}

function collectLinearChain(graph: AutomationFlowGraph, startId: string): AutomationFlowGraphNode[] {
  const chain: AutomationFlowGraphNode[] = [];
  const startNode = graph.nodes.find((n) => n.id === startId);
  if (!startNode) return chain;

  chain.push(startNode);
  let currentId = startId;
  const visited = new Set<string>([startId]);

  while (true) {
    const edge = graph.edges.find(
      (e) => e.source === currentId && !isBranchHandle(e.sourceHandle),
    );
    if (!edge || visited.has(edge.target)) break;
    visited.add(edge.target);
    const node = graph.nodes.find((n) => n.id === edge.target);
    if (!node) break;
    chain.push(node);
    currentId = node.id;
    if (node.type === "end") break;
  }

  return chain;
}

function layoutLinearChainFromStart(graph: AutomationFlowGraph): Map<string, { x: number; y: number }> {
  const positioned = new Map<string, { x: number; y: number }>();
  const startNode = graph.nodes.find((n) => n.type === "start");
  if (!startNode) return positioned;

  const chain = collectLinearChain(graph, startNode.id);
  let y = 0;
  for (const node of chain) {
    positioned.set(node.id, { x: 0, y });
    y += estimateNodeHeight(node) + NODE_VERTICAL_GAP;
  }

  return positioned;
}

function layoutBranchColumns(
  graph: AutomationFlowGraph,
  sendNode: AutomationFlowGraphNode,
  positioned: Map<string, { x: number; y: number }>,
  placed: Set<string>,
): void {
  const sendPos = positioned.get(sendNode.id);
  const sendRowY = sendPos?.y ?? 0;
  const anchorX = sendPos?.x ?? 0;
  const branchBaseY = sendRowY + estimateNodeHeight(sendNode) + BRANCH_STUB_CLEARANCE;

  const data = normalizeSendMessageData(sendNode.data as Record<string, unknown>);
  const handles = getInteractiveBranchHandles(data);
  const centerGap = resolveBranchCenterGap(graph, sendNode, handles);
  const startX = anchorX - ((handles.length - 1) * centerGap) / 2;

  handles.forEach((handle, index) => {
    const columnX = startX + index * centerGap;
    const chain = collectBranchChain(graph, sendNode.id, handle);
    let columnY = branchBaseY;
    chain.forEach((node) => {
      positioned.set(node.id, { x: columnX, y: columnY });
      placed.add(node.id);
      columnY += estimateNodeHeight(node) + NODE_VERTICAL_GAP;
    });
  });
}

function hasIncomingEdge(graph: AutomationFlowGraph, nodeId: string): boolean {
  return graph.edges.some((e) => e.target === nodeId);
}

function placeOrphanNodes(
  graph: AutomationFlowGraph,
  positioned: Map<string, { x: number; y: number }>,
  placed: Set<string>,
): void {
  let maxY = 0;
  for (const pos of positioned.values()) {
    maxY = Math.max(maxY, pos.y);
  }
  let fallbackY = maxY + BRANCH_ROW_GAP;
  for (const node of graph.nodes) {
    if (!placed.has(node.id)) {
      if (node.type === "end" && !hasIncomingEdge(graph, node.id)) {
        positioned.set(node.id, { x: 9999, y: 9999 });
        placed.add(node.id);
        continue;
      }
      positioned.set(node.id, { x: 0, y: fallbackY });
      fallbackY += BRANCH_ROW_GAP;
    }
  }
}

export function reorderNodesByTopology(graph: AutomationFlowGraph): AutomationFlowGraphNode[] {
  const ordered: AutomationFlowGraphNode[] = [];
  const seen = new Set<string>();
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  const startNode = graph.nodes.find((n) => n.type === "start");
  if (startNode) {
    for (const node of collectLinearChain(graph, startNode.id)) {
      if (!seen.has(node.id)) {
        ordered.push(node);
        seen.add(node.id);
      }
    }
  }

  for (const sendNode of graph.nodes) {
    if (sendNode.type !== "action_send_message") continue;
    const data = normalizeSendMessageData(sendNode.data as Record<string, unknown>);
    if (!isInteractiveBranching(data)) continue;

    for (const handle of getInteractiveBranchHandles(data)) {
      for (const chainNode of collectBranchChain(graph, sendNode.id, handle)) {
        if (!seen.has(chainNode.id)) {
          ordered.push(chainNode);
          seen.add(chainNode.id);
        }
      }
    }
  }

  for (const node of graph.nodes) {
    if (!seen.has(node.id)) {
      ordered.push(node);
      seen.add(node.id);
    }
  }

  return ordered.map((node) => nodeById.get(node.id) ?? node);
}

export function layoutAutomationFlowGraph(graph: AutomationFlowGraph): AutomationFlowGraph {
  const orderedIds = reorderNodesByTopology(graph).map((n) => n.id);
  const branchSendNodes = graph.nodes
    .filter((n) => {
      if (n.type !== "action_send_message") return false;
      const data = normalizeSendMessageData(n.data as Record<string, unknown>);
      return isInteractiveBranching(data);
    })
    .sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));

  const positioned = new Map<string, { x: number; y: number }>();
  const placed = new Set<string>();

  if (branchSendNodes.length === 0) {
    for (const [nodeId, pos] of layoutLinearChainFromStart(graph)) {
      positioned.set(nodeId, pos);
      placed.add(nodeId);
    }
  } else {
    for (const [nodeId, pos] of layoutLinearChainFromStart(graph)) {
      positioned.set(nodeId, pos);
      placed.add(nodeId);
    }

    for (const sendNode of branchSendNodes) {
      if (!placed.has(sendNode.id)) {
        positioned.set(sendNode.id, { x: 0, y: 0 });
        placed.add(sendNode.id);
      }
      layoutBranchColumns(graph, sendNode, positioned, placed);
    }
  }

  placeOrphanNodes(graph, positioned, placed);

  const nodes = graph.nodes.map((node) => ({
    ...node,
    position: positioned.get(node.id) ?? node.position,
    hidden: (positioned.get(node.id)?.x ?? node.position.x) > 5000,
  }));

  return { ...graph, nodes };
}

export {
  layoutAutomationFlowGraphVertically,
  collectLinearChain,
  BRANCH_ROW_GAP,
  BRANCH_SEND_TO_STUB_GAP,
  CANVAS_NODE_WIDTH,
  columnSpreadHalfWidth,
};
