import { Fragment, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { cn } from "@/shared/lib/utils";
import { mapLinkPath, settleCurves, type MapCurve } from "@/thinking-lab/section/map/mapGeometry";

export { panToCenter, settleCurves } from "./mapGeometry";

export function longestLabel(labels: string[]): string {
  return labels.reduce((widest, label) => (label.length > widest.length ? label : widest), "");
}

function WidthSizer({ label, accent = false, star = false }: { label: string; accent?: boolean; star?: boolean }) {
  if (!label) return null;
  return (
    <div className="invisible col-start-1 row-start-1 h-0 w-max min-w-max" aria-hidden>
      <div
        className={cn(
          "flex w-max items-center whitespace-nowrap border border-transparent text-xs font-medium",
          accent ? "gap-1.5 pl-1 pr-2" : "px-2",
        )}
      >
        {accent ? <span className="w-0.5 shrink-0" /> : null}
        <span>{label}</span>
        {star ? <span className="ml-1 h-3 w-3 shrink-0" /> : null}
      </div>
    </div>
  );
}

export function EqualBranch({
  labels,
  widthLabel,
  accent = false,
  star = false,
  levelLabel,
  codes,
  rows,
}: {
  labels: string[];
  /** When set, every node in the branch uses this width instead of its own text. */
  widthLabel?: string;
  accent?: boolean;
  star?: boolean;
  levelLabel?: string;
  codes?: string[];
  rows: Array<{ key: string; leading?: ReactNode; pill: ReactNode; branch?: ReactNode }>;
}) {
  const open = rows.some((row) => row.branch);
  const locked = widthLabel?.trim() ?? "";
  const measured = locked
    ? [locked]
    : labels.map((label, index) => {
        const header = [levelLabel, codes?.[index]?.trim()].filter(Boolean).join(" - ");
        return header.length > label.length ? header : label;
      });
  return (
    <div
      className={cn(
        "inline-grid items-center gap-y-3",
        open ? "grid-cols-[max-content_auto] gap-x-14" : "grid-cols-[max-content]",
      )}
    >
      {rows.map((row, index) => (
        <Fragment key={row.key}>
          <div className="relative grid min-w-full">
            {index === 0 ? (
              <WidthSizer label={longestLabel(measured)} accent={accent} star={star} />
            ) : null}
            {row.leading}
            {row.pill}
          </div>
          {open ? <div className="flex items-center self-center">{row.branch}</div> : null}
        </Fragment>
      ))}
    </div>
  );
}

function layoutBox(root: HTMLElement, node: HTMLElement) {
  const rootBox = root.getBoundingClientRect();
  const box = node.getBoundingClientRect();
  const scaleX = root.offsetWidth > 0 ? rootBox.width / root.offsetWidth : 1;
  const scaleY = root.offsetHeight > 0 ? rootBox.height / root.offsetHeight : 1;
  return {
    left: (box.left - rootBox.left) / scaleX,
    right: (box.right - rootBox.left) / scaleX,
    midY: (box.top + box.height / 2 - rootBox.top) / scaleY,
    width: box.width / scaleX,
  };
}

export function MapCurves({
  canvasRef,
  links,
  layoutEpoch,
}: {
  canvasRef: RefObject<HTMLDivElement | null>;
  links: Array<{ from: string; to: string }>;
  layoutEpoch: string;
}) {
  const [paths, setPaths] = useState<MapCurve[]>([]);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const linksRef = useRef(links);
  linksRef.current = links;
  const signature = links.map((link) => `${link.from}>${link.to}`).join("|");
  useLayoutEffect(() => {
    let frame = 0;
    let attempts = 0;
    const draw = () => {
      const root = canvasRef.current;
      if (!root) return;
      let unmeasured = 0;
      const measured = linksRef.current.flatMap((link) => {
        const fromNode = root.querySelector(`[data-map-node="${link.from}"]`);
        const toNode = root.querySelector(`[data-map-node="${link.to}"]`);
        if (!(fromNode instanceof HTMLElement) || !(toNode instanceof HTMLElement)) {
          unmeasured += 1;
          return [];
        }
        const from = layoutBox(root, fromNode);
        const to = layoutBox(root, toNode);
        if (from.width === 0 || to.width === 0) {
          unmeasured += 1;
          return [];
        }
        const count = fromNode.querySelector("[data-map-count]");
        const fromX = count instanceof HTMLElement ? layoutBox(root, count).right : from.right;
        return [{ id: `${link.from}>${link.to}`, d: mapLinkPath(fromX, from.midY, to.left, to.midY) }];
      });
      setPaths((current) => {
        const next = settleCurves(current, measured, unmeasured);
        return current.length === next.length && current.every((path, index) => path.id === next[index]?.id && path.d === next[index]?.d)
          ? current
          : next;
      });
      const width = root.scrollWidth;
      const height = root.scrollHeight;
      if (width > 0 && height > 0) setBox((current) => (current.width === width && current.height === height ? current : { width, height }));
      if (unmeasured > 0 && attempts < 2) {
        attempts += 1;
        frame = requestAnimationFrame(draw);
      }
    };
    draw();
    const root = canvasRef.current;
    if (!root || typeof ResizeObserver === "undefined") return () => cancelAnimationFrame(frame);
    const observer = new ResizeObserver(draw);
    observer.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [canvasRef, signature, layoutEpoch]);
  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
      width={box.width || undefined}
      height={box.height || undefined}
      aria-hidden
    >
      {paths.map((path) => (
        <path key={path.id} d={path.d} fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
      ))}
    </svg>
  );
}
