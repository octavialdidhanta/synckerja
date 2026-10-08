import { useRef, useState } from "react";
import {
  breakdownMetricKind,
  formatBreakdownDisplay,
  type BreakdownMetricKey,
} from "@/meta-ads/breakdown/metaAdsBreakdownMetrics";
import type { MetaAdsDemographicBucket } from "@/meta-ads/hooks/useMetaAdsDemographicBreakdown";

const Y_TICKS = 5;

type ChartRow = {
  label: string;
  value: number;
};

export function MetaAdsBreakdownChart({
  rows,
  metric,
  color,
  currency,
  labelFor,
  compactLabels = false,
}: {
  rows: MetaAdsDemographicBucket[];
  metric: BreakdownMetricKey;
  color: string;
  currency: string | null;
  labelFor: (key: string) => string;
  compactLabels?: boolean;
}) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ index: number; x: number; y: number } | null>(null);
  const data: ChartRow[] = rows.map((row) => ({
    label: labelFor(row.key),
    value: row[metric],
  }));
  const maxValue = data.reduce((max, row) => Math.max(max, row.value), 0);
  const axisMax = maxValue > 0 ? maxValue * 1.15 : 1;
  const ticks = Array.from({ length: Y_TICKS }, (_, index) => (axisMax * (Y_TICKS - 1 - index)) / (Y_TICKS - 1));
  const activeRow = tip != null ? data[tip.index] : null;
  const placeLeft = tip != null && plotRef.current != null && tip.x > plotRef.current.clientWidth * 0.62;

  return (
    <div className="relative h-[268px] w-full">
      <div className="flex h-full">
        <div className={`flex w-14 shrink-0 flex-col justify-between pr-2 text-right text-[11px] leading-none text-[#65676b] ${compactLabels ? "pb-8" : "pb-11"}`}>
          {ticks.map((tick) => (
            <span key={tick}>
              {formatBreakdownDisplay(metric, tick, currency, breakdownMetricKind(metric) === "currency")}
            </span>
          ))}
        </div>
        <div ref={plotRef} className="relative min-w-0 flex-1">
          <div className={`pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between ${compactLabels ? "bottom-8" : "bottom-11"}`}>
            {ticks.map((tick) => (
              <div key={tick} className="border-t border-[#e5e7eb]" />
            ))}
          </div>
          <div className="absolute inset-0 flex items-stretch">
            {data.map((row, index) => {
              const height = axisMax > 0 ? Math.max(0, Math.min(100, (row.value / axisMax) * 100)) : 0;
              return (
                <div
                  key={row.label}
                  className="flex min-w-0 flex-1 flex-col"
                  onMouseMove={(event) => {
                    const plot = plotRef.current;
                    if (!plot) return;
                    const rect = plot.getBoundingClientRect();
                    setTip({
                      index,
                      x: event.clientX - rect.left,
                      y: event.clientY - rect.top,
                    });
                  }}
                  onMouseLeave={() => setTip(null)}
                >
                  <div className="relative min-h-0 flex-1">
                    <div className="absolute inset-0 flex justify-center">
                      <div className="relative h-full w-[78%]">
                        <span
                          className="absolute inset-x-0 -translate-y-full text-center text-[11px] font-semibold leading-none"
                          style={{ color, bottom: `calc(${height}% + 4px)` }}
                        >
                          {formatBreakdownDisplay(metric, row.value, currency, true)}
                        </span>
                        <div
                          className="absolute inset-x-0 bottom-0 rounded-t-[2px]"
                          style={{
                            height: `${height}%`,
                            backgroundColor: color,
                            minHeight: row.value > 0 ? 2 : 0,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div
                    className={
                      compactLabels
                        ? "flex h-8 shrink-0 items-start justify-center pt-1 text-center text-[9px] leading-3 text-[#65676b]"
                        : "flex h-11 shrink-0 items-start justify-center px-0.5 pt-1.5 text-center text-[10px] leading-[13px] text-[#65676b]"
                    }
                  >
                    <span className={compactLabels ? "w-full whitespace-nowrap" : "line-clamp-3 w-full"}>{row.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {activeRow && tip ? (
            <div
              className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-[#dddfe2] bg-white px-2.5 py-1.5 text-xs shadow-sm"
              style={{
                left: placeLeft ? tip.x - 12 : tip.x + 12,
                top: tip.y,
                transform: placeLeft ? "translate(-100%, -50%)" : "translateY(-50%)",
              }}
            >
              <div className="text-[#65676b]">{activeRow.label}</div>
              <div className="mt-0.5 font-semibold tabular-nums text-[#1c1e21]">
                {formatBreakdownDisplay(metric, activeRow.value, currency, false)}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
