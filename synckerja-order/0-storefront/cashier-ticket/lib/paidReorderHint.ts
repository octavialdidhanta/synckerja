const PAID_HINT_DISMISSED_KEY = "synckerja_order_paid_hint_dismissed_v1";

function hintKey(storeCode: string, tableNumber: string) {
  return `${storeCode}::${tableNumber.trim().toLowerCase()}`;
}

function readDismissed(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PAID_HINT_DISMISSED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeDismissed(map: Record<string, string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PAID_HINT_DISMISSED_KEY, JSON.stringify(map));
}

export function shouldShowPaidReorderHint(args: {
  storeCode: string;
  tableNumber: string;
  paidEventToken: string | null;
}): boolean {
  if (!args.paidEventToken || !args.storeCode || !args.tableNumber) return false;
  const key = hintKey(args.storeCode, args.tableNumber);
  return readDismissed()[key] !== args.paidEventToken;
}

export function dismissPaidReorderHint(args: {
  storeCode: string;
  tableNumber: string;
  paidEventToken: string;
}) {
  const key = hintKey(args.storeCode, args.tableNumber);
  const next = { ...readDismissed(), [key]: args.paidEventToken };
  writeDismissed(next);
}

export function clearPaidReorderHintOnCheckout(args: { storeCode: string; tableNumber: string }) {
  const key = hintKey(args.storeCode, args.tableNumber);
  const next = { ...readDismissed() };
  delete next[key];
  writeDismissed(next);
}
