/**
 * Replies typed in the Instagram / Messenger / Business Suite apps are stored by
 * the webhook with raw_metadata.synckerja_source = "native_app". Map them to the
 * same "business_app" source WhatsApp uses so the thread shows the
 * "Replied from phone" badge.
 */
export function metaNativeAppSource(message: {
  direction: string;
  raw_metadata: unknown;
}): "business_app" | null {
  if (message.direction !== "outbound") return null;
  const meta = message.raw_metadata;
  if (!meta || typeof meta !== "object") return null;
  return (meta as Record<string, unknown>).synckerja_source === "native_app" ? "business_app" : null;
}
