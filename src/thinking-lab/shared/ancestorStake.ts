export type AncestorStake = { label: string; statement: string };

export const ANCESTOR_STAKE_RULES = [
  "A child may open a framing the direct parent does not already say.",
  "Keep the distinctive stake of the direct parent and of every ancestor. Reject a child that would still be coherent after that stake is removed.",
  "Do not copy the parent or the ancestors.",
];

export function ancestorStakeBlock(ancestors: AncestorStake[] | undefined): string[] {
  const rows = (ancestors ?? [])
    .map((row) => ({ label: row.label.trim(), statement: row.statement.trim() }))
    .filter((row) => row.label && row.statement);
  if (rows.length === 0) return [];
  return ["", "Ancestor stake above the direct parent:", ...rows.map((row) => `${row.label}: ${row.statement}`)];
}
