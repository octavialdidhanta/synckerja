import { supabase } from '@/shared/lib/supabaseClient';

export type CatalogTaxMeta = {
  taxId: string;
  name: string;
  amountPercent: number;
  sortOrder: number;
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function taxMatchKey(name: string, amountPercent: number): string {
  const rounded = Math.round(amountPercent * 100) / 100;
  return `${normalizeName(name)}::${rounded}`;
}

export function buildTaxRateLabel(amountPercent: number): string {
  if (!Number.isFinite(amountPercent) || amountPercent <= 0) return '—';
  const rounded = Math.round(amountPercent * 100) / 100;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2)}%`;
}

/** Resolve catalog tax metadata for checkout persistence, scoped to outlet. */
export async function loadCatalogTaxMetaForOutlet(args: {
  orgId: string;
  outletId: string;
}): Promise<Map<string, CatalogTaxMeta>> {
  const map = new Map<string, CatalogTaxMeta>();

  const { data, error } = await supabase
    .from('catalog_taxes')
    .select(
      'id, name, amount_percent, sort_order, is_active, catalog_tax_outlets!inner(outlet_id)',
    )
    .eq('organization_id', args.orgId)
    .eq('is_active', true)
    .eq('catalog_tax_outlets.outlet_id', args.outletId);

  if (error) throw error;

  for (const row of data ?? []) {
    const name = String(row.name ?? '').trim() || 'Unknown';
    const amountPercent = Number(row.amount_percent) || 0;
    const meta: CatalogTaxMeta = {
      taxId: String(row.id),
      name,
      amountPercent,
      sortOrder: Math.round(Number(row.sort_order) || 9999),
    };
    map.set(taxMatchKey(name, amountPercent), meta);
  }

  return map;
}

export function resolveCatalogTaxMeta(args: {
  taxMeta: Map<string, CatalogTaxMeta>;
  name: string;
  amountPercent: number;
}): CatalogTaxMeta | null {
  return args.taxMeta.get(taxMatchKey(args.name, args.amountPercent)) ?? null;
}
