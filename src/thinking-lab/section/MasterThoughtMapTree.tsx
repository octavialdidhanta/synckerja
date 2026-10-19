import { Fragment, startTransition, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { AlertCircle, MoreVertical, Pencil, Star, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { angleListSubject } from "@/thinking-lab/angle/subject";
import { ideaLabel } from "@/thinking-lab/idea/subject";
import type { LabMasterThought } from "@/thinking-lab/master-thought/types";

export type MasterMapExecution = {
  id: string;
  label: string;
  passed: boolean;
};

export type MasterMapIdea = {
  id: string;
  code: string;
  statement: string;
  subject?: string;
  recommended?: boolean;
  executions?: MasterMapExecution[];
};

export type MasterMapAngle = {
  id: string;
  code: string;
  statement: string;
  subject?: string;
  childCount?: number;
  ideas?: MasterMapIdea[];
};

export type MasterMapTerritory = {
    id: string;
    code: string;
    statement: string;
  childCount?: number;
  angles?: MasterMapAngle[];
};

export type MasterMapChild = {
  id: string;
  code: string;
  label?: string;
  statement: string;
  childCount?: number;
  territories?: MasterMapTerritory[];
};

type PillTone = "master" | "bigThought" | "territory" | "angle" | "idea" | "execution";

const SOLID: Record<"master" | "bigThought", string> = {
  master: "border border-[#16365c] bg-[#1b3a6b] text-white",
  bigThought: "border border-[#3d6cb5] bg-[#3d6cb5] text-white",
};

const ACCENT: Record<"territory" | "angle" | "idea" | "execution", string> = {
  territory: "border border-[#c9a24a] bg-[#3a342c] text-white",
  angle: "border border-amber-700/80 bg-[#3a342c] text-white",
  idea: "border border-rose-400/80 bg-[#3a342c] text-white",
  execution: "border border-violet-400/80 bg-[#3a342c] text-white",
};

const ACCENT_BAR: Record<"territory" | "angle" | "idea" | "execution", string> = {
  territory: "bg-[#e8b84a]",
  angle: "bg-amber-500",
  idea: "bg-rose-400",
  execution: "bg-violet-400",
};

function masterNodeTitle(row: { canonicalSemantic: { subject: string | null } | null; statement: string; originalInput: string }): string {
  return (row.canonicalSemantic?.subject || row.statement || row.originalInput || "").trim();
}

function pillTitle(label: string | undefined, statement: string): string {
  const short = label?.trim();
  return short || statement.trim();
}

function longestLabel(labels: string[]): string {
  return labels.reduce((widest, label) => (label.length > widest.length ? label : widest), "");
}

function WidthSizer({ label, accent = false, star = false }: { label: string; accent?: boolean; star?: boolean }) {
  if (!label) return null;
  return (
    <div className="invisible col-start-1 row-start-1 h-0 min-h-0 w-max min-w-max overflow-hidden" aria-hidden>
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

function EqualBranch({
  labels,
  accent = false,
  star = false,
  levelLabel,
  codes,
  rows,
}: {
  labels: string[];
  accent?: boolean;
  star?: boolean;
  levelLabel?: string;
  codes?: string[];
  rows: Array<{ key: string; leading?: ReactNode; pill: ReactNode; branch?: ReactNode }>;
}) {
  const open = rows.some((row) => row.branch);
  const measured = labels.map((label, index) => {
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
          <div className="relative grid w-full">
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

const DEFAULT_MAP_VIEW = { x: 12, y: 12, scale: 1 };

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

function mapNodeSelector(nodeId: string): string {
  return `[data-map-node="${nodeId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
}

function readMapTranslation(canvas: HTMLElement): { x: number; y: number } | null {
  const transform = getComputedStyle(canvas).transform;
  if (!transform || transform === "none") return null;
  const match = transform.match(/matrix(?:3d)?\(([^)]+)\)/);
  if (!match?.[1]) return null;
  const parts = match[1].split(",").map((part) => Number(part.trim()));
  if (parts.length === 6) return { x: parts[4] ?? 0, y: parts[5] ?? 0 };
  if (parts.length === 16) return { x: parts[12] ?? 0, y: parts[13] ?? 0 };
  return null;
}

type OpenBranches = {
  master: boolean;
  thoughts: ReadonlySet<string>;
  territories: ReadonlySet<string>;
  angles: ReadonlySet<string>;
};

function freshBranches(): OpenBranches {
  return { master: false, thoughts: new Set(), territories: new Set(), angles: new Set() };
}

function withId(ids: ReadonlySet<string>, id: string, open: boolean): Set<string> {
  const next = new Set(ids);
  if (open) next.add(id);
  else next.delete(id);
  return next;
}

function MapCurves({
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

function Pill({
  nodeId,
  tone,
  title,
  code,
  fullTitle,
  selected,
  childCount,
  recommended,
  warning = false,
  stretch = false,
  accessory,
  onClick,
}: {
  nodeId: string;
  tone: PillTone;
  title: string;
  code?: string;
  fullTitle?: string;
  selected: boolean;
  childCount?: number;
  recommended?: boolean;
  warning?: boolean;
  stretch?: boolean;
  accessory?: ReactNode;
  onClick: () => void;
}) {
  const { t } = useAppTranslation();
  const count = childCount ?? 0;
  const solid = tone === "master" || tone === "bigThought";
  const level =
    tone === "master"
      ? t("thinkingLab.tree.masterThought", "Master Thought")
      : tone === "bigThought"
        ? t("thinkingLab.tree.bigThought", "Big Thought")
        : tone === "territory"
          ? t("thinkingLab.tree.territory", "Territory")
          : tone === "angle"
            ? t("thinkingLab.tree.angle", "Angle")
            : tone === "execution"
              ? t("thinkingLab.execution.label", "Execution")
              : t("thinkingLab.idea.list", "Idea");
  const badge = code?.trim();
  return (
    <div className={cn("relative col-start-1 row-start-1", stretch && "w-full")} data-map-node={nodeId}>
      <button
        type="button"
        onClick={onClick}
        title={fullTitle && fullTitle.trim() !== title.trim() ? fullTitle.trim() : undefined}
        aria-label={title.trim() || (badge ? `${level} - ${badge}` : level)}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "items-stretch whitespace-nowrap rounded-[4px] px-2 py-0.5 text-left text-xs font-medium",
          accessory && "pl-6",
          stretch ? "flex w-full" : "inline-flex w-max",
          solid ? SOLID[tone] : cn("gap-1.5 pl-1", ACCENT[tone]),
          tone === "bigThought" && selected && "border-[#16365c] bg-[#1e4a86]",
          tone === "territory" && selected && "border-[#f0c14b]",
          !solid && selected && tone !== "territory" && "ring-2 ring-[#16365c]",
        )}
      >
        {solid ? null : <span className={cn("my-0.5 w-0.5 shrink-0 self-stretch rounded-[1px]", ACCENT_BAR[tone])} aria-hidden />}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
          <span className="text-[10px] font-medium leading-none text-white/90">
            {badge ? `${level} - ${badge}` : level}
          </span>
          {title ? <span className="leading-none">{title}</span> : null}
        </span>
        {recommended ? (
          <Star
            className="ml-1 h-3 w-3 shrink-0 self-center fill-current"
            aria-label={t("thinkingLab.idea.recommended", "Recommended to start")}
          />
        ) : null}
        {warning ? (
          <AlertCircle className="ml-1 h-3.5 w-3.5 shrink-0 self-center text-rose-300" aria-label={t("thinkingLab.execution.failed", "Not passed")} />
        ) : null}
      </button>
      {accessory ? <div className="absolute left-0.5 top-1/2 z-10 -translate-y-1/2">{accessory}</div> : null}
      {count > 0 ? (
        <span
          className="absolute -right-2.5 top-1/2 flex h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white px-1 text-[10px] font-semibold text-slate-600 shadow-sm"
          data-map-count=""
          aria-label={t("thinkingLab.tree.childCount", "{{count}} below", { count })}
        >
          +{count}
        </span>
      ) : null}
    </div>
  );
}

type MasterThoughtMapTreeProps = {
  masters: LabMasterThought[];
  selectedId: string | null;
  inspectedMasterId: string | null;
  inspectedThoughtId: string | null;
  inspectedTerritoryId: string | null;
  inspectedAngleId: string | null;
  inspectedIdeaId: string | null;
  inspectedExecutionId?: string | null;
  childrenByMasterId: ReadonlyMap<string, MasterMapChild[]>;
  deleteDisabled?: boolean;
  onSelect: (id: string) => void;
  onSelectChild: (masterId: string, thoughtId: string) => void;
  onSelectTerritory: (masterId: string, thoughtId: string, territoryId: string) => void;
  onSelectAngle: (masterId: string, thoughtId: string, territoryId: string, angleId: string) => void;
  onSelectIdea: (masterId: string, thoughtId: string, territoryId: string, angleId: string, ideaId: string) => void;
  onSelectExecution?: (masterId: string, thoughtId: string, territoryId: string, angleId: string, ideaId: string, executionId: string) => void;
  onRequestEdit: (id: string) => void;
  onRequestDelete: (id: string) => void;
  territoryGenerateThoughtId?: string | null;
  territoryGeneratePending?: boolean;
  onGenerateTerritory?: (thoughtId: string) => void;
};

export function MasterThoughtMapTree({
  masters,
  selectedId,
  inspectedMasterId,
  inspectedThoughtId,
  inspectedTerritoryId,
  inspectedAngleId,
  inspectedIdeaId,
  inspectedExecutionId = null,
  childrenByMasterId,
  deleteDisabled,
  onSelect,
  onSelectChild,
  onSelectTerritory,
  onSelectAngle,
  onSelectIdea,
  onSelectExecution,
  onRequestEdit,
  onRequestDelete,
  territoryGenerateThoughtId = null,
  territoryGeneratePending = false,
  onGenerateTerritory,
}: MasterThoughtMapTreeProps) {
  const { t } = useAppTranslation();
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const movedRef = useRef(false);
  const centerRequest = useRef<string | null>(null);
  const centerOrigin = useRef<{
    nodeId: string;
    left: number;
    top: number;
    width: number;
    height: number;
    viewportLeft: number;
    viewportTop: number;
    viewportWidth: number;
    viewportHeight: number;
  } | null>(null);
  const pendingMove = useRef<{ x: number; y: number } | null>(null);
  const centerFrames = useRef<number[]>([]);
  const [view, setView] = useState(() => ({ ...DEFAULT_MAP_VIEW }));
  const viewRef = useRef(view);
  viewRef.current = view;
  const [centerTick, setCenterTick] = useState(0);
  const [measureNonce, setMeasureNonce] = useState(0);
  const [expanded, setExpanded] = useState<OpenBranches>(freshBranches);
  const selected = masters.find((row) => row.id === selectedId) ?? masters[0] ?? null;
  const visibleExecutionCount = (selected ? (childrenByMasterId.get(selected.id) ?? []) : []).reduce(
    (sum, child) =>
      sum +
      (child.territories ?? []).reduce(
        (territorySum, territory) =>
          territorySum +
          (territory.angles ?? []).reduce(
            (angleSum, angle) => angleSum + (angle.ideas ?? []).reduce((ideaSum, idea) => ideaSum + (idea.executions?.length ?? 0), 0),
            0,
          ),
        0,
      ),
    0,
  );

  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    setMeasureNonce((current) => current + 1);
  }, [selected?.id, masters.length, visibleExecutionCount]);

  const cancelCenterMotion = () => {
    pendingMove.current = null;
    for (const frame of centerFrames.current) cancelAnimationFrame(frame);
    centerFrames.current = [];
    if (canvasRef.current) canvasRef.current.style.transition = "none";
  };
  const cancelCenterMotionRef = useRef(cancelCenterMotion);
  cancelCenterMotionRef.current = cancelCenterMotion;

  useEffect(() => {
    cancelCenterMotionRef.current();
    setView({ ...DEFAULT_MAP_VIEW });
    setExpanded(freshBranches());
  }, [selected?.id]);

  const stopCentering = () => {
    cancelCenterMotion();
  };

  const centerNode = (nodeId: string) => {
    if (movedRef.current) return;
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    const node = canvas?.querySelector<HTMLElement>(mapNodeSelector(nodeId));
    if (viewport && node) {
      const box = node.getBoundingClientRect();
      const viewBox = viewport.getBoundingClientRect();
      centerOrigin.current = {
        nodeId,
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        viewportLeft: viewBox.left,
        viewportTop: viewBox.top,
        viewportWidth: viewBox.width,
        viewportHeight: viewBox.height,
      };
    } else {
      centerOrigin.current = null;
    }
    centerRequest.current = nodeId;
    setCenterTick((tick) => tick + 1);
  };

  useLayoutEffect(() => {
    const nodeId = centerRequest.current;
    if (!nodeId) return;
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    centerRequest.current = null;
    const origin = centerOrigin.current;
    centerOrigin.current = null;
    if (!viewport || !canvas) return;
    const node = canvas.querySelector<HTMLElement>(mapNodeSelector(nodeId));
    if (!node) return;

    for (const frame of centerFrames.current) cancelAnimationFrame(frame);
    centerFrames.current = [];
    canvas.style.transition = "none";
    const live = readMapTranslation(canvas);
    const after = node.getBoundingClientRect();
    const sameNode = origin?.nodeId === nodeId;
    const dx = sameNode && origin ? origin.left - after.left : 0;
    const dy = sameNode && origin ? origin.top - after.top : 0;
    const baseX = (live?.x ?? viewRef.current.x) + dx;
    const baseY = (live?.y ?? viewRef.current.y) + dy;
    const from = sameNode && origin
      ? { left: origin.left, top: origin.top, width: origin.width, height: origin.height }
      : { left: after.left + dx, top: after.top + dy, width: after.width, height: after.height };
    const viewBox = sameNode && origin
      ? {
          left: origin.viewportLeft,
          top: origin.viewportTop,
          width: origin.viewportWidth,
          height: origin.viewportHeight,
        }
      : viewport.getBoundingClientRect();
    const shift = panToCenter({ viewport: viewBox, node: from });
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const targetX = baseX + (shift?.x ?? 0);
    const targetY = baseY + (shift?.y ?? 0);
    if (Math.abs(baseX - viewRef.current.x) > 0.5 || Math.abs(baseY - viewRef.current.y) > 0.5) {
      setView((current) => ({ ...current, x: baseX, y: baseY }));
    }
    if (!shift || reduce) {
      pendingMove.current = null;
      if (reduce && shift) setView((current) => ({ ...current, x: targetX, y: targetY }));
      return;
    }
    pendingMove.current = { x: targetX, y: targetY };
  }, [centerTick]);

  useEffect(() => {
    const target = pendingMove.current;
    if (!target) return;
    pendingMove.current = null;
    let second = 0;
    const first = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.style.transition = "transform 450ms ease-in-out";
      second = requestAnimationFrame(() => {
        setView((current) => ({ ...current, x: target.x, y: target.y }));
      });
      centerFrames.current.push(second);
    });
    centerFrames.current.push(first);
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [centerTick]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      cancelCenterMotionRef.current();
      const canvas = canvasRef.current;
      const live = canvas ? readMapTranslation(canvas) : null;
      if (canvas) canvas.style.transition = "none";
      const box = viewport.getBoundingClientRect();
      const px = event.clientX - box.left;
      const py = event.clientY - box.top;
      setView((current) => {
        const x = live?.x ?? current.x;
        const y = live?.y ?? current.y;
        const scale = Math.min(2.5, Math.max(0.35, current.scale * (event.deltaY > 0 ? 0.9 : 1.1)));
        const ratio = scale / current.scale;
        return { scale, x: px - (px - x) * ratio, y: py - (py - y) * ratio };
      });
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [masters.length]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element) || event.target.closest("button, a, [role='menuitem']")) return;
    const live = canvasRef.current ? readMapTranslation(canvasRef.current) : null;
    stopCentering();
    const originX = live?.x ?? view.x;
    const originY = live?.y ?? view.y;
    if (live) setView((current) => ({ ...current, x: originX, y: originY }));
    dragRef.current = { x: event.clientX, y: event.clientY, originX, originY };
    movedRef.current = false;
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) <= 4) return;
    movedRef.current = true;
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setView((current) => ({ ...current, x: drag.originX + dx, y: drag.originY + dy }));
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  if (masters.length === 0) return null;

  const children = selected ? (childrenByMasterId.get(selected.id) ?? []) : [];
  const visibleChildren = expanded.master ? children : [];
  const links = selected
    ? [
        ...visibleChildren.map((child) => ({ from: `master:${selected.id}`, to: `bt:${child.id}` })),
        ...visibleChildren.flatMap((child) => {
          if (!expanded.thoughts.has(child.id)) return [];
          return (child.territories ?? []).flatMap((territory) => {
            const territoryLink = { from: `bt:${child.id}`, to: `tr:${territory.id}` };
            if (!expanded.territories.has(territory.id)) return [territoryLink];
            return [
              territoryLink,
              ...(territory.angles ?? []).flatMap((angle) => {
                const angleLink = { from: `tr:${territory.id}`, to: `an:${angle.id}` };
                if (!expanded.angles.has(angle.id)) return [angleLink];
                return [
                  angleLink,
                  ...(angle.ideas ?? []).flatMap((idea) => {
                    const ideaLink = { from: `an:${angle.id}`, to: `idea:${idea.id}` };
                    const executionLinks = (idea.executions ?? []).map((execution) => ({
                      from: `idea:${idea.id}`,
                      to: `ex:${execution.id}`,
                    }));
                    return [ideaLink, ...executionLinks];
                  }),
                ];
              }),
            ];
          });
        }),
      ]
    : [];
  const masterSelected =
    selected != null &&
    inspectedMasterId === selected.id &&
    inspectedThoughtId == null &&
    inspectedTerritoryId == null &&
    inspectedAngleId == null &&
    inspectedIdeaId == null &&
    inspectedExecutionId == null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={viewportRef}
        className="relative min-h-[16rem] flex-1 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(event) => {
          if (!movedRef.current) return;
          event.preventDefault();
          event.stopPropagation();
          movedRef.current = false;
        }}
      >
        <div
          ref={canvasRef}
          data-map-canvas=""
          className="relative w-max"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: "0 0" }}
        >
          <MapCurves canvasRef={canvasRef} links={links} layoutEpoch={`${measureNonce}|${view.x}|${view.y}|${view.scale}`} />
          {selected ? (
            <div className="flex items-center gap-14 py-2 pr-8">
              <div className="flex items-center">
                <Pill
                      nodeId={`master:${selected.id}`}
                      tone="master"
                      title={masterNodeTitle(selected)}
                      selected={masterSelected}
                      childCount={children.length}
                      accessory={
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5 text-white/90 hover:bg-white/10 hover:text-white"
                              disabled={deleteDisabled}
                              aria-label={t("thinkingLab.action.more", "More actions")}
                              onClick={(event) => event.stopPropagation()}
                              onPointerDown={(event) => event.stopPropagation()}
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="min-w-[9rem]">
                            <DropdownMenuItem
                              className="cursor-pointer gap-2"
                              disabled={selected.mtStatus === "locked"}
                              onSelect={() => {
                                window.setTimeout(() => onRequestEdit(selected.id), 0);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              {t("thinkingLab.action.edit", "Edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                              disabled={deleteDisabled}
                              onSelect={() => {
                                window.setTimeout(() => onRequestDelete(selected.id), 0);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {t("thinkingLab.action.delete", "Delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      }
                      onClick={() => {
                        setExpanded((current) => {
                          if (!masterSelected || !current.master) return { ...current, master: true };
                          return { master: false, thoughts: new Set(), territories: new Set(), angles: new Set() };
                        });
                        centerNode(`master:${selected.id}`);
                        if (!masterSelected) startTransition(() => onSelect(selected.id));
                      }}
                    />
            </div>
                  {expanded.master && children.length > 0 ? (
                    <EqualBranch
                      levelLabel={t("thinkingLab.tree.bigThought", "Big Thought")}
                      codes={children.map((child) => child.code)}
                      labels={children.map((child) => pillTitle(child.label, child.statement))}
                      rows={children.map((child) => {
                        const title = pillTitle(child.label, child.statement);
                        const territoriesOpen = expanded.thoughts.has(child.id) && (child.territories?.length ?? 0) > 0;
                        return {
                          key: child.id,
                          pill: (
                            <Pill
                              nodeId={`bt:${child.id}`}
                              tone="bigThought"
                              stretch
                              code={child.code}
                              title={title}
                              fullTitle={child.statement.trim() !== title.trim() ? child.statement : undefined}
                              selected={inspectedThoughtId === child.id}
                              childCount={child.childCount}
                              accessory={
                                territoryGenerateThoughtId === child.id && onGenerateTerritory ? (
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-5 w-5 text-white/90 hover:bg-white/10 hover:text-white"
                                    disabled={territoryGeneratePending}
                                    aria-busy={territoryGeneratePending}
                                    aria-label={t("thinkingLab.territory.generate", "Generate Territory")}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onGenerateTerritory(child.id);
                                    }}
                                    onPointerDown={(event) => event.stopPropagation()}
                                  >
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                ) : null
                              }
                              onClick={() => {
                                const already = inspectedThoughtId === child.id;
                                setExpanded((current) => {
                                  if (!already || !current.thoughts.has(child.id)) {
                                    return { ...current, thoughts: withId(current.thoughts, child.id, true) };
                                  }
                                  const territories = new Set(current.territories);
                                  const angles = new Set(current.angles);
                                  for (const territory of child.territories ?? []) {
                                    territories.delete(territory.id);
                                    for (const angle of territory.angles ?? []) angles.delete(angle.id);
                                  }
                                  return {
                                    ...current,
                                    thoughts: withId(current.thoughts, child.id, false),
                                    territories,
                                    angles,
                                  };
                                });
                                centerNode(`bt:${child.id}`);
                                if (!already) startTransition(() => onSelectChild(selected.id, child.id));
                              }}
                            />
                          ),
                          branch: territoriesOpen ? (
                            <EqualBranch
                              levelLabel={t("thinkingLab.tree.territory", "Territory")}
                              accent
                              codes={(child.territories ?? []).map((territory) => territory.code)}
                              labels={(child.territories ?? []).map((territory) => territory.statement.trim())}
                              rows={(child.territories ?? []).map((territory) => {
                                const anglesOpen =
                                  expanded.territories.has(territory.id) && (territory.angles?.length ?? 0) > 0;
                                return {
                                  key: territory.id,
                                  pill: (
                                    <Pill
                                      nodeId={`tr:${territory.id}`}
                                      tone="territory"
                                      stretch
                                      code={territory.code}
                                      title={territory.statement}
                                      selected={inspectedTerritoryId === territory.id}
                                      childCount={territory.childCount}
                                      onClick={() => {
                                        const already = inspectedTerritoryId === territory.id;
                                        setExpanded((current) => {
                                          if (!already || !current.territories.has(territory.id)) {
                                            return { ...current, territories: withId(current.territories, territory.id, true) };
                                          }
                                          const angles = new Set(current.angles);
                                          for (const angle of territory.angles ?? []) angles.delete(angle.id);
                                          return {
                                            ...current,
                                            territories: withId(current.territories, territory.id, false),
                                            angles,
                                          };
                                        });
                                        centerNode(`tr:${territory.id}`);
                                        if (!already) startTransition(() => onSelectTerritory(selected.id, child.id, territory.id));
                                      }}
                                    />
                                  ),
                                  branch: anglesOpen ? (
                                    <EqualBranch
                                      levelLabel={t("thinkingLab.tree.angle", "Angle")}
                                      accent
                                      codes={(territory.angles ?? []).map((angle) => angle.code)}
                                      labels={(territory.angles ?? []).map((angle) =>
                                        angleListSubject(angle.subject ?? "", territory.statement),
                                      )}
                                      rows={(territory.angles ?? []).map((angle) => {
                                        const angleTitle = angleListSubject(angle.subject ?? "", territory.statement);
                                        const ideasOpen = expanded.angles.has(angle.id) && (angle.ideas?.length ?? 0) > 0;
                                        return {
                                          key: angle.id,
                                          pill: (
                                            <Pill
                                              nodeId={`an:${angle.id}`}
                                              tone="angle"
                                              stretch
                                              code={angle.code}
                                              title={angleTitle}
                                              fullTitle={angle.statement}
                                              selected={inspectedAngleId === angle.id}
                                              childCount={angle.childCount}
                                              onClick={() => {
                                                const already = inspectedAngleId === angle.id;
                                                setExpanded((current) => {
                                                  if (!already || !current.angles.has(angle.id)) {
                                                    return { ...current, angles: withId(current.angles, angle.id, true) };
                                                  }
                                                  return { ...current, angles: withId(current.angles, angle.id, false) };
                                                });
                                                centerNode(`an:${angle.id}`);
                                                if (!already) startTransition(() => onSelectAngle(selected.id, child.id, territory.id, angle.id));
                                              }}
                                            />
                                          ),
                                          branch: ideasOpen ? (
                                            <EqualBranch
                                              levelLabel={t("thinkingLab.idea.list", "Idea")}
                                              accent
                                              codes={(angle.ideas ?? []).map((idea) => idea.code)}
                                              star={(angle.ideas ?? []).some((idea) => idea.recommended)}
                                              labels={(angle.ideas ?? []).map((idea) => ideaLabel(idea.statement, idea.subject))}
                                              rows={(angle.ideas ?? []).map((idea) => ({
                                                key: idea.id,
                                                pill: (
                                                  <Pill
                                                    nodeId={`idea:${idea.id}`}
                                                    tone="idea"
                                                    stretch
                                                    code={idea.code}
                                                    title={ideaLabel(idea.statement, idea.subject)}
                                                    fullTitle={idea.statement}
                                                    selected={inspectedIdeaId === idea.id}
                                                    recommended={idea.recommended}
                                                    onClick={() => {
                                                      centerNode(`idea:${idea.id}`);
                                                      startTransition(() =>
                                                        onSelectIdea(selected.id, child.id, territory.id, angle.id, idea.id),
                                                      );
                                                    }}
                                                  />
                                                ),
                                                branch:
                                                  (idea.executions?.length ?? 0) > 0 ? (
                                                    <EqualBranch
                                                      levelLabel={t("thinkingLab.execution.label", "Execution")}
                                                      accent
                                                      labels={(idea.executions ?? []).map((execution) => execution.label)}
                                                      rows={(idea.executions ?? []).map((execution) => ({
                                                        key: execution.id,
                                                        pill: (
                                                          <Pill
                                                            nodeId={`ex:${execution.id}`}
                                                            tone="execution"
                                                            stretch
                                                            title={execution.label}
                                                            selected={inspectedExecutionId === execution.id}
                                                            warning={!execution.passed}
                                                            onClick={() => {
                                                              centerNode(`ex:${execution.id}`);
                                                              startTransition(() =>
                                                                onSelectExecution?.(
                                                                  selected.id,
                                                                  child.id,
                                                                  territory.id,
                                                                  angle.id,
                                                                  idea.id,
                                                                  execution.id,
                                                                ),
                                                              );
                                                            }}
                                                          />
                                                        ),
                                                      }))}
                                                    />
                                                  ) : undefined,
                                              }))}
                                            />
                                          ) : undefined,
                                        };
                                      })}
                                    />
                                  ) : undefined,
                                };
                              })}
                            />
                          ) : undefined,
                        };
                      })}
                    />
                  ) : null}
            </div>
                    ) : null}
        </div>
      </div>
    </div>
  );
}
