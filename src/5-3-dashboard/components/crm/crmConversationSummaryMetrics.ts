/**
 * Pure helpers for Ringkasan percakapan (`CrmConversationSummaryPanel`).
 * Period window uses the browser clock (`Date.now()`), same as the UI label.
 */

export type ConversationSummaryPeriodKey = '7' | '30' | '90' | 'all';
export type ConversationSummaryChannelKey = 'all' | 'whatsapp' | 'instagram' | 'facebook' | 'email';

const MS_PER_DAY = 86_400_000;

/** N-day filter: exclude leads with missing or invalid timestamps (not counted in window). */
export function leadWithinSummaryPeriod(
  lead: Record<string, unknown>,
  periodKey: ConversationSummaryPeriodKey,
): boolean {
  if (periodKey === 'all') return true;
  const days = Number(periodKey);
  const raw = (lead.updated_at ?? lead.created_at) as string | undefined;
  if (raw == null || String(raw).trim() === '') return false;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= days * MS_PER_DAY;
}

function inferredChannelFromVirtualSource(source: string): 'whatsapp' | 'instagram' | null {
  const s = source.trim().toLowerCase();
  if (s === 'instagram') return 'instagram';
  if (s === 'whatsapp') return 'whatsapp';
  return null;
}

/**
 * Channel filter: explicit `channel` > virtual WA/IG (`_fromWhatsApp` + `source`) > substring on `source` / `channel`.
 */
export function leadMatchesSummaryChannel(
  lead: Record<string, unknown>,
  channel: ConversationSummaryChannelKey,
): boolean {
  if (channel === 'all') return true;

  const chRaw = lead.channel;
  if (typeof chRaw === 'string' && chRaw.trim() !== '') {
    const ch = chRaw.trim().toLowerCase();
    if (channel === 'whatsapp') return ch === 'whatsapp';
    if (channel === 'instagram') return ch === 'instagram';
    if (channel === 'email') return ch === 'email';
  }

  if (lead._fromWhatsApp === true) {
    const src = String(lead.source ?? '');
    const inferred = inferredChannelFromVirtualSource(src);
    if (inferred != null) {
      return channel === inferred;
    }
  }

  const src = String(lead.source ?? '').toLowerCase();
  if (channel === 'whatsapp') return src.includes('whatsapp');
  if (channel === 'instagram') return src.includes('instagram');
  if (channel === 'email') {
    const id = String(lead.id ?? '');
    if (id.startsWith('email-')) return true;
    return src.includes('email');
  }
  return true;
}
