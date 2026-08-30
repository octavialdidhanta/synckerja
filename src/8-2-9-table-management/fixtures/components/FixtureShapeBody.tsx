import { cn } from "@/shared/lib/utils";
import type { PosFloorFixture } from "../lib/posFloorFixtureTypes";
import { FIXTURE_VISUALS } from "../lib/fixtureVisuals";
import { TABLE_MAP_CELL_PX } from "../../lib/tableShapeLayout";

type Props = {
  fixture: Pick<
    PosFloorFixture,
    "fixture_type" | "name" | "grid_w" | "grid_h" | "rotation"
  >;
  selected?: boolean;
  muted?: boolean;
  className?: string;
};

/** Type-specific floor-plan silhouette (door strip, stair steps, etc.). */
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

  if (fixture.fixture_type === "door") {
    return (
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          className,
        )}
      >
        <span
          className={cn(
            "relative flex items-center justify-center border-2 shadow-sm",
            visual.fillClass,
            visual.borderClass,
            selected && "ring-2 ring-primary/40",
            muted && "opacity-90",
            sideways
              ? "h-full w-[26%] min-w-[8px] max-w-[16px] rounded-sm"
              : "h-[26%] min-h-[8px] max-h-[16px] w-full rounded-sm",
          )}
        >
          <span
            className={cn(
              "truncate px-0.5 text-[9px] font-semibold leading-none text-slate-800",
              sideways && "rotate-90 whitespace-nowrap",
            )}
          >
            {fixture.name}
          </span>
        </span>
      </span>
    );
  }

  if (fixture.fixture_type === "stairs") {
    const steps = Math.max(
      3,
      Math.min(6, Math.round(Math.max(fixture.grid_w, fixture.grid_h) + 1)),
    );
    return (
      <span className={cn("absolute inset-0", muted && "opacity-80", className)}>
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d={buildStairSilhouette(steps)}
            fill="#94a3b8"
            fillOpacity={0.75}
            stroke={selected ? "hsl(var(--primary))" : "#475569"}
            strokeWidth={1.75}
            vectorEffect="non-scaling-stroke"
          />
          {Array.from({ length: steps - 1 }).map((_, i) => {
            const stepW = 100 / steps;
            const x = (i + 1) * stepW;
            const y = 100 - ((i + 1) / steps) * 100;
            return (
              <path
                key={i}
                d={`M ${x} 100 L ${x} ${y} L ${x + stepW} ${y}`}
                fill="none"
                stroke="#475569"
                strokeWidth={1.25}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
        <span
          className={cn(
            "pointer-events-none absolute text-center text-[9px] font-semibold leading-none text-slate-700 drop-shadow-[0_0_2px_rgba(255,255,255,0.9)]",
            sideways
              ? "left-1/2 top-1/2 max-w-[90%] -translate-x-1/2 -translate-y-1/2 -rotate-90 truncate"
              : "bottom-1 left-1/2 max-w-[90%] -translate-x-1/2 truncate",
          )}
          style={
            sideways
              ? {
                  maxWidth: Math.max(
                    24,
                    fixture.grid_h * TABLE_MAP_CELL_PX - 12,
                  ),
                }
              : undefined
          }
        >
          {fixture.name}
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "absolute inset-1 flex items-center justify-center overflow-hidden rounded-md border-2 px-1 text-center shadow-sm",
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

/** Filled stair block rising left → right. */
function buildStairSilhouette(steps: number): string {
  const parts: string[] = ["M 0 100"];
  for (let i = 0; i < steps; i += 1) {
    const x0 = (i / steps) * 100;
    const x1 = ((i + 1) / steps) * 100;
    const yRise = 100 - (i / steps) * 100;
    const yNext = 100 - ((i + 1) / steps) * 100;
    parts.push(`L ${x0} ${yRise}`);
    parts.push(`L ${x1} ${yRise}`);
    parts.push(`L ${x1} ${yNext}`);
  }
  parts.push("L 100 100 Z");
  return parts.join(" ");
}
