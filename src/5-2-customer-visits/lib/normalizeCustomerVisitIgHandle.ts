/** Mirror of extractInstagramHandle (frontend; do not import edge-function modules). */
export function normalizeCustomerVisitIgHandle(input: string | null | undefined): string | null {
  const stripped = String(input ?? '')
    .trim()
    .replace(/^@+/i, '')
    .toLowerCase();
  if (!stripped) return null;
  if (!/^[a-z0-9._]{1,30}$/.test(stripped)) return null;
  if (!/[a-z]/.test(stripped)) return null;
  return stripped;
}
