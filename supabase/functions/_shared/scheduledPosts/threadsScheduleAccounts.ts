/** Threads accounts that can be scheduled later. One Threads user id, even when several Instagram rows share it. */

export type ThreadsScheduleAccountRow = {
  threads_user_id: string | null;
  threads_username: string | null;
  instagram_username: string | null;
  instagram_name: string | null;
  has_threads: boolean;
  is_active: boolean;
  threads_access_token_enc: string | null;
};

export type ThreadsScheduleAccount = {
  platform: "Threads";
  accountId: string;
  accountLabel: string;
};

function accountLabel(row: ThreadsScheduleAccountRow, accountId: string): string {
  const label = [row.threads_username, row.instagram_username, row.instagram_name]
    .map((value) => String(value ?? "").trim())
    .find((value) => value.length > 0);
  return label || accountId;
}

export function listThreadsScheduleAccounts(
  rows: ThreadsScheduleAccountRow[],
): ThreadsScheduleAccount[] {
  const seen = new Set<string>();
  const accounts: ThreadsScheduleAccount[] = [];
  for (const row of rows) {
    if (!row.has_threads || !row.is_active) continue;
    const accountId = String(row.threads_user_id ?? "").trim();
    if (!accountId || seen.has(accountId)) continue;
    if (!String(row.threads_access_token_enc ?? "").trim()) continue;
    seen.add(accountId);
    accounts.push({
      platform: "Threads",
      accountId,
      accountLabel: accountLabel(row, accountId),
    });
  }
  return accounts;
}
