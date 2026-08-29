import { supabase } from '@/shared/lib/supabaseClient';

export type CatalogGratuityMeta = {
  gratuityId: string;
  name: string;
  amountPercent: number;
  sortOrder: number;
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function gratuityMatchKey(name: string, amountPercent: number): string {
  const rounded = Math.round(amountPercent * 100) / 100;
  return `${normalizeName(name)}::${rounded}`;
}

export function buildGratuityRateLabel(amountPercent: number): string {
  if (!Number.isFinite(amountPercent) || amountPercent <= 0) return '—';
  const rounded = Math.round(amountPercent * 100) / 100;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2)}%`;
}

/** Resolve catalog gratuity metadata for checkout persistence, scoped to outlet. */
export async function loadCatalogGratuityMetaForOutlet(args: {
  orgId: string;
  outletId: string;
}): Promise<Map<string, CatalogGratuityMeta>> {
  const map = new Map<string, CatalogGratuityMeta>();

  const { data, error } = await supabase
    .from('catalog_gratuities')
    .select(
      'id, name, amount_percent, sort_order, is_active, catalog_gratuity_outlets!inner(outlet_id)',
    )
    .eq('organization_id', args.orgId)
    .eq('is_active', true)
    .eq('catalog_gratuity_outlets.outlet_id', args.outletId);

  if (error) throw error;

  for (const row of data ?? []) {
    const name = String(row.name ?? '').trim() || 'Unknown';
    const amountPercent = Number(row.amount_percent) || 0;
    const meta: CatalogGratuityMeta = {
      gratuityId: String(row.id),
      name,
      amountPercent,
      sortOrder: Math.round(Number(row.sort_order) || 9999),
    };
    map.set(gratuityMatchKey(name, amountPercent), meta);
  }

  return map;
}

export function resolveCatalogGratuityMeta(args: {
  gratuityMeta: Map<string, CatalogGratuityMeta>;
  name: string;
  amountPercent: number;
}): CatalogGratuityMeta | null {
  return args.gratuityMeta.get(gratuityMatchKey(args.name, args.amountPercent)) ?? null;
}
