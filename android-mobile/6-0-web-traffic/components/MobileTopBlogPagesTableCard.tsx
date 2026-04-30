import React, { useMemo } from "react";

type TopPageRow = {
  path: string;
  impr: number;
  unique_sessions: number;
  clicks: number;
  median_active_ms: number;
  avg_active_ms: number;
  n: number;
  max_deep_scroll_pct?: number | null;
  avg_max_deep_scroll_pct?: number | null;
  scroll_sessions?: number;
};

function formatDurationMsCompact(ms: number) {
  const safe = Number(ms ?? 0);
  if (!Number.isFinite(safe) || safe <= 0) return "—";

  const totalSeconds = Math.floor(safe / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function formatPct(v: unknown) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n);
  const clamped = Math.max(0, Math.min(100, rounded));
  return `${clamped}%`;
}

export function MobileTopBlogPagesTableCard({
  rows,
  onClickClicks,
}: {
  rows: TopPageRow[];
  onClickClicks: (path: string) => void;
}) {
  const topPagesBlog = useMemo(() => {
    return rows.filter((p) => {
      const path = String((p as { path?: unknown }).path ?? "");
      return path === "/blog" || path.startsWith("/blog/");
    });
  }, [rows]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-primary/35 bg-card shadow-sm">
      <div className="shrink-0 border-b border-primary/25 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">Top blog pages</h3>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 text-xs text-gray-500">
            <span className="whitespace-nowrap">{topPagesBlog.length} items</span>
          </div>
        </div>
      </div>

      {topPagesBlog.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6">
          <p className="text-xs text-gray-500">—</p>
        </div>
      ) : (
        <div
          data-horizontal-scroll-zone
          className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 overflow-x-auto overflow-y-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ touchAction: "pan-x pan-y" }}
        >
          <table className="w-full min-w-[940px] table-fixed text-xs">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="w-[260px] pb-2 pl-2 font-medium">Path</th>
                  <th className="w-[80px] pb-2 text-right font-medium">Impr</th>
                  <th className="w-[86px] pb-2 text-right font-medium">Sesi unik</th>
                  <th className="w-[70px] pb-2 text-right font-medium">Klik</th>
                  <th className="w-[110px] pb-2 text-right font-medium">Median aktif</th>
                  <th className="w-[100px] pb-2 text-right font-medium">Rata-rata</th>
                  <th className="w-[110px] pb-2 text-right font-medium">Max deep</th>
                  <th className="w-[135px] pb-2 text-right font-medium">Avg max deep</th>
                  <th className="w-[60px] pb-2 pr-4 text-right font-medium">n</th>
                </tr>
              </thead>
              <tbody>
                {topPagesBlog.slice(0, 10).map((p) => (
                  <tr key={p.path} className="border-t border-primary/10">
                    <td className="py-2 pl-2 pr-3">
                      <span className="block truncate text-gray-900" title={p.path}>
                        {p.path}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-700">
                      {Number(p.impr ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-700">
                      {Number(p.unique_sessions ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-700">
                      {Number(p.clicks ?? 0) > 0 ? (
                        <button
                          type="button"
                          className="tabular-nums text-blue-600 hover:underline"
                          onClick={() => {
                            const raw = String(p.path ?? "").trim();
                            onClickClicks(raw || "/");
                          }}
                        >
                          {Number(p.clicks ?? 0).toLocaleString()}
                        </button>
                      ) : (
                        Number(p.clicks ?? 0).toLocaleString()
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-700">
                      {formatDurationMsCompact(Number(p.median_active_ms ?? 0))}
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-700">
                      {formatDurationMsCompact(Number(p.avg_active_ms ?? 0))}
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-700">
                      {formatPct(p.max_deep_scroll_pct)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-700">
                      {formatPct(p.avg_max_deep_scroll_pct)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-gray-500">
                      {Number(p.n ?? 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

