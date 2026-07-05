import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import { EdgeAddStepButton } from "@/5-3-automation-flow/components/editor/canvas/edges/EdgeAddStepButton";
import { getBranchRailPath } from "@/5-3-automation-flow/lib/graph/branchEdgeGeometry";
import type { BranchEdgeLabelParts } from "@/5-3-automation-flow/components/editor/canvas/nodes/flowNodeTypes";
import type { AutomationFlowNodeType } from "@/5-3-automation-flow/types/automationFlowGraph.types";

export type BranchLabelEdgeData = {
  labelParts?: BranchEdgeLabelParts | null;
  onInsert?: (sourceId: string, targetId: string, nodeType: AutomationFlowNodeType) => void;
};

function BranchEdgeLabelBadge({ parts }: { parts: BranchEdgeLabelParts }) {
  return (
    <span className="inline-flex max-w-[220px] flex-wrap items-center justify-center gap-0.5 rounded-md border border-border bg-white px-2 py-1 text-[10px] font-medium text-foreground shadow-sm">
      <span>{parts.prefix}</span>
      {parts.highlight ? (
        <span className="rounded bg-blue-50 px-1 font-semibold text-blue-700">{parts.highlight}</span>
      ) : null}
    </span>
  );
}

export function BranchLabelEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps) {
  const { path: edgePath, labelX, anchorY } = getBranchRailPath(
    sourceX,
    sourceY,
    targetX,
    targetY,
  );

  const edgeData = (data ?? {}) as BranchLabelEdgeData;
  const labelParts = edgeData.labelParts;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: "#93c5fd", strokeWidth: 2 }} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan nowheel flex flex-col items-center gap-4"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${anchorY}px)`,
            zIndex: 1001,
          }}
        >
          {labelParts ? (
            <div className="pointer-events-none">
              <BranchEdgeLabelBadge parts={labelParts} />
            </div>
          ) : null}
          <div
            className="pointer-events-auto"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <EdgeAddStepButton
              onSelect={(nodeType) => {
                edgeData.onInsert?.(source, target, nodeType);
              }}
            />
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
