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

const IN_PROGRESS_STATUS_ALIASES = new Set([
  'in progress',
  'on going',
  'ongoing',
  'in-progress',
  'inprogress',
]);

/** Match DB row used after first livechat reply (Unread → active workflow). */
export function findInProgressLeadStatusId(
  statuses: ReadonlyArray<{ id: string; name: string; sort_order?: number | null }>,
): string | null {
  for (const s of statuses) {
    const n = (s.name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (IN_PROGRESS_STATUS_ALIASES.has(n)) return s.id;
  }
  const sort2 = statuses.find((s) => s.sort_order === 2);
  if (sort2 && !isUnreadLeadStatus(sort2.name)) return sort2.id;
  const workflow = statuses.find((s) => !isUnreadLeadStatus(s.name));
  return workflow?.id ?? null;
}

/** Master status name for Meta session ended (DB `lead_statuses.name`). */
export function isExpiredStatusName(name: string | null | undefined): boolean {
  if (name == null || name === '') return false;
  return name.trim().toLowerCase() === 'expired';
}

/** Meta customer-care window after last inbound (fallback when webhook timestamp is stale). */
const META_CS_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isWithinMetaCustomerCareWindow(lastInboundAt: string | null | undefined): boolean {
  if (lastInboundAt == null || String(lastInboundAt).trim() === '') return false;
  const ms = new Date(lastInboundAt).getTime();
  if (Number.isNaN(ms)) return false;
  return Date.now() - ms < META_CS_WINDOW_MS;
}

/**
 * True when `meta_session_expires_at` from Meta webhook is in the past.
 * Inbound within 24h reopens the CS window even if an older expiry timestamp remains in DB.
 */
export function isMetaSessionExpired(
  metaSessionExpiresAt: string | null | undefined,
  lastInboundAt?: string | null,
): boolean {
  if (isWithinMetaCustomerCareWindow(lastInboundAt)) return false;
  if (metaSessionExpiresAt == null || String(metaSessionExpiresAt).trim() === '') return false;
  const ms = new Date(metaSessionExpiresAt).getTime();
  if (Number.isNaN(ms)) return false;
  return Date.now() > ms;
}

/** Block free-form outbound: manual resolve, or Meta session ended (status or timestamp). */
export function isOutboundBlockedForLivechat(args: {
  statusName: string | null | undefined;
  metaSessionExpiresAt: string | null | undefined;
  lastInboundAt?: string | null;
}): boolean {
  const recentInbound = isWithinMetaCustomerCareWindow(args.lastInboundAt);
  if (isResolvedStatus(args.statusName) && !recentInbound) return true;
  if (isExpiredStatusName(args.statusName) && !recentInbound) return true;
  if (isMetaSessionExpired(args.metaSessionExpiresAt, args.lastInboundAt)) return true;
  return false;
}
