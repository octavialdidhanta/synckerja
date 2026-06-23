export function buildTikTokCaption(title: string | null | undefined, briefCaption: string | null | undefined): string {
  const parts: string[] = [];
  const t = title?.trim();
  const b = briefCaption?.trim();
  if (t) parts.push(t);
  if (b && b !== t) parts.push(b);
  return parts.join('\n\n').slice(0, 2200);
}
