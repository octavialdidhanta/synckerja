const OFF_STATUSES = new Set(["PAUSED", "DELETED", "ARCHIVED"]);

/** The ad's own Meta status, not the parent campaign or ad set. */
export function metaAdIsOn(row: Record<string, unknown>): boolean {
  const status = String(row.configured_status ?? "").trim().toUpperCase();
  if (status === "ACTIVE") return true;
  if (OFF_STATUSES.has(status)) return false;
  return String(row.delivery ?? "").trim() !== "Off";
}

export function metaAdStatusLocked(row: Record<string, unknown>): boolean {
  const status = String(row.configured_status ?? "").trim().toUpperCase();
  return status === "DELETED" || status === "ARCHIVED";
}
