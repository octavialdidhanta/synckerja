import React, { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/mobile-app/components/ui/drawer";
import { MobileClickDetailsDialog } from "@/mobile/6-0-web-traffic/components/MobileClickDetailsDialog";

type UtmRow = {
  visit_key?: string | null;
  visitor_id?: string | null;
  session_id?: string | null;
  day?: string | null;
  occurred_at?: string | null;
  time_label?: string | null;
  route: string | null;
  utm_campaign: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  utm_term: string | null;
  /** Page views attributed to sessions in this UTM bucket (rollup). */
  page_views: number;
  /** Click events attributed to sessions in this UTM bucket (rollup). */
  clicks: number;
  max_deep_scroll_pct?: number | null;
  avg_max_deep_scroll_pct?: number | null;
  scroll_sessions?: number;
};

type UtmFilterKey = "route" | "utm_campaign" | "utm_source" | "utm_medium" | "utm_content" | "utm_term";

type SortableColumn =
  | "occurred_at"
  | UtmFilterKey
  | "page_views"
  | "clicks"
  | "max_deep_scroll_pct"
  | "avg_max_deep_scroll_pct";

type UtmFilters = Record<UtmFilterKey, string>;

const FILTER_ALL = "__all__";
const FILTER_EMPTY = "__empty__";

const allFilters: UtmFilters = {
  route: FILTER_ALL,
  utm_campaign: FILTER_ALL,
  utm_source: FILTER_ALL,
  utm_medium: FILTER_ALL,
  utm_content: FILTER_ALL,
  utm_term: FILTER_ALL,
};

function show(v: unknown): string {
  const s = String(v ?? "").trim();
  return s || "—";
}

function cellRaw(v: unknown): string {
  return String(v ?? "").trim();
}

function distinctColumn(rows: UtmRow[], key: UtmFilterKey): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    set.add(cellRaw(r[key]));
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function matchesSelect(value: unknown, filter: string): boolean {
  if (filter === FILTER_ALL) return true;
  if (filter === FILTER_EMPTY) return cellRaw(value) === "";
  return cellRaw(value) === filter;
}

function sanitizeFilter(filter: string, options: string[]): string {
  if (filter === FILTER_ALL) return FILTER_ALL;
  if (filter === FILTER_EMPTY && options.includes("")) return FILTER_EMPTY;
  if (options.includes(filter)) return filter;
  return FILTER_ALL;
}

function compareUtmRows(a: UtmRow, b: UtmRow, key: SortableColumn, dir: "asc" | "desc"): number {
  const m = dir === "asc" ? 1 : -1;
  if (key === "occurred_at") {
    const av = Date.parse(cellRaw(a.occurred_at));
    const bv = Date.parse(cellRaw(b.occurred_at));
    const safeA = Number.isFinite(av) ? av : -1;
    const safeB = Number.isFinite(bv) ? bv : -1;
    return (safeA - safeB) * m;
  }
  if (key === "page_views") {
    return (a.page_views - b.page_views) * m;
  }
  if (key === "clicks") {
    return (a.clicks - b.clicks) * m;
  }
  if (key === "max_deep_scroll_pct") {
    return (Number(a.max_deep_scroll_pct ?? -1) - Number(b.max_deep_scroll_pct ?? -1)) * m;
  }
  if (key === "avg_max_deep_scroll_pct") {
    return (Number(a.avg_max_deep_scroll_pct ?? -1) - Number(b.avg_max_deep_scroll_pct ?? -1)) * m;
  }
  const va = cellRaw(a[key]);
  const vb = cellRaw(b[key]);
  return va.localeCompare(vb, undefined, { sensitivity: "base", numeric: true }) * m;
}

function formatPct(v: unknown) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n);
  const clamped = Math.max(0, Math.min(100, rounded));
  return `${clamped}%`;
}

function formatUtmTime(row: UtmRow): string {
  const label = cellRaw(row.time_label);
  if (label) return label;

  const raw = cellRaw(row.occurred_at);
  if (!raw) return show(row.day);

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

type SortableThProps = {
  column: SortableColumn;
  label: string;
  sortKey: SortableColumn | null;
  sortDir: "asc" | "desc";
  onSort: (column: SortableColumn) => void;
  align?: "left" | "right";
  className?: string;
};

function SortableTh({ column, label, sortKey, sortDir, onSort, align = "left", className }: SortableThProps) {
  const active = sortKey === column;
  return (
    <th
      className={cn(
        "border-b border-primary/15 bg-gray-50 font-medium",
        align === "left" && "text-left",
        align === "right" && "text-right",
        className,
      )}
    >
      <button
        type="button"
        className={cn(
          "flex w-full min-w-0 items-center gap-1 px-3 py-2 text-xs text-gray-600 hover:bg-gray-100/90",
          align === "right" && "justify-end",
        )}
        onClick={() => onSort(column)}
        aria-label={`Urutkan berdasarkan ${label}`}
      >
        <span className="truncate">{label}</span>
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 shrink-0 text-gray-900" strokeWidth={2.5} aria-hidden />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 shrink-0 text-gray-900" strokeWidth={2.5} aria-hidden />
          )
        ) : (
          <span className="inline-flex shrink-0 flex-col leading-none text-gray-400" aria-hidden>
            <ArrowUp className="h-2.5 w-2.5 -mb-px" strokeWidth={2} />
            <ArrowDown className="h-2.5 w-2.5" strokeWidth={2} />
          </span>
        )}
      </button>
    </th>
  );
}

type UtmColumnSelectProps = {
  "aria-label": string;
  value: string;
  onValueChange: (v: string) => void;
  options: string[];
};

export type UtmTableMetricsSlice = {
  utmFiltersActive: boolean;
  /** Session count equals the number of UTM rows that pass column filters. */
  filteredSessionsSum: number;
  filteredPageViewsSum: number;
  filteredClicksSum: number;
};

function UtmColumnSelect({ "aria-label": ariaLabel, value, onValueChange, options }: UtmColumnSelectProps) {
  const hasEmpty = options.includes("");
  const nonEmpty = options.filter((o) => o !== "");
  const [open, setOpen] = useState(false);

  const label = useMemo(() => {
    if (value === FILTER_ALL) return "Semua";
    if (value === FILTER_EMPTY) return "(kosong)";
    return value.trim() ? value : "—";
  }, [value]);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-primary/25 bg-white px-2 text-xs text-gray-700"
          aria-label={ariaLabel}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
        </button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[85dvh] flex flex-col">
        <DrawerHeader className="text-left pb-2 safe-area-top">
          <DrawerTitle className="text-base">{ariaLabel}</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 pb-3">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                onValueChange(FILTER_ALL);
                setOpen(false);
              }}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 truncate text-sm font-medium text-foreground">Semua</div>
                {value === FILTER_ALL ? <Check className="h-4 w-4 text-primary" aria-hidden /> : null}
              </div>
            </button>

            {hasEmpty ? (
              <button
                type="button"
                onClick={() => {
                  onValueChange(FILTER_EMPTY);
                  setOpen(false);
                }}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 truncate text-sm font-medium text-foreground">(kosong)</div>
                  {value === FILTER_EMPTY ? <Check className="h-4 w-4 text-primary" aria-hidden /> : null}
                </div>
              </button>
            ) : null}

            {nonEmpty.map((o) => {
              const active = value === o;
              const shown = o.length > 64 ? `${o.slice(0, 61)}…` : o;
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => {
                    onValueChange(o);
                    setOpen(false);
                  }}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 truncate text-sm font-medium text-foreground" title={o}>
                      {shown || "—"}
                    </div>
                    {active ? <Check className="h-4 w-4 text-primary" aria-hidden /> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function MobileUtmTrackingTable({
  rows,
  onUtmTableMetricsSliceChange,
  webId,
  fromDate,
  toDate,
  rangeIsMaximum,
}: {
  rows: UtmRow[];
  onUtmTableMetricsSliceChange?: (slice: UtmTableMetricsSlice) => void;
  webId: string;
  fromDate: string | null;
  toDate: string | null;
  rangeIsMaximum: boolean;
}) {
  const [filters, setFilters] = useState<UtmFilters>(allFilters);
  const [sortKey, setSortKey] = useState<SortableColumn | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [clickDetailsOpen, setClickDetailsOpen] = useState(false);
  const [clickDetailsPath, setClickDetailsPath] = useState<string>("");
  const [clickDetailsVisitorId, setClickDetailsVisitorId] = useState<string | null>(null);
  const [clickDetailsSessionId, setClickDetailsSessionId] = useState<string | null>(null);
  const [clickDetailsSessionDay, setClickDetailsSessionDay] = useState<string | null>(null);
  const [clickDetailsUtm, setClickDetailsUtm] = useState<{
    route: string | null;
    utm_campaign: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_content: string | null;
    utm_term: string | null;
  } | null>(null);

  const routeOptions = useMemo(() => distinctColumn(rows, "route"), [rows]);
  const campaignOptions = useMemo(() => distinctColumn(rows, "utm_campaign"), [rows]);
  const sourceOptions = useMemo(() => distinctColumn(rows, "utm_source"), [rows]);
  const mediumOptions = useMemo(() => distinctColumn(rows, "utm_medium"), [rows]);
  const contentOptions = useMemo(() => distinctColumn(rows, "utm_content"), [rows]);
  const termOptions = useMemo(() => distinctColumn(rows, "utm_term"), [rows]);

  useEffect(() => {
    setFilters((f) => ({
      route: sanitizeFilter(f.route, routeOptions),
      utm_campaign: sanitizeFilter(f.utm_campaign, campaignOptions),
      utm_source: sanitizeFilter(f.utm_source, sourceOptions),
      utm_medium: sanitizeFilter(f.utm_medium, mediumOptions),
      utm_content: sanitizeFilter(f.utm_content, contentOptions),
      utm_term: sanitizeFilter(f.utm_term, termOptions),
    }));
  }, [rows, routeOptions, campaignOptions, sourceOptions, mediumOptions, contentOptions, termOptions]);

  const filteredRows = useMemo(() => {
    return rows.filter(
      (r) =>
        matchesSelect(r.route, filters.route) &&
        matchesSelect(r.utm_campaign, filters.utm_campaign) &&
        matchesSelect(r.utm_source, filters.utm_source) &&
        matchesSelect(r.utm_medium, filters.utm_medium) &&
        matchesSelect(r.utm_content, filters.utm_content) &&
        matchesSelect(r.utm_term, filters.utm_term),
    );
  }, [rows, filters]);

  const sortedFilteredRows = useMemo(() => {
    if (!sortKey) return filteredRows;
    return [...filteredRows].sort((a, b) => compareUtmRows(a, b, sortKey, sortDir));
  }, [filteredRows, sortKey, sortDir]);

  useEffect(() => {
    if (!onUtmTableMetricsSliceChange) return;
    const utmFiltersActive = Object.values(filters).some((v) => v !== FILTER_ALL);
    const filteredSessionsSum = filteredRows.length;
    const filteredPageViewsSum = filteredRows.reduce((s, r) => s + r.page_views, 0);
    const filteredClicksSum = filteredRows.reduce((s, r) => s + r.clicks, 0);
    onUtmTableMetricsSliceChange({
      utmFiltersActive,
      filteredSessionsSum,
      filteredPageViewsSum,
      filteredClicksSum,
    });
  }, [filters, filteredRows, onUtmTableMetricsSliceChange]);

  function handleSort(column: SortableColumn) {
    if (sortKey !== column) {
      setSortKey(column);
      setSortDir("asc");
      return;
    }
    if (sortDir === "asc") {
      setSortDir("desc");
      return;
    }
    setSortKey(null);
    setSortDir("asc");
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== FILTER_ALL);

  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-primary/35 bg-card shadow-sm">
      <div className="shrink-0 border-b border-primary/25 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">UTM tracking</h3>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 text-xs text-gray-500">
            <span className="whitespace-nowrap">
              {sortedFilteredRows.length === rows.length
                ? `${rows.length} rows`
                : `${sortedFilteredRows.length} of ${rows.length} rows`}
            </span>
            {hasActiveFilters || sortKey !== null ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setFilters(allFilters);
                  setSortKey(null);
                  setSortDir("asc");
                }}
              >
                Reset filter
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div
        data-horizontal-scroll-zone
        className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-[260px] max-h-[min(56dvh,460px)] w-full overflow-x-auto overflow-y-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [@media(max-height:760px)]:min-h-[220px] [@media(max-height:760px)]:max-h-[min(50dvh,380px)]"
        style={{ touchAction: "pan-x pan-y" }}
      >
        <table className="min-w-[1590px] w-full table-fixed border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-card shadow-sm">
            <tr className="text-xs text-gray-600">
              <SortableTh
                column="occurred_at"
                label="waktu"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                className="w-[180px]"
              />
              <SortableTh
                column="route"
                label="route"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                className="w-[200px]"
              />
              <SortableTh
                column="utm_campaign"
                label="utm_campaign"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                className="w-[220px]"
              />
              <SortableTh
                column="utm_source"
                label="utm_source"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                className="w-[170px]"
              />
              <SortableTh
                column="utm_medium"
                label="utm_medium"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                className="w-[160px]"
              />
              <SortableTh
                column="utm_content"
                label="utm_content"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                className="w-[180px]"
              />
              <SortableTh
                column="utm_term"
                label="utm_term"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                className="w-[160px]"
              />
              <SortableTh
                column="page_views"
                label="page_views"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                align="right"
                className="w-[96px]"
              />
              <SortableTh
                column="clicks"
                label="clicks"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                align="right"
                className="w-[86px]"
              />
              <SortableTh
                column="max_deep_scroll_pct"
                label="max_deep_scroll"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                align="right"
                className="w-[110px]"
              />
              <SortableTh
                column="avg_max_deep_scroll_pct"
                label="avg_max_deep_scroll"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                align="right"
                className="w-[135px]"
              />
            </tr>
            <tr className="bg-gray-50/80">
              <th className="border-b border-primary/15 px-2 py-1.5 align-bottom" aria-hidden />
              <th className="border-b border-primary/15 px-2 py-1.5 align-bottom font-normal">
                <UtmColumnSelect
                  aria-label="Filter route"
                  value={filters.route}
                  onValueChange={(v) => setFilters((f) => ({ ...f, route: v }))}
                  options={routeOptions}
                />
              </th>
              <th className="border-b border-primary/15 px-2 py-1.5 align-bottom font-normal">
                <UtmColumnSelect
                  aria-label="Filter utm_campaign"
                  value={filters.utm_campaign}
                  onValueChange={(v) => setFilters((f) => ({ ...f, utm_campaign: v }))}
                  options={campaignOptions}
                />
              </th>
              <th className="border-b border-primary/15 px-2 py-1.5 align-bottom font-normal">
                <UtmColumnSelect
                  aria-label="Filter utm_source"
                  value={filters.utm_source}
                  onValueChange={(v) => setFilters((f) => ({ ...f, utm_source: v }))}
                  options={sourceOptions}
                />
              </th>
              <th className="border-b border-primary/15 px-2 py-1.5 align-bottom font-normal">
                <UtmColumnSelect
                  aria-label="Filter utm_medium"
                  value={filters.utm_medium}
                  onValueChange={(v) => setFilters((f) => ({ ...f, utm_medium: v }))}
                  options={mediumOptions}
                />
              </th>
              <th className="border-b border-primary/15 px-2 py-1.5 align-bottom font-normal">
                <UtmColumnSelect
                  aria-label="Filter utm_content"
                  value={filters.utm_content}
                  onValueChange={(v) => setFilters((f) => ({ ...f, utm_content: v }))}
                  options={contentOptions}
                />
              </th>
              <th className="border-b border-primary/15 px-2 py-1.5 align-bottom font-normal">
                <UtmColumnSelect
                  aria-label="Filter utm_term"
                  value={filters.utm_term}
                  onValueChange={(v) => setFilters((f) => ({ ...f, utm_term: v }))}
                  options={termOptions}
                />
              </th>
              <th className="border-b border-primary/15 px-2 py-1.5 align-bottom" aria-hidden />
              <th className="border-b border-primary/15 px-2 py-1.5 align-bottom" aria-hidden />
              <th className="border-b border-primary/15 px-2 py-1.5 align-bottom" aria-hidden />
              <th className="border-b border-primary/15 px-2 py-1.5 align-bottom" aria-hidden />
            </tr>
          </thead>
          <tbody className="text-sm">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-sm text-gray-500">
                  Belum ada data UTM.
                </td>
              </tr>
            ) : sortedFilteredRows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-sm text-gray-500">
                  Tidak ada baris yang cocok dengan filter.
                </td>
              </tr>
            ) : (
              sortedFilteredRows.map((r) => {
                return (
                  <tr
                    key={[
                      r.visit_key ?? "",
                      r.visitor_id ?? "",
                      r.session_id ?? "",
                      r.occurred_at ?? "",
                      r.day ?? "",
                      r.route ?? "",
                      r.utm_campaign ?? "",
                      r.utm_source ?? "",
                      r.utm_medium ?? "",
                      r.utm_content ?? "",
                      r.utm_term ?? "",
                    ].join("|")}
                  >
                    <td className="border-b border-gray-100 px-3 py-2 truncate text-gray-700" title={formatUtmTime(r)}>
                      {formatUtmTime(r)}
                    </td>
                    <td className="border-b border-gray-100 px-3 py-2 truncate" title={show(r.route)}>
                      {show(r.route)}
                    </td>
                    <td className="border-b border-gray-100 px-3 py-2 truncate" title={show(r.utm_campaign)}>
                      {show(r.utm_campaign)}
                    </td>
                    <td className="border-b border-gray-100 px-3 py-2 truncate" title={show(r.utm_source)}>
                      {show(r.utm_source)}
                    </td>
                    <td className="border-b border-gray-100 px-3 py-2 truncate" title={show(r.utm_medium)}>
                      {show(r.utm_medium)}
                    </td>
                    <td className="border-b border-gray-100 px-3 py-2 truncate" title={show(r.utm_content)}>
                      {show(r.utm_content)}
                    </td>
                    <td className="border-b border-gray-100 px-3 py-2 truncate" title={show(r.utm_term)}>
                      {show(r.utm_term)}
                    </td>
                    <td className="border-b border-gray-100 px-3 py-2 text-right tabular-nums text-gray-700">
                      {r.page_views.toLocaleString()}
                    </td>
                    <td className="border-b border-gray-100 px-3 py-2 text-right tabular-nums text-gray-700">
                      <button
                        type="button"
                        onClick={() => {
                          const path = cellRaw(r.route) || "/";
                          setClickDetailsPath(path);
                          setClickDetailsVisitorId(cellRaw(r.visitor_id) || null);
                          setClickDetailsSessionId(cellRaw(r.session_id) || null);
                          setClickDetailsSessionDay(cellRaw(r.day) || null);
                          setClickDetailsUtm({
                            route: r.route ?? null,
                            utm_campaign: r.utm_campaign ?? null,
                            utm_source: r.utm_source ?? null,
                            utm_medium: r.utm_medium ?? null,
                            utm_content: r.utm_content ?? null,
                            utm_term: r.utm_term ?? null,
                          });
                          setClickDetailsOpen(true);
                        }}
                        className="w-full text-right font-semibold text-primary hover:underline"
                        aria-label={`Lihat detail klik untuk ${show(r.route)}`}
                      >
                        {r.clicks.toLocaleString()}
                      </button>
                    </td>
                    <td className="border-b border-gray-100 px-3 py-2 text-right tabular-nums text-gray-700">
                      {formatPct(r.max_deep_scroll_pct)}
                    </td>
                    <td className="border-b border-gray-100 px-3 py-2 text-right tabular-nums text-gray-700">
                      {formatPct(r.avg_max_deep_scroll_pct)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <MobileClickDetailsDialog
        open={clickDetailsOpen}
        onOpenChange={(open) => {
          setClickDetailsOpen(open);
          if (!open) {
            setClickDetailsPath("");
            setClickDetailsVisitorId(null);
            setClickDetailsSessionId(null);
            setClickDetailsSessionDay(null);
            setClickDetailsUtm(null);
          }
        }}
        webId={webId}
        fromDate={fromDate}
        toDate={toDate}
        rangeIsMaximum={rangeIsMaximum}
        path={clickDetailsPath}
        utm={clickDetailsUtm ?? undefined}
        visitorId={clickDetailsVisitorId}
        sessionId={clickDetailsSessionId}
        sessionDay={clickDetailsSessionDay}
      />
    </div>
  );
}

