import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
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
import { panToCenter } from "@/thinking-lab/section/map/mapGeometry";
import type {
  MasterMapAngle,
  MasterMapChild,
  MasterMapExecution,
  MasterMapIdea,
  MasterMapPillar,
  MasterMapTerritory,
} from "@/thinking-lab/section/map/mapTypes";
import { EqualBranch, MapCurves, longestLabel } from "@/thinking-lab/section/map/MapBranch";
import { Pill } from "@/thinking-lab/section/map/MapNodePill";

export type {
  MasterMapAngle,
  MasterMapChild,
  MasterMapExecution,
  MasterMapIdea,
  MasterMapPillar,
  MasterMapTerritory,
} from "@/thinking-lab/section/map/mapTypes";
export { mapLinkPath, panToCenter, settleCurves, type MapCurve } from "@/thinking-lab/section/map/mapGeometry";

function masterNodeTitle(row: { canonicalSemantic: { subject: string | null } | null; statement: string; originalInput: string }): string {
  return (row.canonicalSemantic?.subject || row.statement || row.originalInput || "").trim();
}

function pillTitle(label: string | undefined, statement: string): string {
  const short = label?.trim();
  return short || statement.trim();
}

const DEFAULT_MAP_VIEW = { x: 12, y: 12, scale: 1 };

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
  ideas: ReadonlySet<string>;
};

function freshBranches(): OpenBranches {
  return { master: false, thoughts: new Set(), territories: new Set(), angles: new Set(), ideas: new Set() };
}

function withId(ids: ReadonlySet<string>, id: string, open: boolean): Set<string> {
  const next = new Set(ids);
  if (open) next.add(id);
  else next.delete(id);
  return next;
}

type MasterThoughtMapTreeProps = {
  masters: LabMasterThought[];
  selectedId: string | null;
  inspectedMasterId: string | null;
  inspectedThoughtId: string | null;
  inspectedTerritoryId: string | null;
  inspectedAngleId: string | null;
  inspectedIdeaId: string | null;
  inspectedPillarId?: string | null;
  inspectedExecutionId?: string | null;
  childrenByMasterId: ReadonlyMap<string, MasterMapChild[]>;
  deleteDisabled?: boolean;
  onSelect: (id: string) => void;
  onSelectChild: (masterId: string, thoughtId: string) => void;
  onSelectTerritory: (masterId: string, thoughtId: string, territoryId: string) => void;
  onSelectAngle: (masterId: string, thoughtId: string, territoryId: string, angleId: string) => void;
  onSelectIdea: (masterId: string, thoughtId: string, territoryId: string, angleId: string, ideaId: string) => void;
  onSelectPillar?: (masterId: string, thoughtId: string, territoryId: string, angleId: string, ideaId: string, contentPillarId: string) => void;
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
  inspectedPillarId = null,
  inspectedExecutionId = null,
  childrenByMasterId,
  deleteDisabled,
  onSelect,
  onSelectChild,
  onSelectTerritory,
  onSelectAngle,
  onSelectIdea,
  onSelectPillar,
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
            (angleSum, angle) =>
              angleSum +
              (angle.ideas ?? []).reduce(
                (ideaSum, idea) =>
                  ideaSum +
                  (idea.executions?.length ?? 0) +
                  (idea.pillars ?? []).reduce((pillarSum, pillar) => pillarSum + 1 + (pillar.executions?.length ?? 0), 0),
                0,
              ),
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
  const nodeWidth = longestLabel(
    children.flatMap((child) => [
      pillTitle(child.label, child.statement),
      `${t("thinkingLab.tree.bigThought", "Big Thought")} - ${child.code}`,
      ...(child.territories ?? []).flatMap((territory) => [
        territory.statement.trim(),
        `${t("thinkingLab.tree.territory", "Territory")} - ${territory.code}`,
        ...(territory.angles ?? []).flatMap((angle) => [
          angleListSubject(angle.subject ?? "", territory.statement),
          `${t("thinkingLab.tree.angle", "Angle")} - ${angle.code}`,
          ...(angle.ideas ?? []).flatMap((idea) => [
            ideaLabel(idea.statement, idea.subject),
            `${t("thinkingLab.idea.list", "Idea")} - ${idea.code}`,
            ...(idea.pillars ?? []).flatMap((pillar) => [
              pillar.label,
              ...(pillar.leadMagnet
                ? [`${t("thinkingLab.tree.pillar", "Pillar")} - ${t("thinkingLab.tree.leadMagnet", "Lead Magnet")}`]
                : []),
              ...((pillar.executions ?? []).some((execution) => execution.leadMagnet) || (pillar.leadMagnet && (pillar.executions?.length ?? 0) > 0)
                ? [`${t("thinkingLab.execution.label", "Execution")} - ${t("thinkingLab.tree.leadMagnet", "Lead Magnet")}`]
                : []),
            ]),
          ]),
        ]),
      ]),
    ]),
  );
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
                    if (!expanded.ideas.has(idea.id)) return [ideaLink];
                    const pillarLinks = (idea.pillars ?? []).flatMap((pillar) => [
                      { from: `idea:${idea.id}`, to: `pl:${idea.id}:${pillar.id}` },
                      ...(pillar.executions ?? []).map((execution) => ({
                        from: `pl:${idea.id}:${pillar.id}`,
                        to: `ex:${execution.id}`,
                      })),
                    ]);
                    const executionLinks = (idea.executions ?? []).map((execution) => ({
                      from: `idea:${idea.id}`,
                      to: `ex:${execution.id}`,
                    }));
                    return [ideaLink, ...pillarLinks, ...executionLinks];
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
    inspectedPillarId == null &&
    inspectedExecutionId == null;

  const expandAllBranches = (): OpenBranches => {
    const thoughts = new Set<string>();
    const territories = new Set<string>();
    const angles = new Set<string>();
    const ideas = new Set<string>();
    for (const child of children) {
      if ((child.territories?.length ?? 0) === 0 && (child.childCount ?? 0) === 0) continue;
      thoughts.add(child.id);
      for (const territory of child.territories ?? []) {
        if ((territory.angles?.length ?? 0) === 0 && (territory.childCount ?? 0) === 0) continue;
        territories.add(territory.id);
        for (const angle of territory.angles ?? []) {
          if ((angle.ideas?.length ?? 0) === 0 && (angle.childCount ?? 0) === 0) continue;
          angles.add(angle.id);
          for (const idea of angle.ideas ?? []) {
            const below =
              (idea.pillars?.length ?? 0) > 0 || (idea.executions?.length ?? 0) > 0 || (idea.childCount ?? 0) > 0;
            if (below) ideas.add(idea.id);
          }
        }
      }
    }
    return { master: true, thoughts, territories, angles, ideas };
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {selected ? (
        <div className="absolute right-2 top-2 z-20 flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 rounded-md bg-background/95 px-2 text-xs shadow-sm"
            disabled={children.length === 0}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              stopCentering();
              setExpanded(expandAllBranches());
            }}
          >
            {t("thinkingLab.tree.expandAll", "Expand all")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 rounded-md bg-background/95 px-2 text-xs shadow-sm"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              stopCentering();
              setExpanded(freshBranches());
            }}
          >
            {t("thinkingLab.tree.collapseAll", "Collapse all")}
          </Button>
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
                          return freshBranches();
                        });
                        centerNode(`master:${selected.id}`);
                        if (!masterSelected) onSelect(selected.id);
                      }}
                    />
            </div>
                  {expanded.master && children.length > 0 ? (
                    <EqualBranch
                      levelLabel={t("thinkingLab.tree.bigThought", "Big Thought")}
                      widthLabel={nodeWidth}
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
                                  const ideas = new Set(current.ideas);
                                  for (const territory of child.territories ?? []) {
                                    territories.delete(territory.id);
                                    for (const angle of territory.angles ?? []) {
                                      angles.delete(angle.id);
                                      for (const idea of angle.ideas ?? []) ideas.delete(idea.id);
                                    }
                                  }
                                  return {
                                    ...current,
                                    thoughts: withId(current.thoughts, child.id, false),
                                    territories,
                                    angles,
                                    ideas,
                                  };
                                });
                                centerNode(`bt:${child.id}`);
                                if (!already) onSelectChild(selected.id, child.id);
                              }}
                            />
                          ),
                          branch: territoriesOpen ? (
                            <EqualBranch
                              levelLabel={t("thinkingLab.tree.territory", "Territory")}
                              accent
                              widthLabel={nodeWidth}
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
                                          const ideas = new Set(current.ideas);
                                          for (const angle of territory.angles ?? []) {
                                            angles.delete(angle.id);
                                            for (const idea of angle.ideas ?? []) ideas.delete(idea.id);
                                          }
                                          return {
                                            ...current,
                                            territories: withId(current.territories, territory.id, false),
                                            angles,
                                            ideas,
                                          };
                                        });
                                        centerNode(`tr:${territory.id}`);
                                        if (!already) onSelectTerritory(selected.id, child.id, territory.id);
                                      }}
                                    />
                                  ),
                                  branch: anglesOpen ? (
                                    <EqualBranch
                                      levelLabel={t("thinkingLab.tree.angle", "Angle")}
                                      accent
                                      widthLabel={nodeWidth}
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
                                                  const ideas = new Set(current.ideas);
                                                  for (const idea of angle.ideas ?? []) ideas.delete(idea.id);
                                                  return {
                                                    ...current,
                                                    angles: withId(current.angles, angle.id, false),
                                                    ideas,
                                                  };
                                                });
                                                centerNode(`an:${angle.id}`);
                                                if (!already) onSelectAngle(selected.id, child.id, territory.id, angle.id);
                                              }}
                                            />
                                          ),
                                          branch: ideasOpen ? (
                                            <EqualBranch
                                              levelLabel={t("thinkingLab.idea.list", "Idea")}
                                              accent
                                              widthLabel={nodeWidth}
                                              codes={(angle.ideas ?? []).map((idea) => idea.code)}
                                              star={(angle.ideas ?? []).some((idea) => idea.recommended)}
                                              labels={(angle.ideas ?? []).map((idea) => ideaLabel(idea.statement, idea.subject))}
                                              rows={(angle.ideas ?? []).map((idea) => {
                                                const executionBranch = (rows: MasterMapExecution[]) =>
                                                  rows.length > 0 ? (
                                                    <EqualBranch
                                                      levelLabel={t("thinkingLab.execution.label", "Execution")}
                                                      accent
                                                      widthLabel={nodeWidth}
                                                      labels={[nodeWidth]}
                                                      rows={rows.map((execution) => ({
                                                        key: execution.id,
                                                        pill: (
                                                          <Pill
                                                            nodeId={`ex:${execution.id}`}
                                                            tone="execution"
                                                            stretch
                                                            truncateTitle
                                                            mark={execution.leadMagnet ? t("thinkingLab.tree.leadMagnet", "Lead Magnet") : undefined}
                                                            title={execution.label}
                                                            fullTitle={execution.label}
                                                            selected={inspectedExecutionId === execution.id}
                                                            warning={!execution.passed}
                                                            onClick={() => {
                                                              centerNode(`ex:${execution.id}`);
                                                              onSelectExecution?.(
                                                                selected.id,
                                                                child.id,
                                                                territory.id,
                                                                angle.id,
                                                                idea.id,
                                                                execution.id,
                                                              );
                                                            }}
                                                          />
                                                        ),
                                                      }))}
                                                    />
                                                  ) : null;
                                                const pillars = idea.pillars ?? [];
                                                const belowOpen =
                                                  expanded.ideas.has(idea.id) ||
                                                  inspectedIdeaId === idea.id ||
                                                  (idea.pillars ?? []).some((pillar) => pillar.id === inspectedPillarId) ||
                                                  (idea.executions ?? []).some((execution) => execution.id === inspectedExecutionId) ||
                                                  (idea.pillars ?? []).some((pillar) =>
                                                    (pillar.executions ?? []).some((execution) => execution.id === inspectedExecutionId),
                                                  );
                                                const pillarBranch =
                                                  belowOpen && pillars.length > 0 ? (
                                                    <EqualBranch
                                                      levelLabel={t("thinkingLab.tree.pillar", "Pillar")}
                                                      accent
                                                      widthLabel={nodeWidth}
                                                      labels={pillars.map((pillar) => pillar.label)}
                                                      rows={pillars.map((pillar) => ({
                                                        key: pillar.id,
                                                        pill: (
                                                          <Pill
                                                            nodeId={`pl:${idea.id}:${pillar.id}`}
                                                            tone="pillar"
                                                            stretch
                                                            mark={pillar.leadMagnet ? t("thinkingLab.tree.leadMagnet", "Lead Magnet") : undefined}
                                                            title={pillar.label}
                                                            selected={inspectedPillarId === pillar.id}
                                                            childCount={pillar.executions?.length ?? 0}
                                                            onClick={() => {
                                                              centerNode(`pl:${idea.id}:${pillar.id}`);
                                                              onSelectPillar?.(
                                                                selected.id,
                                                                child.id,
                                                                territory.id,
                                                                angle.id,
                                                                idea.id,
                                                                pillar.id,
                                                              );
                                                            }}
                                                          />
                                                        ),
                                                        branch: executionBranch(pillar.executions ?? []) ?? undefined,
                                                      }))}
                                                    />
                                                  ) : null;
                                                const looseExecutions = belowOpen ? executionBranch(idea.executions ?? []) : null;
                                                return {
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
                                                      childCount={Math.max(idea.childCount ?? 0, pillars.length, idea.executions?.length ?? 0)}
                                                      onClick={() => {
                                                        const already = inspectedIdeaId === idea.id;
                                                        setExpanded((current) => {
                                                          if (!already || !current.ideas.has(idea.id)) {
                                                            return { ...current, ideas: withId(current.ideas, idea.id, true) };
                                                          }
                                                          return { ...current, ideas: withId(current.ideas, idea.id, false) };
                                                        });
                                                        centerNode(`idea:${idea.id}`);
                                                        if (!already) onSelectIdea(selected.id, child.id, territory.id, angle.id, idea.id);
                                                      }}
                                                    />
                                                  ),
                                                  branch:
                                                    pillarBranch || looseExecutions ? (
                                                      <div className="flex flex-col gap-3">
                                                        {pillarBranch}
                                                        {looseExecutions}
                                                      </div>
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
