export const isValidUUID = (value: string | null | undefined): boolean => {
  if (!value || typeof value !== "string") {
    return false;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

export const filterValidCycleIds = (cycleIds: string[] | null | undefined): string[] => {
  if (!cycleIds || !Array.isArray(cycleIds)) {
    return [];
  }
  return cycleIds.filter((id) => isValidUUID(id));
};
