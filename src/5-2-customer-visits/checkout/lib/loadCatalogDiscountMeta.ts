import { supabase } from '@/shared/lib/supabaseClient';

export type CatalogDiscountMeta = {
  discountId: string;
  name: string;
  inputConfiguration: 'fixed' | 'customizable' | null;
  amountUnit: 'rp' | 'percent' | null;
  amountValue: number | null;
  sortOrder: number;
};

function formatRp(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}

function formatPercent(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2)}%`;
}

/** Build display label for discount value column / grouping. */
export function buildDiscountValueLabel(args: {
  meta: CatalogDiscountMeta | null;
  amountRp: number;
}): string {
  const { meta, amountRp } = args;
  if (meta?.inputConfiguration === 'customizable') {
    return amountRp > 0 ? `Custom · ${formatRp(amountRp)}` : 'Custom';
  }
  if (meta?.amountUnit === 'percent' && meta.amountValue != null) {
    return formatPercent(meta.amountValue);
  }
  if (meta?.amountUnit === 'rp' && meta.amountValue != null) {
    return formatRp(meta.amountValue);
  }
  if (amountRp > 0) {
    return `Custom · ${formatRp(amountRp)}`;
  }
  return '—';
}

/** Resolve catalog discount metadata for checkout persistence. */
export async function loadCatalogDiscountMeta(
  discountIds: string[],
): Promise<Map<string, CatalogDiscountMeta>> {
  const unique = [...new Set(discountIds.filter(Boolean))];
  const map = new Map<string, CatalogDiscountMeta>();
  if (unique.length === 0) return map;

  const { data, error } = await supabase
    .from('catalog_discounts')
    .select('id, name, input_configuration, amount_unit, amount_value, sort_order')
    .in('id', unique);

  if (error) throw error;

  for (const row of data ?? []) {
    const inputConfiguration =
      row.input_configuration === 'fixed' || row.input_configuration === 'customizable'
        ? row.input_configuration
        : null;
    const amountUnit =
      row.amount_unit === 'rp' || row.amount_unit === 'percent' ? row.amount_unit : null;
    map.set(String(row.id), {
      discountId: String(row.id),
      name: String(row.name ?? '').trim() || 'Unknown',
      inputConfiguration,
      amountUnit,
      amountValue:
        row.amount_value != null && Number.isFinite(Number(row.amount_value))
          ? Number(row.amount_value)
          : null,
      sortOrder: Math.round(Number(row.sort_order) || 9999),
    });
  }

  return map;
}
