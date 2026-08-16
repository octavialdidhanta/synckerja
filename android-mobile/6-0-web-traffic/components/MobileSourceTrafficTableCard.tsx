import React, { useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { MobileClickDetailsDialog } from "@/mobile/6-0-web-traffic/components/MobileClickDetailsDialog";
import { trafficDashboardErrorHint } from "@/6-0-traffic/lib/trafficDashboardErrorHint";

type Row = {
  key: string;
  label: string;
  sessions: number;
  page_views: number;
  clicks: number;
  max_deep_scroll_pct?: number | null;
  avg_max_deep_scroll_pct?: number | null;
  scroll_sessions?: number;
};

function displaySource(key: string, label: string) {
  if (key === "utm") return "UTM";
  if (key === "paid_click_ids") return "Paid ads";
  if (key === "referral") return "Referral";
  if (key === "direct") return "Direct";
  return label || key;
}

function formatPct(v: unknown) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n);
  const clamped = Math.max(0, Math.min(100, rounded));
  return `${clamped}%`;
}

export function MobileSourceTrafficTableCard({
  loading,
  error,
  errorDetail,
  onRetry,
  rows,
  webId,
  queryFromDate,
  queryToDate,
  queryDateReady,
}: {
  loading: boolean;
  error: boolean;
  errorDetail?: unknown;
  onRetry?: () => void;
  rows: Row[];
  webId: string;
  queryFromDate: string | null;
  queryToDate: string | null;
  queryDateReady: boolean;
}) {
  const [clickDetailsOpen, setClickDetailsOpen] = useState(false);
  const [clickSourceKey, setClickSourceKey] = useState<"utm" | "paid_click_ids" | "referral" | "direct">("utm");
  const [clickSourceLabel, setClickSourceLabel] = useState<string>("");

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        const scrollSessions = Number(r.scroll_sessions ?? 0);
        const avgDeep = Number(r.avg_max_deep_scroll_pct);
        const maxDeep = Number(r.max_deep_scroll_pct);
        return {
          sessions: acc.sessions + r.sessions,
          page_views: acc.page_views + r.page_views,
          clicks: acc.clicks + r.clicks,
          scroll_sessions: acc.scroll_sessions + (Number.isFinite(scrollSessions) ? scrollSessions : 0),
          scroll_sum:
            acc.scroll_sum +
            (Number.isFinite(avgDeep) && Number.isFinite(scrollSessions) && scrollSessions > 0 ? avgDeep * scrollSessions : 0),
          max_deep_scroll_pct:
            Number.isFinite(maxDeep) ? Math.max(acc.max_deep_scroll_pct ?? 0, maxDeep) : acc.max_deep_scroll_pct,
        };
      },
      {
        sessions: 0,
        page_views: 0,
        clicks: 0,
        scroll_sessions: 0,
        scroll_sum: 0,
        max_deep_scroll_pct: null as number | null,
      },
    );
  }, [rows]);

  const errorHint = error ? trafficDashboardErrorHint(errorDetail) : null;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">Sumber traffic</h3>
          </div>
        </div>
      </div>

      <div
        data-horizontal-scroll-zone
        className="overflow-x-auto overflow-y-hidden overscroll-x-contain [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: "pan-x pan-y" }}
      >
          <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50 text-xs text-gray-600">
                <th className="w-[160px] px-4 py-2 text-left font-medium">Sumber</th>
                <th className="w-[90px] px-4 py-2 text-center font-medium">Sessions</th>
                <th className="w-[90px] px-4 py-2 text-center font-medium">% of total</th>
                <th className="w-[96px] px-4 py-2 text-center font-medium">Page views</th>
                <th className="w-[86px] px-4 py-2 text-center font-medium">Clicks</th>
                <th className="w-[110px] px-4 py-2 text-center font-medium">Max deep</th>
                <th className="w-[135px] px-4 py-2 text-center font-medium">Avg max deep</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-xs text-gray-500">
                    Memuat…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-xs text-gray-500">
                    <p className="font-medium text-gray-700">Gagal memuat sumber traffic.</p>
                    {errorHint ? (
                      <p className="mx-auto mt-2 max-w-xl text-[11px] leading-snug text-gray-500">{errorHint}</p>
                    ) : null}
                    {onRetry ? (
                      <div className="mt-3">
                        <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => void onRetry()}>
                          Coba lagi
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-xs text-gray-500">
                    —
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.key} className="border-b border-border/60">
                    <td className="px-4 py-2.5 text-left text-gray-900">{displaySource(row.key, row.label)}</td>
                    <td className="px-4 py-2.5 text-center tabular-nums text-gray-800">
                      {row.sessions.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-center tabular-nums text-gray-700">
                      {totals.sessions > 0 ? `${Math.round((row.sessions / totals.sessions) * 1000) / 10}%` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center tabular-nums text-gray-800">
                      {row.page_views.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-center tabular-nums text-gray-800">
                      {row.key === "utm" || row.key === "paid_click_ids" || row.key === "referral" || row.key === "direct" ? (
                        <button
                          type="button"
                          disabled={!queryDateReady || row.clicks <= 0}
                          onClick={() => {
                            const key: "utm" | "paid_click_ids" | "referral" | "direct" =
                              row.key === "utm" ||
                              row.key === "paid_click_ids" ||
                              row.key === "referral" ||
                              row.key === "direct"
                                ? row.key
                                : "utm";
                            const label =
                              row.key === "utm"
                                ? "UTM"
                                : row.key === "paid_click_ids"
                                  ? "Paid ads"
                                  : row.key === "referral"
                                    ? "Referral"
                                    : row.key === "direct"
                                      ? "Direct"
                                      : row.label || row.key;
                            setClickSourceKey(key);
                            setClickSourceLabel(label);
                            setClickDetailsOpen(true);
                          }}
                          className="w-full font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
                          aria-label={`Lihat detail klik untuk ${displaySource(row.key, row.label)}`}
                        >
                          {row.clicks.toLocaleString()}
                        </button>
                      ) : (
                        row.clicks.toLocaleString()
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center tabular-nums text-gray-800">
                      {formatPct(row.max_deep_scroll_pct)}
                    </td>
                    <td className="px-4 py-2.5 text-center tabular-nums text-gray-800">
                      {formatPct(row.avg_max_deep_scroll_pct)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && !error && rows.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50/80 text-xs font-medium text-gray-800">
                  <td className="px-4 py-2 text-left">Total</td>
                  <td className="px-4 py-2 text-center tabular-nums">{totals.sessions.toLocaleString()}</td>
                  <td className="px-4 py-2 text-center tabular-nums">100%</td>
                  <td className="px-4 py-2 text-center tabular-nums">{totals.page_views.toLocaleString()}</td>
                  <td className="px-4 py-2 text-center tabular-nums">{totals.clicks.toLocaleString()}</td>
                  <td className="px-4 py-2 text-center tabular-nums">{formatPct(totals.max_deep_scroll_pct)}</td>
                  <td className="px-4 py-2 text-center tabular-nums">
                    {totals.scroll_sessions > 0 ? formatPct(totals.scroll_sum / totals.scroll_sessions) : "—"}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
      </div>

      <MobileClickDetailsDialog
        open={clickDetailsOpen}
        onOpenChange={(open) => {
          setClickDetailsOpen(open);
        }}
        webId={webId}
        queryFromDate={queryFromDate}
        queryToDate={queryToDate}
        queryDateReady={queryDateReady}
        path={clickSourceLabel || "—"}
        sourceKey={clickSourceKey}
      />
    </div>
  );
}
