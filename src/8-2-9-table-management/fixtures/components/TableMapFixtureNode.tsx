import { useRef } from "react";
import { cn } from "@/shared/lib/utils";
import { TABLE_MAP_CELL_PX } from "../../lib/tableShapeLayout";
import { TableMapRotateControl } from "../../components/map/TableMapRotateControl";
import type { PosFloorFixture } from "../lib/posFloorFixtureTypes";
import { LENGTH_RESIZABLE_FIXTURE_TYPES } from "../lib/posFloorFixtureTypes";
import {
  edgeStripLayout,
  isEdgeStripFixtureType,
  isFixedCellFixtureType,
  resizeFixtureAlongAxis,
  type FixtureLengthEdge,
  type FixtureRect,
} from "../lib/fixtureLayout";
import { FixtureShapeBody } from "./FixtureShapeBody";
import { TableMapWallLengthHandle } from "./TableMapWallLengthHandle";

type Props = {
  fixture: PosFloorFixture;
  selected?: boolean;
  interactive?: boolean;
  onPointerDown?: (e: React.PointerEvent, fixture: PosFloorFixture) => void;
  onClick?: (fixture: PosFloorFixture) => void;
  onDoubleClick?: (fixture: PosFloorFixture) => void;
  onRotate?: (fixture: PosFloorFixture) => void;
  onResize?: (fixture: PosFloorFixture, next: FixtureRect) => void;
};

export function TableMapFixtureNode({
  fixture,
  selected,
  interactive = true,
  onPointerDown,
  onClick,
  onDoubleClick,
  onRotate,
  onResize,
}: Props) {
  const w = fixture.grid_w * TABLE_MAP_CELL_PX;
  const h = fixture.grid_h * TABLE_MAP_CELL_PX;
  const canLengthen =
    interactive &&
    selected &&
    Boolean(onResize) &&
    LENGTH_RESIZABLE_FIXTURE_TYPES.includes(fixture.fixture_type);
  const strip = edgeStripLayout(fixture);
  const rotateClass =
    isEdgeStripFixtureType(fixture.fixture_type) ||
    isFixedCellFixtureType(fixture.fixture_type)
    ? strip.vertical
      ? strip.pinEnd
        ? "absolute right-5 top-1/2 z-40 -translate-y-1/2"
        : "absolute left-5 top-1/2 z-40 -translate-y-1/2"
      : strip.pinEnd
        ? "absolute bottom-5 left-1/2 z-40 -translate-x-1/2"
        : "absolute left-1/2 top-5 z-40 -translate-x-1/2"
    : "absolute -right-2 -top-2 z-40";
  const resizeOrigin = useRef<{
    edge: FixtureLengthEdge;
    startX: number;
    startY: number;
    grid_x: number;
    grid_y: number;
    grid_w: number;
    grid_h: number;
    rotation: PosFloorFixture["rotation"];
  } | null>(null);

  const body = (
    <FixtureShapeBody fixture={fixture} selected={selected && interactive} />
  );

  const onHandlePointerDown = (
    e: React.PointerEvent,
    edge: FixtureLengthEdge,
  ) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    resizeOrigin.current = {
      edge,
      startX: e.clientX,
      startY: e.clientY,
      grid_x: fixture.grid_x,
      grid_y: fixture.grid_y,
      grid_w: fixture.grid_w,
      grid_h: fixture.grid_h,
      rotation: fixture.rotation,
    };
  };

  const onHandlePointerMove = (e: React.PointerEvent) => {
    const origin = resizeOrigin.current;
    if (!origin || !onResize) return;
    const { vertical } = edgeStripLayout(origin);
    const deltaPx = vertical
      ? e.clientY - origin.startY
      : e.clientX - origin.startX;
    const cellDelta = Math.round(deltaPx / TABLE_MAP_CELL_PX);
    onResize(fixture, resizeFixtureAlongAxis(origin, origin.edge, cellDelta));
  };

  const onHandlePointerUp = () => {
    resizeOrigin.current = null;
  };

  return (
    <div
      className={cn(
        "absolute touch-none select-none",
        selected && interactive ? "z-[5]" : "z-[1]",
      )}
      style={{
        left: fixture.grid_x * TABLE_MAP_CELL_PX,
        top: fixture.grid_y * TABLE_MAP_CELL_PX,
        width: w,
        height: h,
      }}
    >
      {selected && interactive && onRotate ? (
        <div className={rotateClass}>
          <TableMapRotateControl onRotate={() => onRotate(fixture)} />
        </div>
      ) : null}

      {interactive ? (
        <button
          type="button"
          className="relative h-full w-full overflow-visible bg-transparent p-0"
          onPointerDown={(e) => onPointerDown?.(e, fixture)}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.(fixture);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onDoubleClick?.(fixture);
          }}
          aria-label={fixture.name}
        >
          {body}
        </button>
      ) : (
        <div className="pointer-events-none relative h-full w-full" aria-hidden>
          {body}
        </div>
      )}

      {canLengthen ? (
        <>
          <TableMapWallLengthHandle
            edge="start"
            vertical={strip.vertical}
            pinEnd={strip.pinEnd}
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
          />
          <TableMapWallLengthHandle
            edge="end"
            vertical={strip.vertical}
            pinEnd={strip.pinEnd}
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
          />
        </>
      ) : null}
    </div>
  );
}
