/** Case-insensitive email equality for POS session gate. */
export function emailsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
