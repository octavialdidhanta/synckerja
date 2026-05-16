/**
 * Display name untuk status lead.
 * - Nilai di DB "Open", tampilan di UI "Unread" (chat pertama masuk / setelah resolve).
 * - Nilai di DB "In Progress", tampilan di UI "In Progress".
 * - Nilai di DB "Closed", tampilan di UI "Resolve".
 * - Nilai di DB "Expired", tampilan di UI "Expired" (sesi Meta berakhir; bukan resolve manual).
 */
export function getLeadStatusDisplayName(name: string | null | undefined): string {
  if (name == null || name === '') return '';
  if (name === 'Open') return 'Unread';
  if (name === 'In Progress') return 'In Progress';
  if (name === 'Closed') return 'Resolve';
  return name;
}
