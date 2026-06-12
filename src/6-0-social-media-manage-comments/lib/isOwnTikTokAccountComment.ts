/** Primary display token before "|" (e.g. "Octa" from "Octa | Work Life Realities"). */
function primaryAuthorToken(name: string): string {
  return name.split("|")[0]?.trim().toLowerCase() ?? "";
}

/**
 * Heuristic: TikTok Business API only allows deleting comments/replies authored by the
 * connected account. Match comment author to the connected account label.
 */
export function isOwnTikTokAccountComment(
  commentAuthorName: string,
  connectedAccountLabel: string,
): boolean {
  const author = primaryAuthorToken(commentAuthorName);
  const account = primaryAuthorToken(connectedAccountLabel);
  if (!author || !account) return false;
  if (author === account) return true;
  if (author.length >= 3 && account.length >= 3) {
    return author.startsWith(account) || account.startsWith(author);
  }
  return false;
}
