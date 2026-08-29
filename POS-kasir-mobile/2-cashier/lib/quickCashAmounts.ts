/**
 * Quick cash tender presets for Indonesian POS.
 *
 * Covers how customers usually pay:
 * - exact / small round-up (easy change)
 * - next 10k (e.g. 60.000)
 * - +10k (e.g. 70.000 ≈ 50k + 20k)
 * - 50.000 and 100.000 notes
 */
export function quickCashAmounts(amount: number, limit = 6): number[] {
  const base = Math.max(0, Math.round(amount));
  if (base <= 0) return [];

  const ceilTo = (step: number) => Math.ceil(base / step) * step;
  const next10k = ceilTo(10_000);

  const raw: number[] = [base, ceilTo(1_000), ceilTo(5_000), next10k];

  if (base < 50_000) {
    raw.push(next10k + 10_000, 50_000, 100_000);
  } else if (base < 100_000) {
    // e.g. 54.945 → 55k, 60k, 70k, 80k, 100k
    raw.push(next10k + 10_000);
    if (next10k + 20_000 < 100_000) raw.push(next10k + 20_000);
    raw.push(100_000);
  } else {
    raw.push(next10k + 10_000, ceilTo(50_000), ceilTo(100_000), ceilTo(100_000) + 50_000);
  }

  const unique = [...new Set(raw.filter((n) => n >= base))].sort((a, b) => a - b);

  const mustHave: number[] = [];
  if (base <= 50_000) mustHave.push(50_000);
  if (base < 100_000) mustHave.push(100_000);

  let result = unique.slice(0, limit);
  for (const bill of mustHave) {
    if (bill < base || result.includes(bill)) continue;
    if (result.length < limit) {
      result = [...result, bill].sort((a, b) => a - b);
    } else {
      // Drop the largest mid step that isn't exact / isn't another must-have
      const dropIdx = [...result]
        .map((n, i) => ({ n, i }))
        .reverse()
        .find(({ n }) => n !== base && !mustHave.includes(n))?.i;
      if (dropIdx == null) break;
      result = [...result.slice(0, dropIdx), ...result.slice(dropIdx + 1), bill].sort(
        (a, b) => a - b,
      );
    }
  }

  return result.slice(0, limit);
}
