/**
 * Lead status names as stored in DB (lead_statuses.name).
 * Used to block outbound when conversation is Resolved.
 * DB may store "Closed" or "Resolve" depending on org; both must block send.
 */
export const RESOLVED_STATUS_NAME = 'Closed';

const RESOLVED_NAMES = ['closed', 'resolve'] as const;

export function isResolvedStatus(name: string | null | undefined): boolean {
  if (name == null || name === '') return false;
  const normalized = name.trim().toLowerCase();
  return RESOLVED_NAMES.includes(normalized as (typeof RESOLVED_NAMES)[number]);
}

/** DB `Open` is shown as Unread in UI; some orgs may store the name `Unread` directly. */
export function isUnreadLeadStatus(name: string | null | undefined): boolean {
  if (name == null || name === '') return false;
  const normalized = name.trim().toLowerCase();
  return normalized === 'open' || normalized === 'unread';
}

/** Master status name for Meta session ended (DB `lead_statuses.name`). */
export function isExpiredStatusName(name: string | null | undefined): boolean {
  if (name == null || name === '') return false;
  return name.trim().toLowerCase() === 'expired';
}

/**
 * True when `meta_session_expires_at` from Meta webhook is in the past.
 * This is Meta-provided wall time, not a server-side "last inbound + 24h" calculation.
 */
export function isMetaSessionExpired(metaSessionExpiresAt: string | null | undefined): boolean {
  if (metaSessionExpiresAt == null || String(metaSessionExpiresAt).trim() === '') return false;
  const ms = new Date(metaSessionExpiresAt).getTime();
  if (Number.isNaN(ms)) return false;
  return Date.now() > ms;
}

/** Block free-form outbound: manual resolve, or Meta session ended (status or timestamp). */
export function isOutboundBlockedForLivechat(args: {
  statusName: string | null | undefined;
  metaSessionExpiresAt: string | null | undefined;
}): boolean {
  if (isResolvedStatus(args.statusName)) return true;
  if (isExpiredStatusName(args.statusName)) return true;
  if (isMetaSessionExpired(args.metaSessionExpiresAt)) return true;
  return false;
}
