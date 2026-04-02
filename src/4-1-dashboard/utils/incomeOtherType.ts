/** True when master income type is the generic "other" bucket (EN / ID labels). */
export function isOtherIncomeType(name: string | undefined | null): boolean {
  if (!name) return false;
  const n = name.trim().toLowerCase();
  return (
    n === "other" ||
    n === "others" ||
    n === "lainnya" ||
    n === "lain-lain" ||
    n === "misc" ||
    n === "miscellaneous"
  );
}
