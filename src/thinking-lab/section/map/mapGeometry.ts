export function mapLinkPath(x1: number, y1: number, x2: number, y2: number): string {
  if (Math.abs(y1 - y2) <= 24) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const mid = x1 + (x2 - x1) * 0.55;
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
}

export type MapCurve = { id: string; d: string };

export function settleCurves<T>(current: T[], measured: T[], unmeasured: number): T[] {
  if (unmeasured > 0 && measured.length === 0) return current;
  return measured;
}

/** Screen-pixel pan that places a node at the center of the map viewport. */
export function panToCenter(input: {
  viewport: { left: number; top: number; width: number; height: number };
  node: { left: number; top: number; width: number; height: number };
}): { x: number; y: number } | null {
  const nodeCenterX = input.node.left + input.node.width / 2 - input.viewport.left;
  const nodeCenterY = input.node.top + input.node.height / 2 - input.viewport.top;
  const x = input.viewport.width / 2 - nodeCenterX;
  const y = input.viewport.height / 2 - nodeCenterY;
  if (Math.hypot(x, y) < 2) return null;
  return { x, y };
}