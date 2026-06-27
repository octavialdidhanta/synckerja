export type SourceBreakdownRow = {
  key: string;
  label: string;
  sessions: number;
  page_views: number;
  clicks: number;
  max_deep_scroll_pct: number | null;
  avg_max_deep_scroll_pct: number | null;
  scroll_sessions: number;
};

export type SourceBreakdownTotals = {
  sessions: number;
  page_views: number;
  clicks: number;
  scroll_sessions: number;
  scroll_sum: number;
  max_deep_scroll_pct: number | null;
};

export function normalizeSourceBreakdownRows(raw: unknown): SourceBreakdownRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => ({
    key: String((r as { key?: unknown }).key ?? ""),
    label: String((r as { label?: unknown }).label ?? ""),
    sessions: Number((r as { sessions?: unknown }).sessions ?? 0),
    page_views: Number((r as { page_views?: unknown }).page_views ?? 0),
    clicks: Number((r as { clicks?: unknown }).clicks ?? 0),
    max_deep_scroll_pct:
      (r as { max_deep_scroll_pct?: unknown }).max_deep_scroll_pct == null
        ? null
        : Number((r as { max_deep_scroll_pct?: unknown }).max_deep_scroll_pct),
    avg_max_deep_scroll_pct:
      (r as { avg_max_deep_scroll_pct?: unknown }).avg_max_deep_scroll_pct == null
        ? null
        : Number((r as { avg_max_deep_scroll_pct?: unknown }).avg_max_deep_scroll_pct),
    scroll_sessions: Number((r as { scroll_sessions?: unknown }).scroll_sessions ?? 0),
  }));
}

export function computeSourceBreakdownTotals(rows: SourceBreakdownRow[]): SourceBreakdownTotals {
  return rows.reduce(
    (acc, r) => {
      const maxDeep = Number(r.max_deep_scroll_pct);
      const avgDeep = Number(r.avg_max_deep_scroll_pct);
      const scrollSessions = Number(r.scroll_sessions ?? 0);
      return {
        sessions: acc.sessions + r.sessions,
        page_views: acc.page_views + r.page_views,
        clicks: acc.clicks + r.clicks,
        scroll_sessions: acc.scroll_sessions + (Number.isFinite(scrollSessions) ? scrollSessions : 0),
        scroll_sum:
          acc.scroll_sum +
          (Number.isFinite(avgDeep) && Number.isFinite(scrollSessions) && scrollSessions > 0
            ? avgDeep * scrollSessions
            : 0),
        max_deep_scroll_pct: Number.isFinite(maxDeep)
          ? Math.max(acc.max_deep_scroll_pct ?? 0, maxDeep)
          : acc.max_deep_scroll_pct,
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
}
