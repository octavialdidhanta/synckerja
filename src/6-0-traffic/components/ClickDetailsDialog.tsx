import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { normalizeClickTargetRows } from "@/6-0-traffic/lib/normalizeClickTargetRows";

export function ClickDetailsDialog({
  open,
  onOpenChange,
  webId,
  queryFromDate,
  queryToDate,
  queryDateReady,
  path,
  utm,
  visitorId,
  sessionId,
  sessionDay,
  sourceKey,
  rowKind = "session",
  pageViewId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webId: string;
  queryFromDate: string | null;
  queryToDate: string | null;
  queryDateReady: boolean;
  path: string;
  utm?: {
    route: string | null;
    utm_campaign: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_content: string | null;
    utm_term: string | null;
  };
  visitorId?: string | null;
  sessionId?: string | null;
  sessionDay?: string | null;
  sourceKey?: "utm" | "paid_click_ids" | "referral" | "direct";
  rowKind?: "session" | "journey";
  pageViewId?: string | null;
}) {
  const hasPath = typeof path === "string" && path.trim() !== "";
  const canFetch = Boolean(utm) || Boolean(sourceKey) || hasPath;

  const detailsQuery = useQuery({
    queryKey: [
      "traffic",
      "click-details",
      "desktop",
      webId,
      queryFromDate,
      queryToDate,
      path,
      utm ?? null,
      visitorId ?? null,
      sessionId ?? null,
      sessionDay ?? null,
      sourceKey ?? null,
      rowKind,
      pageViewId ?? null,
    ],
    enabled: Boolean(webId) && open && canFetch && queryDateReady,
    queryFn: async () => {
      if (!queryFromDate || !queryToDate) {
        return [];
      }

      const common = {
        p_web_id: webId,
        p_from: queryFromDate,
        p_to: queryToDate,
        p_limit: 50,
      } as const;

      const utmParams = utm
        ? {
            ...common,
            p_route: utm.route ?? "",
            p_utm_campaign: utm.utm_campaign ?? "",
            p_utm_source: utm.utm_source ?? "",
            p_utm_medium: utm.utm_medium ?? "",
            p_utm_content: utm.utm_content ?? "",
            p_utm_term: utm.utm_term ?? "",
          }
        : null;

      const { data, error } = utmParams
        ? await (async () => {
            if (!visitorId && !sessionId) {
              return supabase.rpc("get_click_targets_for_utm_row", utmParams);
            }

            const scoped = await supabase.rpc("get_click_targets_for_utm_row", {
              ...utmParams,
              p_visitor_id: visitorId ?? null,
              p_session_id: sessionId,
              p_session_day: visitorId ? null : (sessionDay ?? null),
              p_row_kind: rowKind,
              p_page_view_id: pageViewId ?? null,
            });
            if (!scoped.error) return scoped;

            return supabase.rpc("get_click_targets_for_utm_row", utmParams);
          })()
        : sourceKey
          ? await supabase.rpc("get_click_targets_for_source_key", {
              ...common,
              p_source_key: sourceKey,
            })
          : await supabase.rpc("get_click_targets_for_path", {
              ...common,
              p_path: path,
            });
      if (error) throw error;
      return normalizeClickTargetRows(data);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[720px] w-[720px] max-w-none flex-col gap-3 p-4">
        <DialogHeader className="space-y-1">
          <DialogTitle>Detail klik</DialogTitle>
          <div className="text-xs text-gray-500">
            <span className="font-medium text-gray-700">{path || "—"}</span>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          {!queryDateReady ? (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-500">Loading…</div>
          ) : detailsQuery.isLoading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-500">Loading…</div>
          ) : detailsQuery.isError ? (
            <div className="flex flex-1 items-center justify-center text-sm text-red-600">
              Gagal memuat detail klik.
            </div>
          ) : (detailsQuery.data?.length ?? 0) === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-500">Tidak ada data.</div>
          ) : (
            <div className="scrollbar-hide nested-scroll-touch-chain min-h-0 flex-1 overflow-auto rounded-md border border-gray-200 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <table className="w-full min-w-[860px] table-fixed text-xs">
                <thead className="sticky top-0 z-10 bg-gray-50">
                  <tr className="text-left text-gray-600">
                    <th className="w-[90px] px-3 py-2 text-center font-medium">Klik</th>
                    <th className="w-[180px] px-3 py-2 font-medium">Nama klik</th>
                    <th className="w-[160px] px-3 py-2 font-medium">Track key</th>
                    <th className="w-[220px] px-3 py-2 font-medium">Element</th>
                    <th className="w-[280px] px-3 py-2 font-medium">Direct ke</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailsQuery.data ?? []).map((r, idx) => (
                    <tr
                      key={`${r.track_key ?? ""}|${r.element_type}|${r.element_label}|${r.target_url ?? ""}|${idx}`}
                      className="align-top"
                    >
                      <td className="border-t border-gray-100 px-3 py-2 text-center tabular-nums text-gray-700">
                        {Number(r.clicks ?? 0).toLocaleString()}
                      </td>
                      <td className="border-t border-gray-100 px-3 py-2 text-gray-700">Click</td>
                      <td className="border-t border-gray-100 px-3 py-2">
                        <span className="block truncate text-gray-700" title={r.track_key ?? ""}>
                          {r.track_key || "—"}
                        </span>
                      </td>
                      <td className="border-t border-gray-100 px-3 py-2">
                        <span
                          className="block truncate text-gray-700"
                          title={`${r.element_type}${r.element_label ? ` • ${r.element_label}` : ""}`}
                        >
                          {r.element_label || "—"}
                          <span className="text-gray-400">{r.element_type ? ` • ${r.element_type}` : ""}</span>
                        </span>
                      </td>
                      <td className="border-t border-gray-100 px-3 py-2">
                        {r.target_url ? (
                          <a
                            href={r.target_url}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-blue-600 hover:underline"
                            title={r.target_url}
                          >
                            {r.target_url}
                          </a>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
