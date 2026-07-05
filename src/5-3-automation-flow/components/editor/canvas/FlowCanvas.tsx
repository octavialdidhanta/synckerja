import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { flowNodeTypes, getBranchEdgeLabelParts, nodeSubtitle } from "@/5-3-automation-flow/components/editor/canvas/nodes/flowNodeTypes";
import { flowEdgeTypes } from "@/5-3-automation-flow/components/editor/canvas/edges/flowEdgeTypes";
import type { InsertableEdgeData } from "@/5-3-automation-flow/components/editor/canvas/edges/InsertableFlowEdge";
import type { BranchLabelEdgeData } from "@/5-3-automation-flow/components/editor/canvas/edges/BranchLabelEdge";
import { computeActionNumbers } from "@/5-3-automation-flow/lib/graph/computeActionNumbers";
import { resolveJumpTargetLabel } from "@/5-3-automation-flow/lib/graph/endNodeData";
import { computeHasStepsBelowForGraph } from "@/5-3-automation-flow/lib/graph/graphBlockMutations";
import type {
  AutomationFlowGraph,
  AutomationFlowGraphNode,
  AutomationFlowNodeType,
} from "@/5-3-automation-flow/types/automationFlowGraph.types";

type FlowCanvasProps = {
  graph: AutomationFlowGraph;
  selectedNodeId: string | null;
  onGraphChange: (graph: AutomationFlowGraph) => void;
  onSelectNodeId: (nodeId: string | null) => void;
  onInsertBetween: (sourceId: string, targetId: string, nodeType: AutomationFlowNodeType) => void;
  onInsertOnBranch: (sourceId: string, sourceHandle: string, nodeType: AutomationFlowNodeType) => void;
  onCopyBlock: (nodeId: string) => void;
  onCopyBlockAndBelow: (nodeId: string) => void;
  onDeleteBlock: (nodeId: string) => void;
  onDeleteBelow: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
};

type FlowCallbacks = Pick<
  FlowCanvasProps,
  | "onInsertBetween"
  | "onInsertOnBranch"
  | "onCopyBlock"
  | "onCopyBlockAndBelow"
  | "onDeleteBlock"
  | "onDeleteBelow"
  | "onSelectNodeId"
  | "onUpdateNode"
>;

function isBranchHandle(handle: string | null | undefined): boolean {
  return Boolean(handle?.startsWith("option:"));
}

function applySelectedFlag(nodes: Node[], selectedNodeId: string | null): Node[] {
  return nodes.map((node) => ({
    ...node,
    selected: node.id === selectedNodeId,
  }));
}

function graphToFlow(
  graph: AutomationFlowGraph,
  callbacksRef: React.MutableRefObject<FlowCallbacks>,
  formatActionLabel: (actionNumber: number) => string,
): { nodes: Node[]; edges: Edge[] } {
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  const stepsBelowMap = computeHasStepsBelowForGraph(graph);
  const actionNumbers = computeActionNumbers(graph);

  const nodes: Node[] = (graph.nodes ?? []).map((node) => {
    const connectedBranchHandles =
      node.type === "action_send_message"
        ? graph.edges
            .filter((e) => e.source === node.id && isBranchHandle(e.sourceHandle))
            .map((e) => String(e.sourceHandle))
        : [];

    const endExtras =
      node.type === "end"
        ? {
            jumpTargetLabel: resolveJumpTargetLabel(
              graph,
              (node.data as { jumpToNodeId?: string | null }).jumpToNodeId,
              formatActionLabel,
            ),
            onEndPatch: (nodeId: string, patch: Record<string, unknown>) => {
              callbacksRef.current.onUpdateNode(nodeId, patch);
            },
          }
        : {};

    return {
      id: node.id,
      type: node.type,
      position: node.position,
      hidden: node.position.x > 5000,
      data: {
        ...node.data,
        ...(actionNumbers.has(node.id) ? { actionNumber: actionNumbers.get(node.id) } : {}),
        ...endExtras,
        subtitle: nodeSubtitle(node.type, node.data as Record<string, unknown>),
        connectedBranchHandles,
        onNodeActivate: (nodeId: string) => {
          callbacksRef.current.onSelectNodeId(nodeId);
        },
        onBranchInsert: (sourceId: string, sourceHandle: string, nodeType: AutomationFlowNodeType) => {
          callbacksRef.current.onInsertOnBranch(sourceId, sourceHandle, nodeType);
        },
        ...(node.type !== "start" && node.type !== "end"
          ? {
              hasStepsBelow: stepsBelowMap[node.id] ?? false,
              onCopyBlock: (nodeId: string) => callbacksRef.current.onCopyBlock(nodeId),
              onCopyBlockAndBelow: (nodeId: string) => callbacksRef.current.onCopyBlockAndBelow(nodeId),
              onDeleteBlock: (nodeId: string) => callbacksRef.current.onDeleteBlock(nodeId),
              onDeleteBelow: (nodeId: string) => callbacksRef.current.onDeleteBelow(nodeId),
            }
          : {}),
      },
    };
  });

  const hiddenNodeIds = new Set(nodes.filter((n) => n.hidden).map((n) => n.id));

  const edges: Edge[] = (graph.edges ?? [])
    .filter((edge) => !hiddenNodeIds.has(edge.source) && !hiddenNodeIds.has(edge.target))
    .map((edge) => {
    const sourceNode = nodesById.get(edge.source);
    const isBranchEdge =
      sourceNode?.type === "action_send_message" && isBranchHandle(edge.sourceHandle);

    if (isBranchEdge) {
      const labelParts = getBranchEdgeLabelParts(
        edge.sourceHandle,
        (sourceNode?.data ?? {}) as Record<string, unknown>,
      );
      return {
        id: edge.id,
        type: "branchLabel",
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
        data: {
          labelParts,
          onInsert: (sourceId: string, targetId: string, nodeType: AutomationFlowNodeType) => {
            callbacksRef.current.onInsertBetween(sourceId, targetId, nodeType);
          },
        } satisfies BranchLabelEdgeData,
      };
    }

    return {
      id: edge.id,
      type: "insertable",
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? undefined,
      targetHandle: edge.targetHandle ?? undefined,
      data: {
        onInsert: (sourceId: string, targetId: string, nodeType: AutomationFlowNodeType) => {
          callbacksRef.current.onInsertBetween(sourceId, targetId, nodeType);
        },
      } satisfies InsertableEdgeData,
    };
  });

  return { nodes, edges };
}

function flowToGraph(nodes: Node[], edges: Edge[], viewport: AutomationFlowGraph["viewport"]): AutomationFlowGraph {
  const graphNodes: AutomationFlowGraphNode[] = nodes.map((node) => ({
    id: node.id,
    type: node.type as AutomationFlowNodeType,
    position: node.position,
    data: { ...(node.data as Record<string, unknown>) },
  }));
  graphNodes.forEach((n) => {
    const data = n.data as Record<string, unknown>;
    delete data.subtitle;
    delete data.selected;
    delete data.actionNumber;
    delete data.connectedBranchHandles;
    delete data.onBranchInsert;
    delete data.onNodeActivate;
    delete data.hasStepsBelow;
    delete data.onCopyBlock;
    delete data.onCopyBlockAndBelow;
    delete data.onDeleteBlock;
    delete data.onDeleteBelow;
    delete data.onEndPatch;
    delete data.jumpTargetLabel;
  });
  return {
    nodes: graphNodes,
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
    })),
    viewport,
  };
}

function endSyncGuard(syncingRef: React.MutableRefObject<boolean>) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  });
}

function FlowCanvasInner({
  graph,
  selectedNodeId,
  onGraphChange,
  onSelectNodeId,
  onInsertBetween,
  onInsertOnBranch,
  onCopyBlock,
  onCopyBlockAndBelow,
  onDeleteBlock,
  onDeleteBelow,
  onUpdateNode,
}: FlowCanvasProps) {
  const { t } = useTranslation();
  const formatActionLabelRef = useRef<(actionNumber: number) => string>((actionNumber) => `Action ${actionNumber}`);
  formatActionLabelRef.current = (actionNumber: number) =>
    t("omnichannel.automationFlow.editor.canvas.actionLabel", {
      number: actionNumber,
      defaultValue: "Action {{number}}",
    });

  const callbacksRef = useRef<FlowCallbacks>({
    onInsertBetween,
    onInsertOnBranch,
    onCopyBlock,
    onCopyBlockAndBelow,
    onDeleteBlock,
    onDeleteBelow,
    onSelectNodeId,
    onUpdateNode,
  });
  callbacksRef.current = {
    onInsertBetween,
    onInsertOnBranch,
    onCopyBlock,
    onCopyBlockAndBelow,
    onDeleteBlock,
    onDeleteBelow,
    onSelectNodeId,
    onUpdateNode,
  };

  const selectedNodeIdRef = useRef(selectedNodeId);
  selectedNodeIdRef.current = selectedNodeId;

  const buildFlow = () => graphToFlow(graph, callbacksRef, formatActionLabelRef.current);

  const [nodes, setNodes, onNodesChange] = useNodesState(() => {
    const next = buildFlow();
    return applySelectedFlag(next.nodes, selectedNodeId);
  });
  const [edges, setEdges, onEdgesChange] = useEdgesState(() => buildFlow().edges);
  const viewportRef = useRef(graph.viewport);
  const syncingRef = useRef(false);

  useEffect(() => {
    syncingRef.current = true;
    const next = buildFlow();
    setNodes(applySelectedFlag(next.nodes, selectedNodeIdRef.current));
    setEdges(next.edges);
    viewportRef.current = graph.viewport;
    endSyncGuard(syncingRef);
  }, [graph, setNodes, setEdges, t]);

  useEffect(() => {
    setNodes((current) => applySelectedFlag(current, selectedNodeId));
  }, [selectedNodeId, setNodes]);

  const emitChange = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      if (syncingRef.current) return;
      onGraphChange(flowToGraph(nextNodes, nextEdges, viewportRef.current));
    },
    [onGraphChange],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const next = addEdge(
          {
            ...connection,
            animated: true,
            type: "insertable",
            data: {
              onInsert: (sourceId, targetId, nodeType) => {
                callbacksRef.current.onInsertBetween(sourceId, targetId, nodeType);
              },
            } satisfies InsertableEdgeData,
          },
          eds,
        );
        emitChange(nodes, next);
        return next;
      });
    },
    [emitChange, nodes, setEdges],
  );

  const onSelectionChange = useCallback(
    ({ nodes: selected }: OnSelectionChangeParams) => {
      if (syncingRef.current) return;
      if (selected.length === 0) return;
      onSelectNodeId(selected[0].id);
    },
    [onSelectNodeId],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (syncingRef.current) return;
      onSelectNodeId(node.id);
    },
    [onSelectNodeId],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={flowNodeTypes}
      edgeTypes={flowEdgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onPaneClick={() => onSelectNodeId(null)}
      onNodeClick={onNodeClick}
      onSelectionChange={onSelectionChange}
      onMoveEnd={(_, viewport) => {
        viewportRef.current = viewport;
        emitChange(nodes, edges);
      }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      nodeOrigin={[0.5, 0]}
      fitView
      fitViewOptions={{ padding: 0.4 }}
      className="bg-muted/30"
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <div className="h-full min-h-[480px] w-full">
        <FlowCanvasInner {...props} />
      </div>
    </ReactFlowProvider>
  );
}
