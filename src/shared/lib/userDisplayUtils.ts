export function displayNameFromUser(metadata: Record<string, unknown> | undefined, email: string | undefined): string {
  const raw = metadata?.full_name;
  const fromMeta = typeof raw === "string" ? raw.trim() : "";
  if (fromMeta) return fromMeta;
  const e = email?.trim() ?? "";
  if (e) return e.split("@")[0] ?? e;
  return "";
}

export function initialsFromNameOrEmail(displayName: string, email: string | undefined): string {
  const n = displayName.trim();
  if (n.length >= 2) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0]?.[0];
      const b = parts[parts.length - 1]?.[0];
      if (a && b) return `${a}${b}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  const local = (email ?? "").split("@")[0] ?? "";
  const two = local.slice(0, 2);
  return (two || "—").toUpperCase();
}
