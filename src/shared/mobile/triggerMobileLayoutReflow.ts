/**
 * Memaksa browser menghitung ulang layout untuk elemen `position: fixed` + safe-area
 * setelah WebView/Android kembali dari background (inset sering stale sampai reflow).
 */
export function triggerMobileLayoutReflow(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("resize"));
}
