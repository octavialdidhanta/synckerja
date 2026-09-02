import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useToast } from "@/shared/components/ui/use-toast";
import type { PosTable } from "../../lib/posTableTypes";
import type { PosFloorFixture } from "../../fixtures/lib/posFloorFixtureTypes";
import { TableMapFixtureNode } from "../../fixtures/components/TableMapFixtureNode";
import { axisAlignedBox, axisAlignedFootprint } from "../../lib/tableRotation";
import {
  TABLE_MAP_CELL_PX,
  TABLE_MAP_MIN_COLS,
  TABLE_MAP_MIN_ROWS,
  boxesOverlap,
} from "../../lib/tableShapeLayout";
import { TableMapTableNode } from "./TableMapTableNode";

export type MapSelectionKind = "table" | "fixture";

type Props = {
  tables: PosTable[];
  fixtures: PosFloorFixture[];
  selectedId: string | null;
  selectedKind: MapSelectionKind | null;
  dialogOpen?: boolean;
  onSelectTable: (table: PosTable) => void;
  onSelectFixture: (fixture: PosFloorFixture) => void;
  onEditTable: (table: PosTable) => void;
  onEditFixture: (fixture: PosFloorFixture) => void;
  onMoveTable: (id: string, grid_x: number, grid_y: number) => void;
  onMoveFixture: (id: string, grid_x: number, grid_y: number) => void;
  onResizeFixture: (
    fixture: PosFloorFixture,
    next: { grid_x: number; grid_y: number; grid_w: number; grid_h: number },
  ) => void;
  onRotateTable: (table: PosTable) => void;
  onRotateFixture: (fixture: PosFloorFixture) => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onDuplicate?: () => void;
};

type DragKind = MapSelectionKind;

export function TableMapCanvas({
  tables,
  fixtures,
  selectedId,
  selectedKind,
  dialogOpen = false,
  onSelectTable,
  onSelectFixture,
  onEditTable,
  onEditFixture,
  onMoveTable,
  onMoveFixture,
  onResizeFixture,
  onRotateTable,
  onRotateFixture,
  onCopy,
  onPaste,
  onDuplicate,
}: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingKind, setDraggingKind] = useState<DragKind | null>(null);
  const dragOrigin = useRef<{
    id: string;
    kind: DragKind;
    startX: number;
    startY: number;
    origGX: number;
    origGY: number;
    moved: boolean;
  } | null>(null);
  const skipClickRef = useRef(false);

  const occupiedBoxes = useMemo(() => {
    const boxes: Array<{ id: string; x: number; y: number; w: number; h: number }> =
      [];
    for (const table of tables) {
      boxes.push({ id: table.id, ...axisAlignedBox(table) });
    }
    for (const f of fixtures) {
      boxes.push({
        id: f.id,
        x: f.grid_x,
        y: f.grid_y,
        w: f.grid_w,
        h: f.grid_h,
      });
    }
    return boxes;
  }, [fixtures, tables]);

  const bounds = useMemo(() => {
    let maxX = TABLE_MAP_MIN_COLS;
    let maxY = TABLE_MAP_MIN_ROWS;
    for (const b of occupiedBoxes) {
      maxX = Math.max(maxX, b.x + b.w + 2);
      maxY = Math.max(maxY, b.y + b.h + 2);
    }
    return { cols: maxX, rows: maxY };
  }, [occupiedBoxes]);

  const widthPx = bounds.cols * TABLE_MAP_CELL_PX;
  const heightPx = bounds.rows * TABLE_MAP_CELL_PX;

  const tryMove = useCallback(
    (id: string, kind: DragKind, grid_x: number, grid_y: number) => {
      const x = Math.max(0, grid_x);
      const y = Math.max(0, grid_y);
      let w = 1;
      let h = 1;
      if (kind === "table") {
        const moving = tables.find((row) => row.id === id);
        if (!moving) return;
        const fp = axisAlignedFootprint(moving);
        w = fp.grid_w;
        h = fp.grid_h;
      } else {
        const moving = fixtures.find((row) => row.id === id);
        if (!moving) return;
        w = moving.grid_w;
        h = moving.grid_h;
      }
      const candidate = { x, y, w, h };
      const clash = occupiedBoxes.some((other) => {
        if (other.id === id) return false;
        return boxesOverlap(candidate, other);
      });
      if (clash) {
        toast({
          title: t(
            "tableManagement.map.overlap",
            "Cannot place table over another table.",
          ),
          variant: "destructive",
        });
        return;
      }
      if (kind === "table") onMoveTable(id, x, y);
      else onMoveFixture(id, x, y);
    },
    [fixtures, occupiedBoxes, onMoveFixture, onMoveTable, t, tables, toast],
  );

  const onPointerDownTable = (e: React.PointerEvent, table: PosTable) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingId(table.id);
    setDraggingKind("table");
    dragOrigin.current = {
      id: table.id,
      kind: "table",
      startX: e.clientX,
      startY: e.clientY,
      origGX: table.grid_x,
      origGY: table.grid_y,
      moved: false,
    };
  };

  const onPointerDownFixture = (e: React.PointerEvent, fixture: PosFloorFixture) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingId(fixture.id);
    setDraggingKind("fixture");
    dragOrigin.current = {
      id: fixture.id,
      kind: "fixture",
      startX: e.clientX,
      startY: e.clientY,
      origGX: fixture.grid_x,
      origGY: fixture.grid_y,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const origin = dragOrigin.current;
    if (!origin || origin.id !== draggingId) return;
    const dx = e.clientX - origin.startX;
    const dy = e.clientY - origin.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) origin.moved = true;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const origin = dragOrigin.current;
    setDraggingId(null);
    setDraggingKind(null);
    dragOrigin.current = null;
    if (!origin) return;
    if (!origin.moved) return;
    skipClickRef.current = true;
    const dx = e.clientX - origin.startX;
    const dy = e.clientY - origin.startY;
    const gx = origin.origGX + Math.round(dx / TABLE_MAP_CELL_PX);
    const gy = origin.origGY + Math.round(dy / TABLE_MAP_CELL_PX);
    tryMove(origin.id, origin.kind, gx, gy);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (dialogOpen) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && key === "c") {
        if (!selectedId || !selectedKind) return;
        e.preventDefault();
        onCopy?.();
        return;
      }
      if (mod && key === "v") {
        e.preventDefault();
        onPaste?.();
        return;
      }
      if (mod && key === "d") {
        if (!selectedId || !selectedKind) return;
        e.preventDefault();
        onDuplicate?.();
        return;
      }
      if (key !== "r") return;
      if (mod) return;
      if (!selectedId || !selectedKind) return;
      e.preventDefault();
      if (selectedKind === "table") {
        const table = tables.find((row) => row.id === selectedId);
        if (table) onRotateTable(table);
      } else {
        const fixture = fixtures.find((row) => row.id === selectedId);
        if (fixture) onRotateFixture(fixture);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    dialogOpen,
    fixtures,
    onCopy,
    onPaste,
    onDuplicate,
    onRotateFixture,
    onRotateTable,
    selectedId,
    selectedKind,
    tables,
  ]);

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-background">
      <div
        className="relative"
        style={{
          width: widthPx,
          height: heightPx,
          minHeight: TABLE_MAP_MIN_ROWS * TABLE_MAP_CELL_PX,
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="absolute inset-0 flex" aria-hidden>
          {Array.from({ length: bounds.cols }).map((_, i) => (
            <div
              key={i}
              className={i % 2 === 0 ? "bg-white" : "bg-sky-50/80"}
              style={{ width: TABLE_MAP_CELL_PX, height: "100%" }}
            />
          ))}
        </div>
        <svg className="pointer-events-none absolute inset-0" width={widthPx} height={heightPx}>
          {Array.from({ length: bounds.cols + 1 }).map((_, i) => (
            <line
              key={`v${i}`}
              x1={i * TABLE_MAP_CELL_PX}
              y1={0}
              x2={i * TABLE_MAP_CELL_PX}
              y2={heightPx}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
          ))}
          {Array.from({ length: bounds.rows + 1 }).map((_, i) => (
            <line
              key={`h${i}`}
              x1={0}
              y1={i * TABLE_MAP_CELL_PX}
              x2={widthPx}
              y2={i * TABLE_MAP_CELL_PX}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
          ))}
        </svg>

        {/* Fixtures under tables */}
        {fixtures.map((fixture) => (
          <TableMapFixtureNode
            key={fixture.id}
            fixture={fixture}
            selected={selectedKind === "fixture" && selectedId === fixture.id}
            onPointerDown={onPointerDownFixture}
            onClick={(f) => {
              if (skipClickRef.current) {
                skipClickRef.current = false;
                return;
              }
              onSelectFixture(f);
            }}
            onDoubleClick={onEditFixture}
            onRotate={onRotateFixture}
            onResize={onResizeFixture}
          />
        ))}

        {tables.map((table) => (
          <TableMapTableNode
            key={table.id}
            table={table}
            selected={selectedKind === "table" && selectedId === table.id}
            onPointerDown={onPointerDownTable}
            onClick={(tbl) => {
              if (skipClickRef.current) {
                skipClickRef.current = false;
                return;
              }
              onSelectTable(tbl);
            }}
            onDoubleClick={onEditTable}
            onRotate={onRotateTable}
          />
        ))}
      </div>
    </div>
  );
}
