import React, { useMemo, useState } from "react";
import { MobileClickDetailsDialog } from "@/mobile/6-0-web-traffic/components/MobileClickDetailsDialog";

type Row = {
  key: string;
  label: string;
  sessions: number;
  page_views: number;
  clicks: number;
};

function displaySource(key: string, label: string) {
  if (key === "utm") return "UTM";
  if (key === "paid_click_ids") return "Paid ads";
  if (key === "referral") return "Referral";
  if (key === "direct") return "Direct";
  return label || key;
}

export function MobileSourceTrafficTableCard({
  loading,
  error,
  rows,
  webId,
  fromDate,
  toDate,
  rangeIsMaximum,
}: {
  loading: boolean;
  error: boolean;
  rows: Row[];
  webId: string;
  fromDate: string | null;
  toDate: string | null;
  rangeIsMaximum: boolean;
}) {
  const [clickDetailsOpen, setClickDetailsOpen] = useState(false);
  const [clickSourceKey, setClickSourceKey] = useState<"utm" | "paid_click_ids" | "referral" | "direct">("utm");
  const [clickSourceLabel, setClickSourceLabel] = useState<string>("");

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        sessions: acc.sessions + r.sessions,
        page_views: acc.page_views + r.page_views,
        clicks: acc.clicks + r.clicks,
      }),
      { sessions: 0, page_views: 0, clicks: 0 },
    );
  }, [rows]);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-gray-200 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">Sumber traffic</h3>
          </div>
        </div>
      </div>

      <div
        data-horizontal-scroll-zone
        className="overflow-x-auto overflow-y-hidden touch-pan-x overscroll-x-contain [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: "pan-x" }}
      >
          <table className="w-full min-w-[520px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs text-gray-600">
                <th className="px-4 py-2 text-left font-medium">Sumber</th>
                <th className="px-4 py-2 text-center font-medium">Sessions</th>
                <th className="px-4 py-2 text-center font-medium">% of total</th>
                <th className="px-4 py-2 text-center font-medium">Page views</th>
                <th className="px-4 py-2 text-center font-medium">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-500">
                    Memuat…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-500">
                    Gagal memuat sumber traffic.
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-500">
                    —
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.key} className="border-b border-gray-100">
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
                          onClick={() => {
                            const key = row.key as "utm" | "paid_click_ids" | "referral" | "direct";
                            setClickSourceKey(key);
                            setClickSourceLabel(displaySource(row.key, row.label));
                            setClickDetailsOpen(true);
                          }}
                          className="w-full font-semibold text-primary hover:underline"
                          aria-label={`Lihat detail klik untuk ${displaySource(row.key, row.label)}`}
                        >
                          {row.clicks.toLocaleString()}
                        </button>
                      ) : (
                        row.clicks.toLocaleString()
                      )}
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
        fromDate={fromDate}
        toDate={toDate}
        rangeIsMaximum={rangeIsMaximum}
        path={clickSourceLabel || "—"}
        sourceKey={clickSourceKey}
      />
    </div>
  );
}

