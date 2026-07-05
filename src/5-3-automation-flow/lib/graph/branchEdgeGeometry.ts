/** Vertical drop from send node bottom before the horizontal branch rail. */
export const BRANCH_RAIL_DROP = 44;

export function getBranchRailPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  railDrop = BRANCH_RAIL_DROP,
): {
  path: string;
  railY: number;
  labelX: number;
  labelY: number;
  buttonY: number;
} {
  const railY = sourceY + railDrop;
  const path = `M ${sourceX},${sourceY} L ${sourceX},${railY} L ${targetX},${railY} L ${targetX},${targetY}`;
  const verticalSpan = Math.max(targetY - railY, 1);
  return {
    path,
    railY,
    labelX: targetX,
    /** Vertical center for the label + insert button stack on the branch drop. */
    anchorY: railY + verticalSpan * 0.42,
  };
}
