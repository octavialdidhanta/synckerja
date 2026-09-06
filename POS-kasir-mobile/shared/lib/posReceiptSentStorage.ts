const STORAGE_PREFIX = "synckerja_pos_receipt_sent:";

export type PosReceiptSentChannels = {
  email: boolean;
  sms: boolean;
};

function storageKey(activityId: string): string {
  return `${STORAGE_PREFIX}${activityId}`;
}

export function readPosReceiptSentLocal(activityId: string | null | undefined): PosReceiptSentChannels {
  if (!activityId) return { email: false, sms: false };
  try {
    const raw = localStorage.getItem(storageKey(activityId));
    if (!raw) return { email: false, sms: false };
    const parsed = JSON.parse(raw) as Partial<PosReceiptSentChannels>;
    return {
      email: Boolean(parsed.email),
      sms: Boolean(parsed.sms),
    };
  } catch {
    return { email: false, sms: false };
  }
}

export function markPosReceiptSentLocal(
  activityId: string,
  channel: "email" | "sms",
): PosReceiptSentChannels {
  const prev = readPosReceiptSentLocal(activityId);
  const next: PosReceiptSentChannels = {
    email: channel === "email" ? true : prev.email,
    sms: channel === "sms" ? true : prev.sms,
  };
  try {
    localStorage.setItem(storageKey(activityId), JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
  return next;
}

export function mergePosReceiptSentChannels(
  a: PosReceiptSentChannels,
  b: PosReceiptSentChannels,
): PosReceiptSentChannels {
  return {
    email: a.email || b.email,
    sms: a.sms || b.sms,
  };
}

export function isAnyPosReceiptSent(channels: PosReceiptSentChannels): boolean {
  return channels.email || channels.sms;
}
