import type { TikTokContentAccountRow } from "@/tiktok-content/hooks/useTikTokContentSettings";

/** Labels generated before we fetched TikTok profile (open_id fragment). */
export function isPlaceholderTikTokAccountLabel(
  label: string | null | undefined,
  openId: string,
): boolean {
  const trimmed = label?.trim() ?? "";
  if (!trimmed) return true;
  if (trimmed === openId) return true;
  if (/^TikTok\s+-?[\w]{4,16}$/i.test(trimmed)) return true;
  const idPrefix = openId.replace(/^-/, "").slice(0, 8);
  if (idPrefix && trimmed.toLowerCase().includes(idPrefix.toLowerCase())) return true;
  return false;
}

export function getTikTokAccountDisplayLabel(account: Pick<
  TikTokContentAccountRow,
  "label" | "display_name" | "open_id"
>): string {
  for (const raw of [account.display_name, account.label]) {
    const name = raw?.trim() ?? "";
    if (name && !isPlaceholderTikTokAccountLabel(name, account.open_id)) return name;
  }
  return account.display_name?.trim() || account.label?.trim() || "TikTok";
}
