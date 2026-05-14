import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { ArrowLeft, MousePointerClick } from "lucide-react";
import { normalizeClickTargetRows } from "@/6-0-traffic/lib/normalizeClickTargetRows";

export function MobileClickDetailsDialog({
  open,
  onOpenChange,
  webId,
  fromDate,
  toDate,
  rangeIsMaximum,
  path,
  utm,
  visitorId,
  sessionId,
  sessionDay,
  sourceKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webId: string;
  fromDate: string | null;
  toDate: string | null;
  rangeIsMaximum: boolean;
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
}) {
  const isMobile = useIsMobile();
  const hasPath = typeof path === "string" && path.trim() !== "";
  const canFetch = Boolean(utm) || Boolean(sourceKey) || hasPath;

  const detailsQuery = useQuery({
    queryKey: [
      "traffic",
      "click-details",
      "mobile",
      webId,
      fromDate,
      toDate,
      path,
      utm ?? null,
      visitorId ?? null,
      sessionId ?? null,
      sessionDay ?? null,
      sourceKey ?? null,
    ],
    enabled: Boolean(webId) && open && canFetch,
    queryFn: async () => {
      const common = {
        p_web_id: webId,
        p_from: rangeIsMaximum ? null : fromDate,
        p_to: rangeIsMaximum ? null : toDate,
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
      <DialogContent
        fullscreenAnimation={isMobile}
        hideCloseButton
        overlayClassName="modal-overlay-above-safe-area"
        className="fixed left-0 right-0 top-0 z-50 w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-background p-0 shadow-none modal-above-safe-area flex h-full flex-col gap-0 sm:rounded-none"
      >
        <DialogHeader className="safe-area-top flex flex-shrink-0 flex-row flex-nowrap items-stretch gap-0 space-y-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 px-0 py-0 text-left dark:from-blue-950/20 dark:to-indigo-950/20">
          <div className="flex w-full min-w-0 items-center gap-1.5 px-3 py-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="-ml-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-0"
              aria-label="Close"
            >
              <ArrowLeft className="block h-4 w-4 shrink-0 translate-y-px" aria-hidden />
            </button>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <MousePointerClick className="block h-4 w-4 shrink-0" aria-hidden />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <DialogTitle className="m-0 flex min-h-0 min-w-0 items-center truncate py-0 pr-1 text-base font-semibold leading-tight">
                Detail klik
              </DialogTitle>
              <div className="min-w-0 truncate text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">{path || "—"}</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll">
          <div className="mx-auto w-full max-w-md px-2 pb-4 pt-2">
            {detailsQuery.isLoading ? (
              <div className="rounded-xl border bg-card p-4 text-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : detailsQuery.isError ? (
              <div className="rounded-xl border bg-card p-4 text-center text-sm text-destructive">
                Gagal memuat detail klik.
              </div>
            ) : (detailsQuery.data?.length ?? 0) === 0 ? (
              <div className="rounded-xl border bg-card p-4 text-center text-sm text-muted-foreground">
                Tidak ada data.
              </div>
            ) : (
              <div
                className="rounded-xl border bg-card"
                data-horizontal-scroll-zone
              >
                <div className="border-b px-3 py-2 text-sm font-semibold text-foreground">
                  {`Total baris: ${(detailsQuery.data?.length ?? 0).toLocaleString()}`}
                </div>
                <div
                  className="scrollbar-hide overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  style={{ touchAction: "pan-x" }}
                  data-horizontal-scroll-zone
                >
                  <table className="min-w-[860px] w-full table-fixed text-xs">
                    <thead className="sticky top-0 z-10 bg-muted/40">
                      <tr className="text-left text-muted-foreground">
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
                          <td className="border-t px-3 py-2 text-center tabular-nums text-foreground">
                            {Number(r.clicks ?? 0).toLocaleString()}
                          </td>
                          <td className="border-t px-3 py-2 text-foreground">Click</td>
                          <td className="border-t px-3 py-2">
                            <span className="block truncate text-foreground" title={r.track_key ?? ""}>
                              {r.track_key || "—"}
                            </span>
                          </td>
                          <td className="border-t px-3 py-2">
                            <span
                              className="block truncate text-foreground"
                              title={`${r.element_type}${r.element_label ? ` • ${r.element_label}` : ""}`}
                            >
                              {r.element_label || "—"}
                              <span className="text-muted-foreground">
                                {r.element_type ? ` • ${r.element_type}` : ""}
                              </span>
                            </span>
                          </td>
                          <td className="border-t px-3 py-2">
                            {r.target_url ? (
                              <a
                                href={r.target_url}
                                target="_blank"
                                rel="noreferrer"
                                className="block truncate text-primary hover:underline"
                                title={r.target_url}
                              >
                                {r.target_url}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

