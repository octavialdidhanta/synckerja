export const LEAD_MAGNET_PAYLOAD_PREFIX = 'lm:';

export type LeadMagnetPostbackAction = 'follow_confirm' | 'get_framework' | 'download';

const ACTION_LABELS: Record<LeadMagnetPostbackAction, string> = {
  follow_confirm: 'Sudah Follow',
  get_framework: 'Kirimkan saya link-nya 😊',
  download: 'Unduh',
};

export function parseLeadMagnetPostbackPayload(
  payload: string,
): { enrollmentId: string; action: LeadMagnetPostbackAction } | null {
  const trimmed = payload.trim();
  if (!trimmed.startsWith(LEAD_MAGNET_PAYLOAD_PREFIX)) return null;
  const rest = trimmed.slice(LEAD_MAGNET_PAYLOAD_PREFIX.length);
  const colon = rest.indexOf(':');
  if (colon <= 0) return null;
  const enrollmentId = rest.slice(0, colon).trim();
  const action = rest.slice(colon + 1).trim();
  if (!enrollmentId) return null;
  if (action !== 'follow_confirm' && action !== 'get_framework' && action !== 'download') return null;
  return { enrollmentId, action };
}

export function humanizeLeadMagnetAction(action: string): string | null {
  if (action === 'follow_confirm' || action === 'get_framework' || action === 'download') {
    return ACTION_LABELS[action];
  }
  return null;
}

export function humanizeLeadMagnetPayload(payload: string): string | null {
  const parsed = parseLeadMagnetPostbackPayload(payload);
  if (!parsed) return null;
  return humanizeLeadMagnetAction(parsed.action);
}

function readPostbackTitle(rawMetadata: unknown): string | null {
  if (!rawMetadata || typeof rawMetadata !== 'object') return null;
  const meta = rawMetadata as {
    postback?: { title?: string };
    message?: { quick_reply?: { payload?: string } };
  };
  const postbackTitle = meta.postback?.title;
  if (typeof postbackTitle === 'string' && postbackTitle.trim()) return postbackTitle.trim();
  return null;
}

export function humanizeLeadMagnetPostbackBody(
  body: string | null | undefined,
  rawMetadata?: unknown,
): string {
  const title = readPostbackTitle(rawMetadata);
  if (title) return title;

  const text = (body ?? '').trim();
  if (!text) return 'Tombol diklik';

  if (text.startsWith(LEAD_MAGNET_PAYLOAD_PREFIX)) {
    return humanizeLeadMagnetPayload(text) ?? 'Tombol diklik';
  }

  return text;
}

export function isLeadMagnetPostbackBody(body: string | null | undefined): boolean {
  const text = (body ?? '').trim();
  return text.startsWith(LEAD_MAGNET_PAYLOAD_PREFIX);
}

export function isLeadMagnetPostbackMessage(
  body: string | null | undefined,
  rawMetadata?: unknown,
): boolean {
  if (isLeadMagnetPostbackBody(body)) return true;
  if (!rawMetadata || typeof rawMetadata !== 'object') return false;
  const payload = (rawMetadata as { postback?: { payload?: string } }).postback?.payload;
  return typeof payload === 'string' && payload.trim().startsWith(LEAD_MAGNET_PAYLOAD_PREFIX);
}

export function stripLeadMagnetButtonSuffix(text: string): { body: string; buttonTitles: string[] } {
  const match = text.match(/\n\n\[Tombol:\s*(.+)\]\s*$/);
  if (!match || match.index == null) return { body: text, buttonTitles: [] };
  const body = text.slice(0, match.index).trimEnd();
  const buttonTitles = match[1]
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return { body, buttonTitles };
}

export function extractLeadMagnetButtonTitles(rawMetadata: unknown): string[] {
  if (!rawMetadata || typeof rawMetadata !== 'object') return [];
  const buttons = (rawMetadata as {
    lead_magnet_buttons?: { buttons?: Array<{ title?: string }> };
  }).lead_magnet_buttons?.buttons;
  if (!Array.isArray(buttons)) return [];
  return buttons
    .map((btn) => (typeof btn?.title === 'string' ? btn.title.trim() : ''))
    .filter(Boolean);
}

export function resolveLegacyLeadMagnetOutboundDisplay(
  body: string | null | undefined,
  rawMetadata?: unknown,
): { body: string; buttonTitles: string[] } {
  const fromMeta = extractLeadMagnetButtonTitles(rawMetadata);
  if (fromMeta.length) {
    return { body: (body ?? '').trim(), buttonTitles: fromMeta };
  }
  const stripped = stripLeadMagnetButtonSuffix(body ?? '');
  return stripped;
}
