export const WHATSAPP_MEDIA_TYPES = ['image', 'video', 'document', 'audio', 'sticker'] as const;

export function isStickerMessageType(type: string | null | undefined): boolean {
  return (type ?? '').toLowerCase() === 'sticker';
}

export function isMediaMessageType(type: string | null | undefined): boolean {
  return WHATSAPP_MEDIA_TYPES.includes((type ?? '').toLowerCase() as (typeof WHATSAPP_MEDIA_TYPES)[number]);
}

/** Sidebar / reply preview label for media placeholders. */
export function formatWhatsAppMediaPreviewLabel(body: string | null | undefined, messageType?: string | null): string {
  const raw = (body ?? '').trim();
  if (raw === '[sticker]' || isStickerMessageType(messageType)) return 'Sticker';
  if (raw.startsWith('[') && raw.endsWith(']') && isMediaMessageType(raw.slice(1, -1))) {
    const inner = raw.slice(1, -1).toLowerCase();
    if (inner === 'image') return 'Photo';
    if (inner === 'video') return 'Video';
    if (inner === 'audio') return 'Audio';
    if (inner === 'document') return 'Document';
  }
  return raw;
}
