export function normalizeTableNumber(input: string | null | undefined): string | null {
  const value = String(input ?? '').trim().slice(0, 16);
  return value || null;
}
