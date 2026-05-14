/**
 * Query master dengan `.or(organization_id.eq.X, organization_id.is.null)` sering
 * mengembalikan nama sama dua kali (template global + baris milik organisasi).
 * Untuk dropdown: satu nama → satu baris; utamakan record organisasi.
 */
export function dedupeMasterRowsByNamePreferOrg<
  T extends { id: string; name: string; organization_id?: string | null }
>(rows: T[], organizationId: string): T[] {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, row);
      continue;
    }
    const prevOrg = prev.organization_id ?? null;
    const rowOrg = row.organization_id ?? null;
    const prevIsOrg = prevOrg === organizationId;
    const rowIsOrg = rowOrg === organizationId;
    if (rowIsOrg && !prevIsOrg) {
      map.set(key, row);
    } else if (!rowIsOrg && prevIsOrg) {
      // keep prev
    } else if (String(row.id) < String(prev.id)) {
      map.set(key, row);
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}
