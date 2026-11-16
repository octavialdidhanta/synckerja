/** Canva Billing & plans — AI usage / upgrade. */
export const CANVA_BILLING_URL = "https://www.canva.com/settings/billing-and-teams";

const CREDIT_NEEDLES = [
  "credit_quota_cooldown",
  "credit_quota_exceeded",
  "app_credit_quota_exceeded",
  "credit quota cooldown",
  "credit quota",
] as const;

export function isCanvaCreditQuotaMessage(text: string | null | undefined): boolean {
  if (typeof text !== "string" || !text.trim()) return false;
  const lower = text.toLowerCase();
  return CREDIT_NEEDLES.some((needle) => lower.includes(needle));
}

type Listener = (open: boolean) => void;

let open = false;
const listeners = new Set<Listener>();

export function subscribeCanvaCreditQuota(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function canvaCreditQuotaDialogOpen(): boolean {
  return open;
}

export function openCanvaCreditQuotaDialog(): void {
  if (open) return;
  open = true;
  for (const listener of listeners) listener(true);
}

export function closeCanvaCreditQuotaDialog(): void {
  if (!open) return;
  open = false;
  for (const listener of listeners) listener(false);
}

/** Opens the shared dialog when Canva blocks create/export for AI / API credit quota. */
export function presentCanvaCreditQuota(text: string | null | undefined): boolean {
  if (!isCanvaCreditQuotaMessage(text)) return false;
  openCanvaCreditQuotaDialog();
  return true;
}
