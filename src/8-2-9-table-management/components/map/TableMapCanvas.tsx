import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useToast } from "@/shared/components/ui/use-toast";
import type { PosTable } from "../../lib/posTableTypes";
import { axisAlignedBox, axisAlignedFootprint } from "../../lib/tableRotation";
import {
  TABLE_MAP_CELL_PX,
  TABLE_MAP_MIN_COLS,
  TABLE_MAP_MIN_ROWS,
  boxesOverlap,
} from "../../lib/tableShapeLayout";
import { TableMapTableNode } from "./TableMapTableNode";

type Props = {
  tables: PosTable[];
  selectedId: string | null;
  dialogOpen?: boolean;
  onSelect: (table: PosTable) => void;
  onEdit: (table: PosTable) => void;
  onMove: (id: string, grid_x: number, grid_y: number) => void;
  onRotate: (table: PosTable) => void;
};

export function TableMapCanvas({
  tables,
  selectedId,
  dialogOpen = false,
  onSelect,
  onEdit,
  onMove,
  onRotate,
}: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOrigin = useRef<{
    id: string;
    startX: number;
    startY: number;
    origGX: number;
    origGY: number;
    moved: boolean;
  } | null>(null);
  const skipClickRef = useRef(false);

  const bounds = useMemo(() => {
    let maxX = TABLE_MAP_MIN_COLS;
    let maxY = TABLE_MAP_MIN_ROWS;
    for (const table of tables) {
      const fp = axisAlignedFootprint(table);
      maxX = Math.max(maxX, table.grid_x + fp.grid_w + 2);
      maxY = Math.max(maxY, table.grid_y + fp.grid_h + 2);
    }
    return { cols: maxX, rows: maxY };
  }, [tables]);

  const widthPx = bounds.cols * TABLE_MAP_CELL_PX;
  const heightPx = bounds.rows * TABLE_MAP_CELL_PX;

  const tryMove = useCallback(
    (id: string, grid_x: number, grid_y: number) => {
      const moving = tables.find((x) => x.id === id);
      if (!moving) return;
      const x = Math.max(0, grid_x);
      const y = Math.max(0, grid_y);
      const fp = axisAlignedFootprint(moving);
      const candidate = { x, y, w: fp.grid_w, h: fp.grid_h };
      const clash = tables.some((other) => {
        if (other.id === id) return false;
        return boxesOverlap(candidate, axisAlignedBox(other));
      });
      if (clash) {
        toast({
          title: t("tableManagement.map.overlap", "Cannot place table over another table."),
          variant: "destructive",
        });
        return;
      }
      onMove(id, x, y);
    },
    [onMove, t, tables, toast],
  );

  const onPointerDown = (e: React.PointerEvent, table: PosTable) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingId(table.id);
    dragOrigin.current = {
      id: table.id,
      startX: e.clientX,
      startY: e.clientY,
      origGX: table.grid_x,
      origGY: table.grid_y,
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
    dragOrigin.current = null;
    if (!origin) return;
    if (!origin.moved) return;
    skipClickRef.current = true;
    const dx = e.clientX - origin.startX;
    const dy = e.clientY - origin.startY;
    const gx = origin.origGX + Math.round(dx / TABLE_MAP_CELL_PX);
    const gy = origin.origGY + Math.round(dy / TABLE_MAP_CELL_PX);
    tryMove(origin.id, gx, gy);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (dialogOpen) return;
      if (e.key !== "r" && e.key !== "R") return;
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
      if (!selectedId) return;
      const table = tables.find((row) => row.id === selectedId);
      if (!table) return;
      e.preventDefault();
      onRotate(table);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialogOpen, onRotate, selectedId, tables]);

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-background">
      <div
        ref={surfaceRef}
        className="relative"
        style={{ width: widthPx, height: heightPx, minHeight: TABLE_MAP_MIN_ROWS * TABLE_MAP_CELL_PX }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => {
          /* click empty map clears selection via parent if needed */
        }}
      >
        {/* striped column backgrounds */}
        <div className="absolute inset-0 flex" aria-hidden>
          {Array.from({ length: bounds.cols }).map((_, i) => (
            <div
              key={i}
              className={i % 2 === 0 ? "bg-white" : "bg-sky-50/80"}
              style={{ width: TABLE_MAP_CELL_PX, height: "100%" }}
            />
          ))}
        </div>
        {/* grid lines */}
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

        {tables.map((table) => (
          <TableMapTableNode
            key={table.id}
            table={table}
            selected={selectedId === table.id}
            onPointerDown={onPointerDown}
            onClick={(tbl) => {
              if (skipClickRef.current) {
                skipClickRef.current = false;
                return;
              }
              onSelect(tbl);
            }}
            onDoubleClick={onEdit}
            onRotate={onRotate}
          />
        ))}
      </div>
    </div>
  );
}
