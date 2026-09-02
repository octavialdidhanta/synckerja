import type { PosTable } from "../../lib/posTableTypes";
import { TABLE_MAP_CELL_PX } from "../../lib/tableShapeLayout";
import { TableMapChair, chairDepthPx, type ChairFacing } from "./TableMapChair";

export type TableBodyInset = {
  left: number;
  right: number;
  top: number;
  bottom: number;
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
  if (count <= 0) return 32;
  const slot = edgePx / (count + 0.15);
  return Math.min(46, Math.max(30, slot * 0.9));
}

function standardSideChairWidthPx(): number {
  return chairWidthForEdge(TABLE_MAP_CELL_PX * 2, 2);
}

function flushLeft(inset: TableBodyInset, widthPx: number): number {
  return inset.left - chairDepthPx(widthPx) / 2;
}

function flushRight(
  nodeWidth: number,
  inset: TableBodyInset,
  widthPx: number,
): number {
  return nodeWidth - inset.right + chairDepthPx(widthPx) / 2;
}

function flushTop(inset: TableBodyInset, widthPx: number): number {
  return inset.top - chairDepthPx(widthPx) / 2;
}

function flushBottom(
  nodeHeight: number,
  inset: TableBodyInset,
  widthPx: number,
): number {
  return nodeHeight - inset.bottom + chairDepthPx(widthPx) / 2;
}

type Props = {
  table: PosTable;
  edgeWidthPx: number;
  sideways: boolean;
  bodyInset: TableBodyInset;
  nodeWidth: number;
  nodeHeight: number;
};

export function TableMapSeats({
  table,
  edgeWidthPx,
  sideways,
  bodyInset,
  nodeWidth,
  nodeHeight,
}: Props) {
  const pax = Math.max(1, table.pax);

  if (table.shape === "circle") {
    const r = 48;
    const widthPx = Math.min(
      36,
      chairWidthForEdge(Math.PI * 2 * (r / 100) * edgeWidthPx, pax),
    );
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
              widthPx={widthPx}
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
        <TableMapChair
          facing="left"
          widthPx={widthPx}
          style={{ left: flushLeft(bodyInset, widthPx), top: "50%" }}
        />
        <TableMapChair
          facing="right"
          widthPx={widthPx}
          style={{ left: flushRight(nodeWidth, bodyInset, widthPx), top: "50%" }}
        />
      </>
    );
  }

  if (table.shape === "one_sided") {
    const widthPx = chairWidthForEdge(edgeWidthPx, pax);
    if (sideways) {
      const left = flushRight(nodeWidth, bodyInset, widthPx);
      return (
        <>
          {seatPercents(pax).map((top, i) => (
            <TableMapChair
              key={i}
              facing="right"
              widthPx={widthPx}
              style={{ left, top: `${top}%` }}
            />
          ))}
        </>
      );
    }
    const top = flushBottom(nodeHeight, bodyInset, widthPx);
    return (
      <>
        {seatPercents(pax).map((left, i) => (
          <TableMapChair
            key={i}
            facing="bottom"
            widthPx={widthPx}
            style={{ left: `${left}%`, top }}
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
    const leftX = flushLeft(bodyInset, leftW);
    const rightX = flushRight(nodeWidth, bodyInset, rightW);
    return (
      <>
        {seatPercents(aCount).map((top, i) => (
          <TableMapChair
            key={`l${i}`}
            facing="left"
            widthPx={leftW}
            style={{ left: leftX, top: `${top}%` }}
          />
        ))}
        {seatPercents(bCount).map((top, i) => (
          <TableMapChair
            key={`r${i}`}
            facing="right"
            widthPx={rightW}
            style={{ left: rightX, top: `${top}%` }}
          />
        ))}
      </>
    );
  }

  const topW = chairWidthForEdge(edgeWidthPx, aCount);
  const bottomW = chairWidthForEdge(edgeWidthPx, bCount);
  const topY = flushTop(bodyInset, topW);
  const bottomY = flushBottom(nodeHeight, bodyInset, bottomW);
  return (
    <>
      {seatPercents(aCount).map((left, i) => (
        <TableMapChair
          key={`t${i}`}
          facing="top"
          widthPx={topW}
          style={{ left: `${left}%`, top: topY }}
        />
      ))}
      {seatPercents(bCount).map((left, i) => (
        <TableMapChair
          key={`b${i}`}
          facing="bottom"
          widthPx={bottomW}
          style={{ left: `${left}%`, top: bottomY }}
        />
      ))}
    </>
  );
}
