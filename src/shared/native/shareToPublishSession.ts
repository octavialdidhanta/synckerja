import { SHARE_TO_PUBLISH_PATH } from "@/shared/native/shareToPublishPath";

declare global {
  interface Window {
    /** User explicitly left Share-to-Publish; block route-sync bounce until next share. */
    __SYNCKERJA_SHARE_DISMISSED__?: boolean;
  }
}

export function dismissShareToPublishSession(): void {
  if (typeof window === "undefined") return;
  window.__SYNCKERJA_SHARE_DISMISSED__ = true;
  delete window.__SYNCKERJA_SHARE_ROUTE__;
  delete window.__SYNCKERJA_SHARE_ROUTE_ACK__;
}

export function clearShareToPublishDismissed(): void {
  if (typeof window === "undefined") return;
  delete window.__SYNCKERJA_SHARE_DISMISSED__;
}

export function isShareToPublishDismissed(): boolean {
  return typeof window !== "undefined" && window.__SYNCKERJA_SHARE_DISMISSED__ === true;
}

export function isBlockedShareToPublishDestination(path: string | null | undefined): boolean {
  return isShareToPublishDismissed() && path === SHARE_TO_PUBLISH_PATH;
}
