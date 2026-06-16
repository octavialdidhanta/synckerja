import { supabase } from '@/shared/lib/supabaseClient';

type NameLookupTable =
  | 'departments'
  | 'job_positions'
  | 'job_levels'
  | 'branches'
  | 'employee_statuses';

export async function batchNameLookupByIds(
  table: NameLookupTable,
  ids: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase.from(table).select('id, name').in('id', uniqueIds);

  if (error) {
    console.error(`Error batch fetching ${table}:`, error);
    return new Map();
  }

  return new Map((data ?? []).map((row) => [row.id, row.name]));
}
