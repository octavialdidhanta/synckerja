import { cn } from "@/shared/lib/utils";
import type { PosTable } from "@/8-2-9-table-management/lib/posTableTypes";
import type { TableOccupancyState } from "@/8-2-9-table-management/sessions";
import { isSidewaysRotation } from "@/8-2-9-table-management/lib/tableRotation";
import { TABLE_MAP_CELL_PX, ONE_SIDED_THIN_RATIO } from "@/8-2-9-table-management/lib/tableShapeLayout";
import {
  TableMapChair,
  CHAIR_EDGE_WIDTH_PX,
  chairDepthPx,
  type ChairFacing,
} from "@/8-2-9-table-management/components/map/TableMapChair";

type Props = {
  table: PosTable;
  selected?: boolean;
  /** @deprecated Prefer occupancyState */
  occupied?: boolean;
  occupancyState?: TableOccupancyState;
  /** e.g. "1/5" used/capacity */
  occupancyLabel?: string | null;
  disabled?: boolean;
  durationLabel?: string | null;
  onSelect: (table: PosTable) => void;
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
  oneSidedChairCenterPct,
}: {
  table: PosTable;
  edgeWidthPx: number;
  sideways: boolean;
  oneSidedChairCenterPct?: number;
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
    const widthPx = CHAIR_EDGE_WIDTH_PX;
    const attachPct = oneSidedChairCenterPct ?? 90;
    if (sideways) {
      return (
        <>
          {seatPercents(pax).map((top, i) => (
            <TableMapChair
              key={i}
              facing="right"
              widthPx={widthPx}
              style={{ left: `${attachPct}%`, top: `${top}%` }}
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
            style={{ left: `${left}%`, top: `${attachPct}%` }}
          />
        ))}
      </>
    );
  }

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

/** Read-only floor-plan table node — vacant / partial / full. */
export function PosTableMapTableNode({
  table,
  selected,
  occupied,
  occupancyState,
  occupancyLabel,
  disabled,
  durationLabel,
  onSelect,
}: Props) {
  const seatGutter = 20;
  const isCircle = table.shape === "circle";
  const isSquare = table.shape === "square";
  const isOneSided = table.shape === "one_sided";
  const sideways =
    (table.shape === "rectangle" || table.shape === "one_sided") &&
    isSidewaysRotation(table.rotation);

  const state: TableOccupancyState =
    occupancyState ?? (occupied ? "full" : "empty");
  const isBusy = state === "partial" || state === "full";

  const cellW = table.grid_w * TABLE_MAP_CELL_PX;
  const cellH = Math.max(table.grid_h * TABLE_MAP_CELL_PX, TABLE_MAP_CELL_PX);
  const oneSidedThinPx = TABLE_MAP_CELL_PX * ONE_SIDED_THIN_RATIO;
  const oneSidedChairDepth = chairDepthPx(CHAIR_EDGE_WIDTH_PX);

  let nodeWidth: number;
  let h: number;
  let useSideGutter = isSquare || (sideways && !isOneSided);
  let left = table.grid_x * TABLE_MAP_CELL_PX;
  let top = table.grid_y * TABLE_MAP_CELL_PX;
  let marginLeft = 0;
  let bodyInset = { left: 6, right: 6, top: 6, bottom: 6 };
  let oneSidedChairCenterPct: number | undefined;

  if (isOneSided && sideways) {
    nodeWidth = oneSidedThinPx + oneSidedChairDepth;
    h = cellH;
    bodyInset = { left: 2, right: oneSidedChairDepth, top: 2, bottom: 2 };
    oneSidedChairCenterPct =
      ((oneSidedThinPx + oneSidedChairDepth / 2) / nodeWidth) * 100;
  } else if (isOneSided) {
    nodeWidth = cellW;
    h = oneSidedThinPx + oneSidedChairDepth;
    bodyInset = { left: 2, right: 2, top: 2, bottom: oneSidedChairDepth };
    oneSidedChairCenterPct =
      ((oneSidedThinPx + oneSidedChairDepth / 2) / h) * 100;
  } else {
    useSideGutter = isSquare || sideways;
    nodeWidth = useSideGutter
      ? cellW + seatGutter
      : Math.max(cellW, isCircle ? TABLE_MAP_CELL_PX + 18 : cellW);
    h = useSideGutter ? cellH : cellH + seatGutter;
    top = useSideGutter
      ? table.grid_y * TABLE_MAP_CELL_PX
      : table.grid_y * TABLE_MAP_CELL_PX - seatGutter / 2;
    marginLeft = useSideGutter ? -seatGutter / 2 : isCircle ? -9 : 0;
    bodyInset = {
      left: useSideGutter ? seatGutter / 2 + 3 : isCircle ? 16 : 6,
      right: useSideGutter ? seatGutter / 2 + 3 : isCircle ? 16 : 6,
      top: useSideGutter ? 6 : seatGutter / 2 + 3,
      bottom: useSideGutter ? 6 : seatGutter / 2 + 3,
    };
  }

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "absolute touch-manipulation select-none overflow-visible bg-transparent p-0 transition-shadow",
        selected && "z-10",
        disabled && "cursor-not-allowed opacity-80",
      )}
      style={{
        left,
        top,
        width: nodeWidth,
        height: h,
        marginLeft,
        transform:
          (isCircle || isSquare) && table.rotation
            ? `rotate(${table.rotation}deg)`
            : undefined,
      }}
      onClick={() => {
        if (disabled) return;
        onSelect(table);
      }}
      aria-label={`${table.name}, ${occupancyLabel ?? `${table.pax} pax`}${durationLabel ? `, ${durationLabel}` : ""}${disabled ? ", locked" : ""}`}
    >
      <span
        className={cn(
          "absolute flex flex-col items-center justify-center border-2 text-center shadow-md",
          state === "empty" && "bg-gradient-to-b from-emerald-50 to-emerald-100/80",
          state === "partial" && "bg-gradient-to-b from-amber-50 to-amber-100/90",
          state === "full" && "bg-gradient-to-b from-orange-50 to-orange-100/90",
          state === "empty" &&
            (selected ? "border-emerald-700 ring-2 ring-emerald-400/50" : "border-emerald-500"),
          state === "partial" &&
            (selected ? "border-amber-700 ring-2 ring-amber-400/50" : "border-amber-500"),
          state === "full" &&
            (selected ? "border-orange-800 ring-2 ring-orange-500/50" : "border-orange-600"),
          isCircle && "rounded-full",
          !isCircle && "rounded-none",
          isOneSided &&
            !sideways &&
            (isBusy ? "border-b-[3px] border-b-orange-700" : "border-b-[3px] border-b-emerald-700"),
          isOneSided &&
            sideways &&
            (isBusy ? "border-r-[3px] border-r-orange-700" : "border-r-[3px] border-r-emerald-700"),
        )}
        style={{
          left: bodyInset.left,
          right: bodyInset.right,
          top: bodyInset.top,
          bottom: bodyInset.bottom,
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
            maxWidth: sideways
              ? Math.max(isOneSided ? 18 : 28, cellH - 18)
              : isOneSided
                ? Math.max(24, cellW - 12)
                : undefined,
          }}
        >
          <span
            className={cn(
              "max-w-full truncate px-1 text-xs font-semibold leading-tight",
              state === "empty" && "text-emerald-950",
              state === "partial" && "text-amber-950",
              state === "full" && "text-orange-950",
            )}
          >
            {table.name}
          </span>
          {durationLabel ? (
            <span className="text-[10px] font-medium text-orange-800">{durationLabel}</span>
          ) : (
            <span
              className={cn(
                "text-[10px]",
                state === "empty" && "text-emerald-700/80",
                state === "partial" && "text-amber-800/90",
                state === "full" && "text-orange-800/90",
              )}
            >
              {occupancyLabel ?? `${table.pax} pax`}
            </span>
          )}
        </span>
      </span>

      <span className="pointer-events-none absolute inset-0 z-[2]" aria-hidden>
        <TableSeats
          table={table}
          edgeWidthPx={(sideways ? h : nodeWidth) - 12}
          sideways={sideways}
          oneSidedChairCenterPct={oneSidedChairCenterPct}
        />
      </span>
    </button>
  );
}
