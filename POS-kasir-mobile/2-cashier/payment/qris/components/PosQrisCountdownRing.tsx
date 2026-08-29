import { POS_QRIS_TTL_SECONDS } from "../lib/posQrisConstants";

type Props = {
  remainingSeconds: number;
  totalSeconds?: number;
};

export function PosQrisCountdownRing({
  remainingSeconds,
  totalSeconds = POS_QRIS_TTL_SECONDS,
}: Props) {
  const safeTotal = Math.max(1, totalSeconds);
  const clamped = Math.max(0, Math.min(remainingSeconds, safeTotal));
  const progress = clamped / safeTotal;
  const size = 72;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - progress);

  return (
    <div
      className="relative flex h-[72px] w-[72px] items-center justify-center"
      role="timer"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`${clamped}`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-slate-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dashOffset}
          className="text-primary transition-[stroke-dashoffset] duration-1000 linear"
        />
      </svg>
      <span className="absolute text-xl font-bold tabular-nums text-primary">{clamped}</span>
    </div>
  );
}
