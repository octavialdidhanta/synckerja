import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Pencil, Star, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { angleNodeSubject } from "@/thinking-lab/angle/subject";
import type { LabMasterThought } from "@/thinking-lab/master-thought/types";

export type MasterMapIdea = {
  id: string;
  code: string;
  statement: string;
  recommended?: boolean;
};

export type MasterMapAngle = {
  id: string;
  code: string;
  statement: string;
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

type PillTone = "master" | "bigThought" | "territory" | "angle" | "idea";

const SOLID: Record<"master" | "bigThought", string> = {
  master: "border border-[#16365c] bg-[#1b3a6b] text-white",
  bigThought: "border-2 border-[#3d6cb5] bg-[#3d6cb5] text-white",
};

const ACCENT: Record<"territory" | "angle" | "idea", string> = {
  territory: "border border-[#c9a24a] bg-[#3a342c] text-white",
  angle: "border border-amber-700/80 bg-[#3a342c] text-white",
  idea: "border border-rose-400/80 bg-[#3a342c] text-white",
};

const ACCENT_BAR: Record<"territory" | "angle" | "idea", string> = {
  territory: "bg-[#e8b84a]",
  angle: "bg-amber-500",
  idea: "bg-rose-400",
};

function masterNodeTitle(row: { canonicalSemantic: { subject: string | null } | null; statement: string; originalInput: string }): string {
  return (row.canonicalSemantic?.subject || row.statement || row.originalInput || "").trim();
}

function pillTitle(label: string | undefined, statement: string): string {
  const short = label?.trim();
  return short || statement.trim();
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

function curve(x1: number, y1: number, x2: number, y2: number): string {
  const mid = x1 + (x2 - x1) * 0.55;
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
}

export function settleCurves(current: string[], measured: string[], unmeasured: number): string[] {
  if (unmeasured > 0 && measured.length === 0) return current;
  return measured;
}

type OpenBranches = {
  master: boolean;
  thoughts: ReadonlySet<string>;
  territories: ReadonlySet<string>;
  angles: ReadonlySet<string>;
};

function freshBranches(): OpenBranches {
  return { master: true, thoughts: new Set(), territories: new Set(), angles: new Set() };
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
  const [paths, setPaths] = useState<string[]>([]);
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
        return [curve(from.right, from.midY, to.left, to.midY)];
      });
      setPaths((current) => {
        const next = settleCurves(current, measured, unmeasured);
        return current.length === next.length && current.every((path, index) => path === next[index]) ? current : next;
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
        <path key={path} d={path} fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

function Pill({
  nodeId,
  tone,
  title,
  fullTitle,
  selected,
  childCount,
  recommended,
  onClick,
}: {
  nodeId: string;
  tone: PillTone;
  title: string;
  fullTitle?: string;
  selected: boolean;
  childCount?: number;
  recommended?: boolean;
  onClick: () => void;
}) {
  const { t } = useAppTranslation();
  const count = childCount ?? 0;
  const solid = tone === "master" || tone === "bigThought";
  return (
    <div className="relative" data-map-node={nodeId}>
      <button
        type="button"
        onClick={onClick}
        title={fullTitle && fullTitle.trim() !== title.trim() ? fullTitle.trim() : undefined}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "inline-flex w-max items-center whitespace-nowrap rounded-[4px] px-2.5 py-1.5 text-left text-xs font-medium leading-none",
          solid ? SOLID[tone] : cn("gap-2 pl-1.5", ACCENT[tone]),
          tone === "bigThought" && selected && "border-[#16365c] bg-[#1e4a86]",
          tone === "territory" && selected && "border-[#f0c14b]",
          !solid && selected && tone !== "territory" && "ring-2 ring-[#16365c]",
        )}
      >
        {solid ? null : <span className={cn("h-4 w-1 shrink-0 rounded-[1px]", ACCENT_BAR[tone])} aria-hidden />}
        <span>{title}</span>
        {recommended ? (
          <Star
            className="ml-1 inline h-3 w-3 fill-current"
            aria-label={t("thinkingLab.idea.recommended", "Recommended to start")}
          />
        ) : null}
      </button>
      {count > 0 ? (
        <span
          className="absolute -right-2.5 top-1/2 flex h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white px-1 text-[10px] font-semibold text-slate-600 shadow-sm"
          aria-label={t("thinkingLab.tree.childCount", "{{count}} below", { count })}
        >
          +{count}
        </span>
      ) : null}
    </div>
  );
}

function ZoomControls({
  view,
  onZoom,
  onReset,
}: {
  view: { scale: number };
  onZoom: (factor: number) => void;
  onReset: () => void;
}) {
  const { t } = useAppTranslation();
  return (
    <div data-map-controls className="flex items-center gap-1 rounded-md border border-border bg-background p-1">
      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={t("thinkingLab.tree.zoomOut", "Zoom out")} onClick={() => onZoom(0.9)}>
        <ZoomOut className="h-3.5 w-3.5" />
      </Button>
      <button
        type="button"
        className="min-w-10 px-1 text-xs text-muted-foreground"
        aria-label={t("thinkingLab.tree.zoomReset", "Reset view")}
        onClick={onReset}
      >
        {Math.round(view.scale * 100)}%
      </button>
      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={t("thinkingLab.tree.zoomIn", "Zoom in")} onClick={() => onZoom(1.1)}>
        <ZoomIn className="h-3.5 w-3.5" />
      </Button>
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
  childrenByMasterId: ReadonlyMap<string, MasterMapChild[]>;
  deleteDisabled?: boolean;
  onSelect: (id: string) => void;
  onSelectChild: (masterId: string, thoughtId: string) => void;
  onSelectTerritory: (masterId: string, thoughtId: string, territoryId: string) => void;
  onSelectAngle: (masterId: string, thoughtId: string, territoryId: string, angleId: string) => void;
  onSelectIdea: (masterId: string, thoughtId: string, territoryId: string, angleId: string, ideaId: string) => void;
  onRequestEdit: (id: string) => void;
  onRequestDelete: (id: string) => void;
  territoryGenerateThoughtId?: string | null;
  territoryGeneratePending?: boolean;
  onGenerateTerritory?: (thoughtId: string) => void;
  zoomHost?: HTMLElement | null;
};

export function MasterThoughtMapTree({
  masters,
  selectedId,
  inspectedMasterId,
  inspectedThoughtId,
  inspectedTerritoryId,
  inspectedAngleId,
  inspectedIdeaId,
  childrenByMasterId,
  deleteDisabled,
  onSelect,
  onSelectChild,
  onSelectTerritory,
  onSelectAngle,
  onSelectIdea,
  onRequestEdit,
  onRequestDelete,
  territoryGenerateThoughtId = null,
  territoryGeneratePending = false,
  onGenerateTerritory,
  zoomHost,
}: MasterThoughtMapTreeProps) {
  const { t } = useAppTranslation();
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const movedRef = useRef(false);
  const [view, setView] = useState({ x: 12, y: 12, scale: 1 });
  const [measureNonce, setMeasureNonce] = useState(0);
  const [expanded, setExpanded] = useState<OpenBranches>(freshBranches);
  const selected = masters.find((row) => row.id === selectedId) ?? masters[0] ?? null;
  const others = masters.filter((row) => row.id !== selected?.id);

  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    setMeasureNonce((current) => current + 1);
  }, [selected?.id, masters.length]);

  useEffect(() => {
    setView({ x: 12, y: 12, scale: 1 });
    setExpanded(freshBranches());
  }, [selected?.id]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = viewport.getBoundingClientRect();
      const px = event.clientX - box.left;
      const py = event.clientY - box.top;
      setView((current) => {
        const scale = Math.min(2.5, Math.max(0.35, current.scale * (event.deltaY > 0 ? 0.9 : 1.1)));
        const ratio = scale / current.scale;
        return { scale, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio };
      });
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [masters.length]);

  const zoomBy = (factor: number) => {
    const viewport = viewportRef.current;
    setView((current) => {
      const scale = Math.min(2.5, Math.max(0.35, current.scale * factor));
      if (!viewport) return { ...current, scale };
      const px = viewport.clientWidth / 2;
      const py = viewport.clientHeight / 2;
      const ratio = scale / current.scale;
      return { scale, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio };
    });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element) || event.target.closest("[data-map-controls], button, a, [role='menuitem']")) return;
    dragRef.current = { x: event.clientX, y: event.clientY, originX: view.x, originY: view.y };
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
                  ...(angle.ideas ?? []).map((idea) => ({ from: `an:${angle.id}`, to: `idea:${idea.id}` })),
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
    inspectedIdeaId == null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {others.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1">
          {others.map((row) => (
              <button
              key={row.id}
                type="button"
                onClick={() => onSelect(row.id)}
              className="max-w-[12rem] truncate rounded-full border border-border bg-background px-2 py-1 text-xs text-foreground"
              >
              {masterNodeTitle(row)}
              </button>
          ))}
        </div>
      ) : null}
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
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                            className="h-6 w-6 shrink-0"
                    disabled={deleteDisabled}
                    aria-label={t("thinkingLab.action.more", "More actions")}
                    onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[9rem]">
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
                <Pill
                      nodeId={`master:${selected.id}`}
                      tone="master"
                      title={masterNodeTitle(selected)}
                      selected={masterSelected}
                      onClick={() => {
                        if (!masterSelected) {
                          onSelect(selected.id);
                          return;
                        }
                        setExpanded((current) =>
                          current.master
                            ? { master: false, thoughts: new Set(), territories: new Set(), angles: new Set() }
                            : { ...current, master: true },
                        );
                      }}
                    />
            </div>
                  {expanded.master && children.length > 0 ? (
                    <div className="flex flex-col justify-center gap-3">
                {children.map((child) => (
                        <div key={child.id} className="flex items-center gap-14">
                          <div className="relative">
                          {territoryGenerateThoughtId === child.id && onGenerateTerritory ? (
                            <Button
                      type="button"
                              size="icon"
                              variant="ghost"
                              className="absolute right-full top-1/2 mr-0.5 h-5 w-5 -translate-y-1/2"
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
                          ) : null}
                          <Pill
                            nodeId={`bt:${child.id}`}
                            tone="bigThought"
                            title={pillTitle(child.label, child.statement)}
                            selected={inspectedThoughtId === child.id}
                            childCount={child.childCount}
                            onClick={() => {
                              if (inspectedThoughtId !== child.id) {
                                onSelectChild(selected.id, child.id);
                                return;
                              }
                              setExpanded((current) => {
                                if (!current.thoughts.has(child.id)) {
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
                            }}
                          />
                          </div>
                          {expanded.thoughts.has(child.id) && child.territories && child.territories.length > 0 ? (
                            <div className="flex flex-col justify-center gap-3">
                        {child.territories.map((territory) => (
                                <div key={territory.id} className="flex items-center gap-14">
                                  <Pill
                                    nodeId={`tr:${territory.id}`}
                                    tone="territory"
                                    title={territory.statement}
                                    selected={inspectedTerritoryId === territory.id}
                                    childCount={territory.childCount}
                                    onClick={() => {
                                      if (inspectedTerritoryId !== territory.id) {
                                        onSelectTerritory(selected.id, child.id, territory.id);
                                        return;
                                      }
                                      setExpanded((current) => {
                                        if (!current.territories.has(territory.id)) {
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
                                    }}
                                  />
                                  {expanded.territories.has(territory.id) && territory.angles && territory.angles.length > 0 ? (
                                    <div className="flex flex-col justify-center gap-3">
                                {territory.angles.map((angle) => (
                                        <div key={angle.id} className="flex items-center gap-14">
                                          <Pill
                                            nodeId={`an:${angle.id}`}
                                            tone="angle"
                                            title={angleNodeSubject(angle.statement, territory.statement)}
                                            fullTitle={angle.statement}
                                            selected={inspectedAngleId === angle.id}
                                            childCount={angle.childCount}
                                            onClick={() => {
                                              if (inspectedAngleId !== angle.id) {
                                                onSelectAngle(selected.id, child.id, territory.id, angle.id);
                                                return;
                                              }
                                              setExpanded((current) => ({
                                                ...current,
                                                angles: withId(current.angles, angle.id, !current.angles.has(angle.id)),
                                              }));
                                            }}
                                          />
                                          {expanded.angles.has(angle.id) && angle.ideas && angle.ideas.length > 0 ? (
                                            <div className="flex flex-col justify-center gap-3">
                                          {angle.ideas.map((idea) => (
                                                <Pill
                                                  key={idea.id}
                                                  nodeId={`idea:${idea.id}`}
                                                  tone="idea"
                                                  title={idea.statement}
                                                  selected={inspectedIdeaId === idea.id}
                                                  recommended={idea.recommended}
                                                  onClick={() =>
                                                    onSelectIdea(selected.id, child.id, territory.id, angle.id, idea.id)
                                                  }
                                                />
                                              ))}
                                            </div>
                                      ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                                ))}
                            </div>
                            ) : null}
                        </div>
                        ))}
                    </div>
                  ) : null}
            </div>
                    ) : null}
        </div>
        {zoomHost ? (
          createPortal(
            <ZoomControls view={view} onZoom={zoomBy} onReset={() => setView({ x: 12, y: 12, scale: 1 })} />,
            zoomHost,
          )
        ) : zoomHost === undefined ? (
          <div className="absolute right-2 top-2">
            <ZoomControls view={view} onZoom={zoomBy} onReset={() => setView({ x: 12, y: 12, scale: 1 })} />
          </div>
            ) : null}
      </div>
    </div>
  );
}
