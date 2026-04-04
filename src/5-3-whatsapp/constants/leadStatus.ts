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

/** 24-hour messaging window (WhatsApp/Instagram): outbound not allowed after 24h from last inbound. */
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * True when effective time (last_inbound_at ?? created_at) is older than 24 hours.
 * Used to block send so UI follows the same rule as auto-resolve and Meta's 24h window.
 */
export function isOutside24hWindow(
  lastInboundAt: string | null | undefined,
  createdAt: string | null | undefined
): boolean {
  const effective = lastInboundAt ?? createdAt;
  if (!effective) return false;
  const effectiveMs = new Date(effective).getTime();
  if (Number.isNaN(effectiveMs)) return false;
  return Date.now() - effectiveMs > TWENTY_FOUR_HOURS_MS;
}
