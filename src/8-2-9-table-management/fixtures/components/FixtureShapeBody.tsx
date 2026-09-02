import { cn } from "@/shared/lib/utils";
import type { PosFloorFixture } from "../lib/posFloorFixtureTypes";
import { FIXTURE_VISUALS, type FixtureVisual } from "../lib/fixtureVisuals";
import { TABLE_MAP_CELL_PX } from "../../lib/tableShapeLayout";
import { isSidewaysRotation } from "../../lib/tableRotation";
import { edgeStripLayout, isEdgeStripFixtureType, isFixedCellFixtureType } from "../lib/fixtureLayout";

type Props = {
  fixture: Pick<
    PosFloorFixture,
    "fixture_type" | "name" | "grid_w" | "grid_h" | "rotation"
  >;
  selected?: boolean;
  muted?: boolean;
  className?: string;
};

/** Type-specific floor-plan silhouette (door strip, stair box, etc.). */
export function FixtureShapeBody({
  fixture,
  selected,
  muted,
  className,
}: Props) {
  const visual = FIXTURE_VISUALS[fixture.fixture_type];
  if (!visual) return null;
  const Icon = visual.icon;
  const sideways = fixture.grid_h > fixture.grid_w;

  if (isEdgeStripFixtureType(fixture.fixture_type)) {
    const { vertical, pinEnd } = edgeStripLayout(fixture);
    return (
      <EdgeStripBody
        visual={visual}
        selected={selected}
        muted={muted}
        vertical={vertical}
        pinEnd={pinEnd}
        label={fixture.fixture_type === "door" ? fixture.name : undefined}
        className={className}
      />
    );
  }

  if (isFixedCellFixtureType(fixture.fixture_type)) {
    const { vertical, pinEnd } = edgeStripLayout(fixture);
    return (
      <span
        className={cn(
          "absolute inset-0 flex",
          vertical
            ? pinEnd
              ? "justify-end"
              : "justify-start"
            : pinEnd
              ? "items-end"
              : "items-start",
          className,
        )}
      >
        <span
          className={cn(
            "flex items-center justify-center overflow-hidden rounded-none border-2 px-0.5 text-center shadow-none",
            visual.fillClass,
            visual.borderClass,
            selected && "ring-2 ring-primary/40",
            muted && "opacity-90",
            vertical ? "h-full w-1/2 min-w-[22px]" : "h-1/2 min-h-[22px] w-full",
          )}
        >
          <span className="flex max-w-full flex-col items-center justify-center gap-0">
            <Icon className={cn("h-3.5 w-3.5 shrink-0", visual.iconClass)} aria-hidden />
            <span className="max-w-full truncate text-[8px] font-semibold leading-tight text-slate-800">
              {fixture.name}
            </span>
          </span>
        </span>
      </span>
    );
  }

  if (fixture.fixture_type === "parking") {
    return (
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center overflow-hidden rounded-none border-2 px-1 text-center shadow-none",
          visual.fillClass,
          visual.borderClass,
          selected && "ring-2 ring-primary/40",
          muted && "opacity-90",
          className,
        )}
      >
        <span
          className={cn(
            "flex max-w-full flex-col items-center justify-center gap-0.5",
            sideways && "-rotate-90",
          )}
          style={
            sideways
              ? {
                  maxWidth: Math.max(
                    24,
                    fixture.grid_h * TABLE_MAP_CELL_PX - 16,
                  ),
                }
              : undefined
          }
        >
          <Icon className={cn("h-4 w-4 shrink-0", visual.iconClass)} aria-hidden />
          <span className="max-w-full truncate text-[10px] font-semibold leading-tight text-slate-800">
            {fixture.name}
          </span>
        </span>
      </span>
    );
  }

  if (fixture.fixture_type === "stairs") {
    const cols = Math.max(1, fixture.grid_w);
    const rows = Math.max(1, fixture.grid_h);
    const vertical = isSidewaysRotation(fixture.rotation);
    return (
      <span
        className={cn(
          "absolute inset-0 grid overflow-hidden rounded-none border-2 shadow-none",
          visual.fillClass,
          visual.borderClass,
          selected && "ring-2 ring-primary/40",
          muted && "opacity-90",
          className,
        )}
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: cols * rows }, (_, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          return (
            <StairCell
              key={i}
              vertical={vertical}
              className={cn(
                visual.borderClass,
                col < cols - 1 && "border-r-2",
                row < rows - 1 && "border-b-2",
              )}
            />
          );
        })}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "absolute inset-0 flex items-center justify-center overflow-hidden rounded-none border-2 px-1 text-center shadow-none",
        visual.fillClass,
        visual.borderClass,
        selected && "ring-2 ring-primary/40",
        muted && "opacity-90",
        className,
      )}
    >
      <span
        className={cn(
          "flex max-w-full flex-col items-center justify-center gap-0.5",
          sideways && "-rotate-90",
        )}
        style={
          sideways
            ? {
                maxWidth: Math.max(
                  24,
                  fixture.grid_h * TABLE_MAP_CELL_PX - 16,
                ),
              }
            : undefined
        }
      >
        <Icon className={cn("h-4 w-4 shrink-0", visual.iconClass)} aria-hidden />
        <span className="max-w-full truncate text-[10px] font-semibold leading-tight text-slate-800">
          {fixture.name}
        </span>
      </span>
    </span>
  );
}

function EdgeStripBody({
  visual,
  selected,
  muted,
  vertical,
  pinEnd,
  label,
  className,
}: {
  visual: FixtureVisual;
  selected?: boolean;
  muted?: boolean;
  vertical: boolean;
  pinEnd: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "absolute inset-0 flex",
        vertical
          ? pinEnd
            ? "justify-end"
            : "justify-start"
          : pinEnd
            ? "items-end"
            : "items-start",
        className,
      )}
    >
      <span
        className={cn(
          "relative flex items-center justify-center rounded-none border-2 shadow-none",
          visual.fillClass,
          visual.borderClass,
          selected && "ring-2 ring-primary/40",
          muted && "opacity-90",
          vertical ? "h-full w-3.5 min-w-[12px]" : "h-3.5 min-h-[12px] w-full",
        )}
      >
        {label ? (
          <span
            className={cn(
              "truncate px-0.5 text-[9px] font-semibold leading-none text-slate-800",
              vertical && "rotate-90 whitespace-nowrap",
            )}
          >
            {label}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function StairCell({
  vertical,
  className,
}: {
  vertical: boolean;
  className?: string;
}) {
  const stairLine = vertical ? "h-full bg-slate-600" : "w-full bg-slate-600";
  return (
    <span className={cn("min-h-0 min-w-0 overflow-hidden", className)}>
      <span
        className={cn(
          "grid h-full w-full",
          vertical
            ? "grid-cols-[1fr_2px_1fr_2px_1fr_2px_1fr]"
            : "grid-rows-[1fr_2px_1fr_2px_1fr_2px_1fr]",
        )}
        aria-hidden
      >
        <span />
        <span className={stairLine} />
        <span />
        <span className={stairLine} />
        <span />
        <span className={stairLine} />
        <span />
      </span>
    </span>
  );
}
