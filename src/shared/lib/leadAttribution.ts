export type LeadAttributionFlat = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  landing_url: string | null;
};

const KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'landing_url',
] as const;

function trimToNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function readString(obj: Record<string, unknown>, key: string): string | null {
  return trimToNull(obj[key]);
}

/**
 * Normalizes `leads.attribution` (jsonb or JSON string) into flat string fields for UI/sort/filter.
 */
export function parseAttributionFields(raw: unknown): LeadAttributionFlat {
  const empty: LeadAttributionFlat = {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    landing_url: null,
  };

  let obj: unknown = raw;
  if (obj == null) return empty;
  if (typeof obj === 'string') {
    const t = obj.trim();
    if (!t) return empty;
    try {
      obj = JSON.parse(t) as unknown;
    } catch {
      return empty;
    }
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return empty;
  const rec = obj as Record<string, unknown>;
  return {
    utm_source: readString(rec, 'utm_source'),
    utm_medium: readString(rec, 'utm_medium'),
    utm_campaign: readString(rec, 'utm_campaign'),
    utm_content: readString(rec, 'utm_content'),
    utm_term: readString(rec, 'utm_term'),
    landing_url: readString(rec, 'landing_url'),
  };
}

export function emptyAttributionFlat(): LeadAttributionFlat {
  return {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    landing_url: null,
  };
}

export function isAttributionFlatEmpty(f: LeadAttributionFlat): boolean {
  return KEYS.every((k) => f[k] == null);
}

export const LEAD_ATTRIBUTION_SORT_COLUMNS = [
  "created_at",
  "ticket_id",
  "client",
  "title",
  "services",
  "category",
  "created_by_name",
  "source",
  "utm_source",
  "utm_campaign",
  "utm_medium",
  "utm_content",
  "utm_term",
  "landing_url",
  "attribution_label",
  "gclid",
  "assignee",
  "followup",
  "fu_priority",
  "status",
  "survey_rating",
] as const;

export type LeadAttributionSortColumn = (typeof LEAD_ATTRIBUTION_SORT_COLUMNS)[number];

export type LeadAttributionSortState = {
  column: LeadAttributionSortColumn | null;
  direction: 'asc' | 'desc';
};

export const defaultLeadAttributionSortState: LeadAttributionSortState = {
  column: null,
  direction: 'asc',
};

type SortableLeadRow = Record<string, unknown> & {
  id?: string;
  lead_status?: { name?: string | null } | null;
};

function tieBreakIds(a: SortableLeadRow, b: SortableLeadRow): number {
  return String(a.id ?? "").localeCompare(String(b.id ?? ""));
}

/** Value used for compare; null sorts last for both asc and desc. */
function sortComparable(row: SortableLeadRow, col: LeadAttributionSortColumn): string | number | null {
  switch (col) {
    case "created_at": {
      const raw = row.created_at;
      if (raw == null || String(raw).trim() === "") return null;
      const ms = new Date(String(raw)).getTime();
      return Number.isNaN(ms) ? null : ms;
    }
    case "followup": {
      const n = Number(row.followup ?? 0);
      return Number.isNaN(n) ? 0 : n;
    }
    case "fu_priority": {
      const countRaw = row.followup;
      const count = countRaw == null ? 0 : Number(countRaw);
      const safe = Number.isNaN(count) ? 0 : count;
      const display = safe === 0 ? "please follow up" : String(row.fu_priority ?? "Medium").trim().toLowerCase();
      return display === "" ? null : display;
    }
    case "status": {
      const name =
        row.lead_status && typeof row.lead_status === "object" && row.lead_status !== null && "name" in row.lead_status
          ? String((row.lead_status as { name?: string | null }).name ?? "").trim()
          : "";
      return name === "" ? null : name.toLowerCase();
    }
    case "survey_rating": {
      const raw =
        (row as { latest_survey_rating?: number | null }).latest_survey_rating ??
        (row as { _latest_survey_rating?: number | null })._latest_survey_rating;
      if (raw == null || !Number.isFinite(Number(raw))) return null;
      return Number(raw);
    }
    case "ticket_id":
    case "client":
    case "title":
    case "services":
    case "category":
    case "created_by_name":
    case "source":
    case "utm_source":
    case "utm_campaign":
    case "utm_medium":
    case "utm_content":
    case "utm_term":
    case "landing_url":
    case "attribution_label":
    case "gclid":
    case "assignee": {
      const v = row[col];
      if (v == null) return null;
      const s = String(v).trim();
      return s === "" ? null : s.toLowerCase();
    }
  }
}

/** Null/empty values sort last for both asc and desc. */
export function sortLeadsByAttributionColumn<T extends SortableLeadRow>(
  rows: T[],
  state: LeadAttributionSortState
): T[] {
  if (!state.column) return rows;
  const dir = state.direction === "asc" ? 1 : -1;
  const col = state.column;
  return [...rows].sort((a, b) => {
    const va = sortComparable(a, col);
    const vb = sortComparable(b, col);
    if (va == null && vb == null) return tieBreakIds(a, b);
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "number" && typeof vb === "number") {
      if (va !== vb) return (va - vb) * dir;
      return tieBreakIds(a, b);
    }
    const cmp = String(va).localeCompare(String(vb), undefined, { sensitivity: "base" });
    if (cmp !== 0) return cmp * dir;
    return tieBreakIds(a, b);
  });
}

export type LeadAttributionOptionKey =
  | 'utm_source'
  | 'utm_medium'
  | 'utm_campaign'
  | 'utm_content'
  | 'utm_term'
  | 'attribution_label';

const OPTION_CAP = 100;

export function distinctLeadAttributionValues(
  leads: Array<Record<string, string | null | undefined>>,
  field: LeadAttributionOptionKey
): string[] {
  const set = new Set<string>();
  for (const l of leads) {
    const v = l[field];
    if (v != null && String(v).trim() !== '') set.add(String(v).trim());
  }
  return [...set]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .slice(0, OPTION_CAP);
}
