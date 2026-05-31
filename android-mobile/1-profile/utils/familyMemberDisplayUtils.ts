type TranslateFn = (key: string, fallback?: string) => string;

export function formatRelationship(value: string | undefined, t: TranslateFn): string | undefined {
  if (!value?.trim()) return undefined;
  const normalized = value.trim().toLowerCase();
  const keyMap: Record<string, string> = {
    spouse: 'profile.emergencyContact.relationship.spouse',
    father: 'profile.emergencyContact.relationship.father',
    mother: 'profile.emergencyContact.relationship.mother',
    child: 'profile.emergencyContact.relationship.child',
    sibling: 'profile.emergencyContact.relationship.sibling',
    other: 'profile.emergencyContact.relationship.other',
  };
  const key = keyMap[normalized];
  if (key) {
    const fallbacks: Record<string, string> = {
      spouse: 'Spouse',
      father: 'Father',
      mother: 'Mother',
      child: 'Child',
      sibling: 'Sibling',
      other: 'Other',
    };
    return t(key, fallbacks[normalized]);
  }
  return value.trim();
}

export function formatAge(value: number | undefined): string | undefined {
  if (value == null || Number.isNaN(value)) return undefined;
  return String(value);
}
