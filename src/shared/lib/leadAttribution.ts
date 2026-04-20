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
  'utm_source',
  'utm_campaign',
  'utm_medium',
  'utm_content',
  'utm_term',
  'landing_url',
  'attribution_label',
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

type RowWithAttribution = Record<string, string | null | undefined>;

/** Null/empty values sort last for both asc and desc. */
export function sortLeadsByAttributionColumn<T extends RowWithAttribution>(
  rows: T[],
  state: LeadAttributionSortState
): T[] {
  if (!state.column) return rows;
  const dir = state.direction === 'asc' ? 1 : -1;
  const col = state.column;
  const norm = (r: T): string | null => {
    const v = r[col];
    if (v == null) return null;
    const s = String(v).trim();
    return s === '' ? null : s.toLowerCase();
  };
  return [...rows].sort((a, b) => {
    const va = norm(a);
    const vb = norm(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const cmp = va.localeCompare(vb, undefined, { sensitivity: 'base' });
    if (cmp !== 0) return cmp * dir;
    return 0;
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
