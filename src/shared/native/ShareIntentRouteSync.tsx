import { useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Capacitor, CapacitorException } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { ShareIntent, type ShareIntentFileItem } from "@/plugins/share-intent";
import { SHARE_RECEIPT_VALIDATION_PATH } from "@/shared/native/shareReceiptValidationPath";
import { SHARE_TO_PUBLISH_PATH } from "@/shared/native/shareToPublishPath";
import {
  clearShareToPublishDismissed,
  isBlockedShareToPublishDestination,
} from "@/shared/native/shareToPublishSession";
import { devLog } from "@/shared/lib/logger";

declare global {
  interface Window {
    __SYNCKERJA_SHARE_ROUTE__?: string;
    /** Set after React Router successfully lands on the share path (native stops retrying). */
    __SYNCKERJA_SHARE_ROUTE_ACK__?: string;
  }
}

function isVideoMime(mime: string | null | undefined): boolean {
  return String(mime ?? "")
    .trim()
    .toLowerCase()
    .startsWith("video/");
}

function isVideoByName(name: string | null | undefined): boolean {
  return /\.(mp4|mov|webm|m4v|mkv|3gp)$/i.test(String(name ?? ""));
}

function resolveShareDestination(files: ShareIntentFileItem[]): string | null {
  if (!files.length) return null;
  const hasVideo = files.some(
    (f) => isVideoMime(f.mimeType) || isVideoByName(f.name),
  );
  if (hasVideo) return SHARE_TO_PUBLISH_PATH;
  return SHARE_RECEIPT_VALIDATION_PATH;
}

function isSharePath(path: string | null | undefined): boolean {
  return path === SHARE_TO_PUBLISH_PATH || path === SHARE_RECEIPT_VALIDATION_PATH;
}

async function readPendingRoute(): Promise<string | null> {
  try {
    const { path } = await ShareIntent.getPendingRoute();
    return path && isSharePath(path) ? path : null;
  } catch (e) {
    const msg = e instanceof CapacitorException ? e.message : String(e);
    devLog.warn("ShareIntent.getPendingRoute failed", msg);
    return null;
  }
}

async function readPendingFiles(): Promise<ShareIntentFileItem[]> {
  try {
    const { files, route } = await ShareIntent.getPendingPayload();
    if (route && isSharePath(route) && typeof window !== "undefined") {
      window.__SYNCKERJA_SHARE_ROUTE__ = route;
    }
    return Array.isArray(files) ? files : [];
  } catch (e) {
    const msg = e instanceof CapacitorException ? e.message : String(e);
    devLog.warn("ShareIntent.getPendingPayload failed", msg);
    return [];
  }
}

/**
 * Native Android: gallery / Edits / CapCut share → `/share/publish` or receipt route.
 * Native sets pending route immediately (before file copy) so we leave Home right away.
 * Navigation must go through React Router only (native must not call history.replaceState).
 */
export function ShareIntentRouteSync() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;

  const navigatingRef = useRef(false);

  const ackRoute = useCallback((dest: string) => {
    // Stops native retry loop; keep SharedPreferences route until wizard clearPending
    // so a bounce back to Home can still recover via getPendingRoute.
    window.__SYNCKERJA_SHARE_ROUTE_ACK__ = dest;
    window.__SYNCKERJA_SHARE_ROUTE__ = dest;
  }, []);

  const goTo = useCallback(
    (dest: string) => {
      if (!dest || !isSharePath(dest)) return;
      if (isBlockedShareToPublishDestination(dest)) return;
      if (pathnameRef.current === dest) {
        ackRoute(dest);
        return;
      }
      navigatingRef.current = true;
      window.__SYNCKERJA_SHARE_ROUTE__ = dest;
      devLog.debug("ShareIntent: navigate", { dest, from: pathnameRef.current });
      navigate(dest, { replace: true });
      window.setTimeout(() => {
        navigatingRef.current = false;
        if (pathnameRef.current === dest) ackRoute(dest);
      }, 400);
    },
    [ackRoute, navigate],
  );

  // If we are already on the share path (e.g. remount), ACK so native stops retrying.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (isSharePath(location.pathname)) {
      ackRoute(location.pathname);
    }
  }, [ackRoute, location.pathname]);

  const maybeNavigateToShareValidation = useCallback(async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return false;
    if (navigatingRef.current) return false;
    if (isSharePath(pathnameRef.current)) {
      ackRoute(pathnameRef.current);
      return true;
    }

    const forced =
      window.__SYNCKERJA_SHARE_ROUTE__ ||
      (await readPendingRoute());
    if (forced && isSharePath(forced)) {
      if (!isBlockedShareToPublishDestination(forced)) {
        goTo(forced);
        return true;
      }
    }

    const files = await readPendingFiles();
    if (!files.length) {
      return false;
    }

    const dest = resolveShareDestination(files);
    if (!dest || isBlockedShareToPublishDestination(dest)) return false;
    goTo(dest);
    return true;
  }, [ackRoute, goTo]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const onNativeRoute = (event: Event) => {
      const detail = (event as CustomEvent<{ path?: string }>).detail;
      const path = detail?.path || window.__SYNCKERJA_SHARE_ROUTE__;
      if (path && isSharePath(path) && !isBlockedShareToPublishDestination(path)) goTo(path);
    };

    window.addEventListener("synckerja-share-route", onNativeRoute);

    let handle: { remove: () => Promise<void> } | undefined;
    let appHandle: { remove: () => Promise<void> } | undefined;

    void ShareIntent.addListener("shareIntentReceived", (payload) => {
      clearShareToPublishDismissed();
      const route = payload?.route;
      if (route && isSharePath(route)) goTo(route);
      else void maybeNavigateToShareValidation();
    }).then((h) => {
      handle = h;
    });

    void CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void maybeNavigateToShareValidation();
    }).then((h) => {
      appHandle = h;
    });

    void maybeNavigateToShareValidation();

    return () => {
      window.removeEventListener("synckerja-share-route", onNativeRoute);
      void handle?.remove();
      void appHandle?.remove();
    };
  }, [goTo, maybeNavigateToShareValidation]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    const delays = [0, 100, 300, 600, 1000, 2000, 4000, 7000, 10000, 15000];

    const runRetries = async () => {
      for (const ms of delays) {
        if (cancelled) return;
        if (ms > 0) await new Promise((r) => window.setTimeout(r, ms));
        if (cancelled) return;
        if (isSharePath(pathnameRef.current)) {
          ackRoute(pathnameRef.current);
          return;
        }
        const ok = await maybeNavigateToShareValidation();
        if (ok && isSharePath(pathnameRef.current)) return;
      }
    };

    void runRetries();

    return () => {
      cancelled = true;
    };
  }, [ackRoute, maybeNavigateToShareValidation, location.pathname]);

  return null;
}
