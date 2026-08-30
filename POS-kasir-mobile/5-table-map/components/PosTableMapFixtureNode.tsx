import type { PosFloorFixture } from "@/8-2-9-table-management/fixtures";
import { FixtureShapeBody } from "@/8-2-9-table-management/fixtures/components/FixtureShapeBody";
import { TABLE_MAP_CELL_PX } from "@/8-2-9-table-management/lib/tableShapeLayout";

type Props = {
  fixture: PosFloorFixture;
};

/** Muted, non-interactive floor fixture on POS table map. */
export function PosTableMapFixtureNode({ fixture }: Props) {
  const w = fixture.grid_w * TABLE_MAP_CELL_PX;
  const h = fixture.grid_h * TABLE_MAP_CELL_PX;

  return (
    <div
      className="pointer-events-none absolute z-[1] select-none opacity-75"
      style={{
        left: fixture.grid_x * TABLE_MAP_CELL_PX,
        top: fixture.grid_y * TABLE_MAP_CELL_PX,
        width: w,
        height: h,
      }}
      aria-hidden
    >
      <FixtureShapeBody fixture={fixture} muted />
    </div>
  );
}
