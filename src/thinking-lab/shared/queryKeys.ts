export const labLockedTreeKey = (organizationId: string | null) =>
  ["thinking-lab-locked-tree", organizationId] as const;

export const labTerritoryKey = (organizationId: string | null, bigThoughtIds: string[]) =>
  ["thinking-lab-territories", organizationId, [...bigThoughtIds].sort().join(",")] as const;

export const labAngleKey = (organizationId: string | null, territoryIds: string[]) =>
  ["thinking-lab-angles", organizationId, [...territoryIds].sort().join(",")] as const;

export const labIdeaKey = (organizationId: string | null, angleIds: string[]) =>
  ["thinking-lab-ideas", organizationId, [...angleIds].sort().join(",")] as const;
