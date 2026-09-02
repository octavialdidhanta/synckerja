import { cn } from "@/shared/lib/utils";

export type ChairFacing = "top" | "bottom" | "left" | "right";

type Props = {
  facing: ChairFacing;
  className?: string;
  style?: React.CSSProperties;
  /** Width along the table edge (keep readable). Depth stays thin. */
  widthPx?: number;
};

/**
 * Top-down floor-plan chair: wide but thin (shallow depth) seat + backrest.
 * Same edge width as square / rectangle seats.
 */
export const CHAIR_EDGE_WIDTH_PX = 38;
const CHAIR_DEPTH_RATIO = 0.42;

export function chairDepthPx(widthPx: number = CHAIR_EDGE_WIDTH_PX): number {
  const w = Math.max(22, Math.min(40, widthPx));
  return Math.round(w * CHAIR_DEPTH_RATIO);
}

export function TableMapChair({
  facing,
  className,
  style,
  widthPx = CHAIR_EDGE_WIDTH_PX,
}: Props) {
  const rotate =
    facing === "top" ? 0 : facing === "right" ? 90 : facing === "bottom" ? 180 : 270;
  // Wide along edge…
  const w = Math.max(22, Math.min(40, widthPx));
  const h = chairDepthPx(w);

  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute drop-shadow-sm", className)}
      style={{
        width: w,
        height: h,
        transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
        ...style,
      }}
    >
      <svg
        viewBox="0 0 48 20"
        width="100%"
        height="100%"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        {/* Soft shadow — thin strip */}
        <rect x="6" y="16.6" width="36" height="2.2" fill="#64748b" opacity="0.28" />
        {/* Thin backrest (far from table when facing top) */}
        <rect
          x="3"
          y="1"
          width="42"
          height="5"
          fill="#38bdf8"
          stroke="#0369a1"
          strokeWidth="1.2"
        />
        <rect x="6" y="2" width="36" height="2.6" fill="#e0f2fe" opacity="0.95" />
        {/* Wide but thin seat */}
        <rect
          x="2"
          y="7"
          width="44"
          height="9"
          fill="#7dd3fc"
          stroke="#0284c7"
          strokeWidth="1.2"
        />
        <rect
          x="5"
          y="8.5"
          width="38"
          height="5.5"
          stroke="#bae6fd"
          strokeWidth="1"
          strokeDasharray="3 2"
          opacity="0.85"
        />
        {/* Front lip toward table */}
        <path
          d="M4 15.2h40"
          stroke="#0369a1"
          strokeWidth="1.4"
          strokeLinecap="square"
          opacity="0.4"
        />
      </svg>
    </span>
  );
}
