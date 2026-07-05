import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  type EdgeProps,
} from "@xyflow/react";
import { EdgeAddStepButton } from "@/5-3-automation-flow/components/editor/canvas/edges/EdgeAddStepButton";
import type { AutomationFlowNodeType } from "@/5-3-automation-flow/types/automationFlowGraph.types";

export type InsertableEdgeData = {
  onInsert?: (sourceId: string, targetId: string, nodeType: AutomationFlowNodeType) => void;
};

export function InsertableFlowEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const edgeData = (data ?? {}) as InsertableEdgeData;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: "#93c5fd", strokeWidth: 2 }} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan nowheel pointer-events-auto"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            zIndex: 1001,
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <EdgeAddStepButton
            onSelect={(nodeType) => {
              edgeData.onInsert?.(source, target, nodeType);
            }}
          />
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
