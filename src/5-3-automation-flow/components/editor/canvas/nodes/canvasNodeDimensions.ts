/** Fixed canvas block width — layout spacing is derived from this. */
export const CANVAS_NODE_WIDTH = 280;

/** Fixed message preview body height inside send-message blocks. */
export const SEND_MESSAGE_BODY_HEIGHT_PX = 72;

/** Layout height budget per node type (must match rendered block size). */
export const CANVAS_NODE_HEIGHT = {
  start: 96,
  end: 120,
  action_send_message: 200,
  default: 104,
} as const;

/** Vertical gap between stacked nodes. */
export const CANVAS_NODE_VERTICAL_GAP = 56;

/** Space below branching send node before first branch row (rail + labels). */
export const CANVAS_BRANCH_STUB_CLEARANCE = 128;

/** Minimum gutter between adjacent block edges in branch columns. */
export const CANVAS_COLUMN_GUTTER = 48;

/** Minimum center-to-center gap so block edges never overlap. */
export const MIN_BRANCH_CENTER_GAP = CANVAS_NODE_WIDTH + CANVAS_COLUMN_GUTTER;

/** Horizontal center-to-center gap between branch columns for a given handle count. */
export function resolveBranchColumnGap(handleCount: number): number {
  if (handleCount <= 1) return MIN_BRANCH_CENTER_GAP;
  return MIN_BRANCH_CENTER_GAP;
}

export function estimateSendNodeHalfWidth(): number {
  return CANVAS_NODE_WIDTH / 2 + CANVAS_COLUMN_GUTTER / 2;
}

/** Half-width of a fan with `handleCount` columns spaced by `centerGap`. */
export function branchFanHalfWidthFromGap(handleCount: number, centerGap: number): number {
  if (handleCount <= 1) return estimateSendNodeHalfWidth();
  return ((handleCount - 1) * centerGap) / 2 + estimateSendNodeHalfWidth();
}

export function estimateCanvasNodeHeight(type: string): number {
  if (type === "start") return CANVAS_NODE_HEIGHT.start;
  if (type === "end") return CANVAS_NODE_HEIGHT.end;
  if (type === "action_send_message") return CANVAS_NODE_HEIGHT.action_send_message;
  return CANVAS_NODE_HEIGHT.default;
}
