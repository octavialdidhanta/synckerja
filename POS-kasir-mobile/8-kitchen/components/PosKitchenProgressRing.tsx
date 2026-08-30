import type { ReactNode } from "react";

type Props = {
  size?: number;
  progress: number;
  stroke?: string;
  track?: string;
  strokeWidth?: number;
  children?: ReactNode;
};

/** Circular progress ring for SLA timer / readiness %. */
export function PosKitchenProgressRing({
  size = 56,
  progress,
  stroke = "#64748B",
  track = "#E2E8F0",
  strokeWidth = 4,
  children,
}: Props) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = c * (1 - clamped);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}
