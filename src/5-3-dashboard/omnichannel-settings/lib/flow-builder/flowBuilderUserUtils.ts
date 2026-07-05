const AVATAR_COLOR_CLASSES = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-slate-900",
  "bg-teal-500",
  "bg-orange-500",
] as const;

export function flowBuilderUserInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function flowBuilderAvatarColorClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i)) % AVATAR_COLOR_CLASSES.length;
  }
  return AVATAR_COLOR_CLASSES[hash] ?? AVATAR_COLOR_CLASSES[0];
}
