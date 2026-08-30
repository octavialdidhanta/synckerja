import { cn } from "@/shared/lib/utils";
import { TABLE_MAP_CELL_PX } from "../../lib/tableShapeLayout";
import { TableMapRotateControl } from "../../components/map/TableMapRotateControl";
import type { PosFloorFixture } from "../lib/posFloorFixtureTypes";
import { FixtureShapeBody } from "./FixtureShapeBody";

type Props = {
  fixture: PosFloorFixture;
  selected?: boolean;
  interactive?: boolean;
  onPointerDown?: (e: React.PointerEvent, fixture: PosFloorFixture) => void;
  onClick?: (fixture: PosFloorFixture) => void;
  onDoubleClick?: (fixture: PosFloorFixture) => void;
  onRotate?: (fixture: PosFloorFixture) => void;
};

export function TableMapFixtureNode({
  fixture,
  selected,
  interactive = true,
  onPointerDown,
  onClick,
  onDoubleClick,
  onRotate,
}: Props) {
  const w = fixture.grid_w * TABLE_MAP_CELL_PX;
  const h = fixture.grid_h * TABLE_MAP_CELL_PX;

  const body = (
    <FixtureShapeBody fixture={fixture} selected={selected && interactive} />
  );

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
        <div className="absolute -right-2 -top-2 z-20">
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
    </div>
  );
}
