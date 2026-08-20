export function ingredientInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed.slice(0, 2).toLowerCase();
}
