export function anglesForCatalogs<T extends { serviceId: string | null }>(
  options: T[],
  serviceIds: string[],
): T[] {
  if (serviceIds.length === 0) return options;
  const allowed = new Set(serviceIds);
  return options.filter((option) => option.serviceId != null && allowed.has(option.serviceId));
}

export function anglesWithLockedIdeas<T extends { ideas: readonly unknown[] }>(options: T[]): T[] {
  return options.filter((option) => option.ideas.length > 0);
}

export function pillarsForLockedIdeas<
  P extends { id: string },
  A extends { id: string; pillarIds: readonly string[] },
>(pillars: P[], angles: A[], angleIds: string[]): P[] {
  if (angleIds.length === 0) return [];
  const allowed = new Set(
    angles.filter((angle) => angleIds.includes(angle.id)).flatMap((angle) => angle.pillarIds),
  );
  return pillars.filter((pillar) => allowed.has(pillar.id));
}

/**
 * Brief pillar dropdown in three groups:
 * - locked: locked on an idea of the chosen angles (shown with a lock, used or not)
 * - used: not locked but already used by a plan this month
 * - unused: everything else
 * Each group lists the least used pillar first, then by name.
 */
export function groupBriefPillars<P extends { id: string; label: string }>(
  pillars: P[],
  lockedIds: ReadonlySet<string>,
  usage: Readonly<Record<string, { count: number }>> = {},
): { locked: P[]; used: P[]; unused: P[] } {
  const countOf = (pillar: P) => usage[pillar.id]?.count ?? 0;
  const order = (left: P, right: P) =>
    countOf(left) - countOf(right) || left.label.localeCompare(right.label, "id");
  return {
    locked: pillars.filter((pillar) => lockedIds.has(pillar.id)).sort(order),
    used: pillars.filter((pillar) => !lockedIds.has(pillar.id) && countOf(pillar) > 0).sort(order),
    unused: pillars.filter((pillar) => !lockedIds.has(pillar.id) && countOf(pillar) === 0).sort(order),
  };
}
