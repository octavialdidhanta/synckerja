export const STORE_CHECKOUT_ACTIVITY_TYPE = 'Store Checkout';

/** Pipeline types shown under the Sales group (Visit is scheduled, not created from New Activity). */
export const SALES_PIPELINE_ACTIVITY_TYPES = [
  'Demo',
  'Meeting',
  'Call',
  'Proposal',
  'Closing',
  'Lead Conversion',
  'visit',
] as const;

export const STORE_ACTIVITY_TYPES = [STORE_CHECKOUT_ACTIVITY_TYPE] as const;

/** Types selectable in New Activity. Store Checkout and Visit are created elsewhere. */
export const CREATABLE_SALES_ACTIVITY_TYPES = [
  'Demo',
  'Meeting',
  'Call',
  'Proposal',
  'Closing',
  'Lead Conversion',
] as const;

export type SalesActivityTypeTranslate = (key: string, fallback: string) => string;

const TYPE_LABELS: Record<string, { key: string; fallback: string }> = {
  'store checkout': {
    key: 'salesActivities.type.storeCheckout',
    fallback: 'Store checkout',
  },
  'lead conversion': {
    key: 'salesActivities.type.leadConversion',
    fallback: 'Lead Conversion',
  },
  visit: {
    key: 'salesActivities.type.visit',
    fallback: 'Visit',
  },
};

/** Bilingual aliases so search matches regardless of UI language. */
const TYPE_SEARCH_ALIASES: Record<string, readonly string[]> = {
  'store checkout': ['store checkout', 'store', 'kasir toko', 'kasir'],
  'lead conversion': ['lead conversion', 'konversi lead'],
  visit: ['visit', 'kunjungan'],
};

export function normalizeActivityType(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function isStoreCheckoutActivityType(value: string | null | undefined): boolean {
  return normalizeActivityType(value) === 'store checkout';
}

export function isCreatableSalesActivityType(value: string | null | undefined): boolean {
  const n = normalizeActivityType(value);
  return CREATABLE_SALES_ACTIVITY_TYPES.some((type) => normalizeActivityType(type) === n);
}

export function collectActivityTypesFromActivities(
  activities: Array<{ activity_type?: string | null }>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const activity of activities) {
    const type = String(activity.activity_type ?? '').trim();
    if (!type) continue;
    const key = normalizeActivityType(type);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(type);
  }
  return out;
}

export type SalesActivityTypeGroups = {
  sales: string[];
  store: string[];
};

function pushUnique(list: string[], type: string, seen: Set<string>): void {
  const key = normalizeActivityType(type);
  if (!key || seen.has(key)) return;
  seen.add(key);
  list.push(type);
}

/** Canonical Sales / Store groups, plus unknown types from live data so legacy values stay filterable. */
export function mergeActivityTypeGroups(
  fromData: Array<string | null | undefined> = [],
): SalesActivityTypeGroups {
  const sales: string[] = [];
  const store: string[] = [];
  const seen = new Set<string>();

  for (const type of SALES_PIPELINE_ACTIVITY_TYPES) {
    pushUnique(sales, type, seen);
  }
  for (const type of STORE_ACTIVITY_TYPES) {
    pushUnique(store, type, seen);
  }
  for (const raw of fromData) {
    const type = String(raw ?? '').trim();
    if (!type) continue;
    if (isStoreCheckoutActivityType(type)) {
      pushUnique(store, STORE_CHECKOUT_ACTIVITY_TYPE, seen);
      continue;
    }
    pushUnique(sales, type, seen);
  }

  return { sales, store };
}

export function formatActivityTypeLabel(
  type: string | null | undefined,
  t?: SalesActivityTypeTranslate,
): string {
  if (!type?.trim()) return '-';
  const mapped = TYPE_LABELS[normalizeActivityType(type)];
  if (mapped) {
    return t ? t(mapped.key, mapped.fallback) : mapped.fallback;
  }
  return type.replace(/_/g, ' ');
}

export function getActivityTypeColor(type: string | null | undefined): string {
  switch (normalizeActivityType(type)) {
    case 'demo':
      return 'bg-brand-blue-soft text-brand-blue-deep border-brand-blue/25';
    case 'meeting':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'call':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'proposal':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'closing':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'store checkout':
      return 'bg-teal-100 text-teal-800 border-teal-200';
    case 'lead conversion':
    case 'visit':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function activityTypeSearchText(type: string | null | undefined): string {
  const raw = String(type ?? '').trim();
  const aliases = TYPE_SEARCH_ALIASES[normalizeActivityType(raw)] ?? [raw.replace(/_/g, ' ')];
  return [raw, ...aliases].join(' ').toLowerCase();
}
