import { useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Capacitor, CapacitorException } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { toast } from "sonner";
import { ShareIntent, type ShareIntentFileItem } from "@/plugins/share-intent";
import { SHARE_RECEIPT_VALIDATION_PATH } from "@/shared/native/shareReceiptValidationPath";
import { SHARE_TO_PUBLISH_PATH } from "@/shared/native/shareToPublishPath";
import {
  clearShareToPublishDismissed,
  dismissShareToPublishSession,
  isBlockedShareToPublishDestination,
} from "@/shared/native/shareToPublishSession";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
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
 * A route with no payload left behind by an earlier session keeps forcing navigation forever.
 * Only safe once retries are exhausted: native publishes the route before it finishes copying files.
 */
async function clearStalePendingRoute(): Promise<void> {
  try {
    const { files } = await ShareIntent.getPendingPayload();
    if (Array.isArray(files) && files.length > 0) return;
    await ShareIntent.clearPendingRoute();
    delete window.__SYNCKERJA_SHARE_ROUTE__;
    delete window.__SYNCKERJA_SHARE_ROUTE_ACK__;
    devLog.debug("ShareIntent: cleared stale pending route");
  } catch (e) {
    const msg = e instanceof CapacitorException ? e.message : String(e);
    devLog.warn("ShareIntent.clearPendingRoute failed", msg);
  }
}

/** Both share destinations need a session, so a share received while signed out is dropped rather than queued. */
async function cancelPendingShare(): Promise<void> {
  try {
    await ShareIntent.clearPending();
    await ShareIntent.clearPendingRoute();
  } catch (e) {
    const msg = e instanceof CapacitorException ? e.message : String(e);
    devLog.warn("ShareIntent cancel failed", msg);
  }
  dismissShareToPublishSession();
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

  const { user, loading: authLoading } = useAuth();
  const { t } = useAppTranslation();

  /** Resolved to "no session": navigating to a share route now would only bounce off the access guard. */
  const signedOut = !authLoading && !user;
  const signedOutRef = useRef(signedOut);
  signedOutRef.current = signedOut;

  const navigatingRef = useRef(false);

  /** Destination → path an access guard bounced us to; retrying there just ping-pongs with the guard. */
  const bouncedDestsRef = useRef(new Map<string, string>());

  const cancelShareWhileSignedOut = useCallback(async () => {
    await cancelPendingShare();
    devLog.debug("ShareIntent: cancelled pending share (signed out)");
    toast.error(
      t(
        "share.cancelledSignedOut",
        "Share cancelled because you are not signed in. Sign in first, then share the video again.",
      ),
    );
  }, [t]);

  const ackRoute = useCallback((dest: string) => {
    // Stops native retry loop; keep SharedPreferences route until wizard clearPending
    // so a bounce back to Home can still recover via getPendingRoute.
    window.__SYNCKERJA_SHARE_ROUTE_ACK__ = dest;
    window.__SYNCKERJA_SHARE_ROUTE__ = dest;
  }, []);

  /** Re-arms once the user leaves the bounce target (e.g. after login), so the share still resumes. */
  const isBouncedDestination = useCallback((dest: string) => {
    const bouncedAt = bouncedDestsRef.current.get(dest);
    if (bouncedAt === undefined) return false;
    if (pathnameRef.current === bouncedAt) return true;
    bouncedDestsRef.current.delete(dest);
    return false;
  }, []);

  const goTo = useCallback(
    (dest: string) => {
      if (!dest || !isSharePath(dest)) return;
      if (signedOutRef.current) return;
      if (isBlockedShareToPublishDestination(dest)) return;
      if (isBouncedDestination(dest)) return;
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
        if (pathnameRef.current === dest) {
          ackRoute(dest);
          return;
        }
        bouncedDestsRef.current.set(dest, pathnameRef.current);
        devLog.debug("ShareIntent: destination refused", { dest, landedOn: pathnameRef.current });
      }, 400);
    },
    [ackRoute, isBouncedDestination, navigate],
  );

  // If we are already on the share path (e.g. remount), ACK so native stops retrying.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (isSharePath(location.pathname)) {
      ackRoute(location.pathname);
    }
  }, [ackRoute, location.pathname]);

  // Drop anything native queued while the user was signed out (share arrived before this session resolved).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!signedOut) return;

    let cancelled = false;
    void (async () => {
      let hasPendingShare = Boolean(window.__SYNCKERJA_SHARE_ROUTE__);
      try {
        const { files, route } = await ShareIntent.getPendingPayload();
        hasPendingShare =
          hasPendingShare || (Array.isArray(files) && files.length > 0) || isSharePath(route);
      } catch (e) {
        const msg = e instanceof CapacitorException ? e.message : String(e);
        devLog.warn("ShareIntent.getPendingPayload failed", msg);
      }
      if (cancelled || !hasPendingShare) return;
      await cancelShareWhileSignedOut();
    })();

    return () => {
      cancelled = true;
    };
  }, [cancelShareWhileSignedOut, signedOut]);

  const maybeNavigateToShareValidation = useCallback(async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return false;
    if (navigatingRef.current) return false;
    if (signedOutRef.current) return false;
    if (isSharePath(pathnameRef.current)) {
      ackRoute(pathnameRef.current);
      return true;
    }

    const forced =
      window.__SYNCKERJA_SHARE_ROUTE__ ||
      (await readPendingRoute());
    if (
      forced &&
      isSharePath(forced) &&
      !isBlockedShareToPublishDestination(forced) &&
      !isBouncedDestination(forced)
    ) {
      goTo(forced);
      return true;
    }

    const files = await readPendingFiles();
    if (!files.length) {
      return false;
    }

    const dest = resolveShareDestination(files);
    if (!dest || isBlockedShareToPublishDestination(dest) || isBouncedDestination(dest)) return false;
    goTo(dest);
    return true;
  }, [ackRoute, goTo, isBouncedDestination]);

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
      if (signedOutRef.current) {
        void cancelShareWhileSignedOut();
        return;
      }
      clearShareToPublishDismissed();
      bouncedDestsRef.current.clear();
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
  }, [cancelShareWhileSignedOut, goTo, maybeNavigateToShareValidation]);

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
      if (!cancelled) await clearStalePendingRoute();
    };

    void runRetries();

    return () => {
      cancelled = true;
    };
  }, [ackRoute, maybeNavigateToShareValidation, location.pathname]);

  return null;
}
