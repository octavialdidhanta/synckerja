import { cn } from "@/shared/lib/utils";
import type { PosTable } from "../../lib/posTableTypes";
import { isSidewaysRotation } from "../../lib/tableRotation";
import { TABLE_MAP_CELL_PX } from "../../lib/tableShapeLayout";
import { TableMapChair, type ChairFacing } from "./TableMapChair";
import { TableMapRotateControl } from "./TableMapRotateControl";

type Props = {
  table: PosTable;
  selected?: boolean;
  onPointerDown: (e: React.PointerEvent, table: PosTable) => void;
  onClick: (table: PosTable) => void;
  onDoubleClick?: (table: PosTable) => void;
  onRotate?: (table: PosTable) => void;
};

function seatPercents(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [50];
  return Array.from({ length: count }, (_, i) => ((i + 1) / (count + 1)) * 100);
}

function facingFromAngle(deg: number): ChairFacing {
  const a = ((deg % 360) + 360) % 360;
  if (a >= 315 || a < 45) return "right";
  if (a >= 45 && a < 135) return "bottom";
  if (a >= 135 && a < 225) return "left";
  return "top";
}

function chairWidthForEdge(edgePx: number, count: number): number {
  if (count <= 0) return 28;
  const slot = edgePx / (count + 0.25);
  return Math.min(38, Math.max(24, slot * 0.78));
}

function standardSideChairWidthPx(): number {
  return chairWidthForEdge(TABLE_MAP_CELL_PX * 2, 2);
}

function TableSeats({
  table,
  edgeWidthPx,
  sideways,
}: {
  table: PosTable;
  edgeWidthPx: number;
  sideways: boolean;
}) {
  const pax = Math.max(1, table.pax);

  if (table.shape === "circle") {
    const r = 44;
    const widthPx = chairWidthForEdge(Math.PI * 2 * (r / 100) * edgeWidthPx, pax);
    return (
      <>
        {Array.from({ length: pax }).map((_, i) => {
          const angleRad = (i / pax) * Math.PI * 2 - Math.PI / 2;
          const angleDeg = (angleRad * 180) / Math.PI;
          const x = 50 + Math.cos(angleRad) * r;
          const y = 50 + Math.sin(angleRad) * r;
          return (
            <TableMapChair
              key={i}
              facing={facingFromAngle(angleDeg)}
              widthPx={Math.min(30, widthPx)}
              style={{ left: `${x}%`, top: `${y}%` }}
            />
          );
        })}
      </>
    );
  }

  if (table.shape === "square") {
    const widthPx = standardSideChairWidthPx();
    return (
      <>
        <TableMapChair facing="left" widthPx={widthPx} style={{ left: "10%", top: "50%" }} />
        <TableMapChair facing="right" widthPx={widthPx} style={{ left: "90%", top: "50%" }} />
      </>
    );
  }

  if (table.shape === "one_sided") {
    const widthPx = chairWidthForEdge(edgeWidthPx, pax);
    if (sideways) {
      return (
        <>
          {seatPercents(pax).map((top, i) => (
            <TableMapChair
              key={i}
              facing="right"
              widthPx={widthPx}
              style={{ left: "90%", top: `${top}%` }}
            />
          ))}
        </>
      );
    }
    return (
      <>
        {seatPercents(pax).map((left, i) => (
          <TableMapChair
            key={i}
            facing="bottom"
            widthPx={widthPx}
            style={{ left: `${left}%`, top: "90%" }}
          />
        ))}
      </>
    );
  }

  // rectangle — layout chairs along the long sides without CSS rotate
  const aCount = Math.floor(pax / 2);
  const bCount = pax - aCount;
  if (sideways) {
    const leftW = chairWidthForEdge(edgeWidthPx, aCount);
    const rightW = chairWidthForEdge(edgeWidthPx, bCount);
    return (
      <>
        {seatPercents(aCount).map((top, i) => (
          <TableMapChair
            key={`l${i}`}
            facing="left"
            widthPx={leftW}
            style={{ left: "10%", top: `${top}%` }}
          />
        ))}
        {seatPercents(bCount).map((top, i) => (
          <TableMapChair
            key={`r${i}`}
            facing="right"
            widthPx={rightW}
            style={{ left: "90%", top: `${top}%` }}
          />
        ))}
      </>
    );
  }

  const topW = chairWidthForEdge(edgeWidthPx, aCount);
  const bottomW = chairWidthForEdge(edgeWidthPx, bCount);
  return (
    <>
      {seatPercents(aCount).map((left, i) => (
        <TableMapChair
          key={`t${i}`}
          facing="top"
          widthPx={topW}
          style={{ left: `${left}%`, top: "10%" }}
        />
      ))}
      {seatPercents(bCount).map((left, i) => (
        <TableMapChair
          key={`b${i}`}
          facing="bottom"
          widthPx={bottomW}
          style={{ left: `${left}%`, top: "90%" }}
        />
      ))}
    </>
  );
}

export function TableMapTableNode({
  table,
  selected,
  onPointerDown,
  onClick,
  onDoubleClick,
  onRotate,
}: Props) {
  const seatGutter = 20;
  const isCircle = table.shape === "circle";
  const isSquare = table.shape === "square";
  const isOneSided = table.shape === "one_sided";
  const sideways =
    (table.shape === "rectangle" || table.shape === "one_sided") &&
    isSidewaysRotation(table.rotation);

  const cellW = table.grid_w * TABLE_MAP_CELL_PX;
  const cellH = Math.max(table.grid_h * TABLE_MAP_CELL_PX, TABLE_MAP_CELL_PX);

  // Axis-aligned layout: sideways tables expand width for side chairs (like square).
  const nodeWidth = isSquare || sideways
    ? cellW + seatGutter
    : Math.max(cellW, isCircle ? TABLE_MAP_CELL_PX + 18 : cellW);
  const h = isSquare || sideways ? cellH : cellH + seatGutter;
  const useSideGutter = isSquare || sideways;

  return (
    <div
      className={cn("absolute touch-none select-none", selected && "z-10")}
      style={{
        left: table.grid_x * TABLE_MAP_CELL_PX,
        top: useSideGutter
          ? table.grid_y * TABLE_MAP_CELL_PX
          : table.grid_y * TABLE_MAP_CELL_PX - seatGutter / 2,
        width: nodeWidth,
        height: h,
        marginLeft: useSideGutter ? -seatGutter / 2 : isCircle ? -9 : 0,
      }}
    >
      {selected && onRotate ? (
        <div className="absolute -right-2 -top-2 z-20">
          <TableMapRotateControl onRotate={() => onRotate(table)} />
        </div>
      ) : null}

      <button
        type="button"
        className="relative h-full w-full overflow-visible bg-transparent p-0 transition-shadow"
        style={{
          // Only spin symmetric shapes; rectangle/one_sided use layout swap instead.
          transform:
            (isCircle || isSquare) && table.rotation
              ? `rotate(${table.rotation}deg)`
              : undefined,
        }}
        onPointerDown={(e) => onPointerDown(e, table)}
        onClick={(e) => {
          e.stopPropagation();
          onClick(table);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick?.(table);
        }}
        aria-label={`${table.name}, ${table.pax} pax`}
      >
        <span
          className={cn(
            "absolute flex flex-col items-center justify-center border-2 bg-gradient-to-b from-white to-slate-50 text-center shadow-md",
            selected ? "border-primary ring-2 ring-primary/30" : "border-slate-400",
            isCircle && "rounded-full",
            !isCircle && "rounded-lg",
            isOneSided && !sideways && "border-b-[3px] border-b-sky-600",
            isOneSided && sideways && "border-r-[3px] border-r-sky-600",
          )}
          style={{
            left: useSideGutter ? seatGutter / 2 + 3 : isCircle ? 16 : 6,
            right: useSideGutter ? seatGutter / 2 + 3 : isCircle ? 16 : 6,
            top: useSideGutter ? 6 : seatGutter / 2 + 3,
            bottom: useSideGutter ? 6 : seatGutter / 2 + 3,
          }}
        >
          <span
            className="relative z-[1] flex flex-col items-center"
            style={{
              transform: sideways
                ? "rotate(-90deg)"
                : (isCircle || isSquare) && table.rotation
                  ? `rotate(${-table.rotation}deg)`
                  : undefined,
              maxWidth: sideways ? Math.max(28, cellH - 18) : undefined,
            }}
          >
            <span className="max-w-full truncate px-1 text-xs font-semibold leading-tight text-slate-800">
              {table.name}
            </span>
            <span className="text-[10px] text-slate-500">{table.pax} pax</span>
          </span>
        </span>

        <span className="pointer-events-none absolute inset-0 z-[2]" aria-hidden>
          <TableSeats
            table={table}
            edgeWidthPx={(sideways ? h : nodeWidth) - 12}
            sideways={sideways}
          />
        </span>
      </button>
    </div>
  );
}
