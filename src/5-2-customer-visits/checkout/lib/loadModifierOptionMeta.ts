import { supabase } from '@/shared/lib/supabaseClient';

export type ModifierOptionMeta = {
  optionId: string;
  groupId: string | null;
  groupName: string;
  optionName: string;
};

/** Resolve modifier group metadata for checkout persistence. */
export async function loadModifierOptionMeta(
  optionIds: string[],
): Promise<Map<string, ModifierOptionMeta>> {
  const unique = [...new Set(optionIds.filter(Boolean))];
  const map = new Map<string, ModifierOptionMeta>();
  if (unique.length === 0) return map;

  const { data, error } = await supabase
    .from('catalog_modifier_options')
    .select('id, name, group_id, catalog_modifier_groups(name)')
    .in('id', unique);

  if (error) throw error;

  for (const row of data ?? []) {
    const group = row.catalog_modifier_groups as { name?: string } | null;
    map.set(String(row.id), {
      optionId: String(row.id),
      groupId: row.group_id ? String(row.group_id) : null,
      groupName: String(group?.name ?? '').trim() || 'Unknown',
      optionName: String(row.name ?? '').trim() || 'Unknown',
    });
  }

  return map;
}

export function computeModifierLineDiscount(args: {
  modifierGross: number;
  lineGross: number;
  lineDiscountTotal: number;
}): number {
  if (args.lineGross <= 0 || args.lineDiscountTotal <= 0 || args.modifierGross <= 0) return 0;
  return Math.round((args.modifierGross / args.lineGross) * args.lineDiscountTotal);
}
