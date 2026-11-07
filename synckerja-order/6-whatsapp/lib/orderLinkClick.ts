import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";

const SESSION_KEY = "sj-order-link-session";
const VISITOR_KEY = "sj-order-link-visitor";
const LANDING_KEY = "sj-order-link-landing";

function storedId(key: string): string {
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  sessionStorage.setItem(key, next);
  return next;
}

/** Keep the first advertising URL in this tab, including UTM, fbclid, and gclid. */
export function rememberOrderLinkLanding(): void {
  if (typeof window === "undefined") return;
  if (!sessionStorage.getItem(LANDING_KEY)) {
    sessionStorage.setItem(LANDING_KEY, window.location.href);
  }
  storedId(SESSION_KEY);
  storedId(VISITOR_KEY);
}

/** Record the WhatsApp click before the tab opens wa.me. QR pages must not call this. */
export function trackOrderLinkWhatsAppClick(args: {
  code: string;
  targetUrl: string;
  targetPhone: string;
}): void {
  if (typeof window === "undefined" || !SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  rememberOrderLinkLanding();
  const body = JSON.stringify({
    code: args.code,
    session_id: storedId(SESSION_KEY),
    visitor_id: storedId(VISITOR_KEY),
    page_url: sessionStorage.getItem(LANDING_KEY) || window.location.href,
    referrer: document.referrer || null,
    path: window.location.pathname || "/",
    target_url: args.targetUrl,
    target_phone: args.targetPhone,
  });
  void fetch(`${SUPABASE_URL}/functions/v1/synckerja-order-link-click`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body,
    keepalive: true,
  }).catch(() => undefined);
}
