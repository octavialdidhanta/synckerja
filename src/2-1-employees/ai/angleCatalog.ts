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
