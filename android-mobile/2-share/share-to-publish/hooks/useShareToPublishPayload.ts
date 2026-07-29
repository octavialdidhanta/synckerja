import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { ShareIntent } from "@/plugins/share-intent";
import {
  clearShareToPublishDismissed,
  dismissShareToPublishSession,
  isShareToPublishDismissed,
} from "@/shared/native/shareToPublishSession";
import {
  shareIntentItemToVideo,
  type SharePublishVideo,
} from "../lib/sharePublishVideo";

type Cache = {
  videos: SharePublishVideo[] | null;
  loadError: string | null;
};

/** Wait for native background copy after immediate navigate to /share/publish. */
const WAIT_FOR_COPY_MS = 45_000;
const POLL_INTERVAL_MS = 400;

let payloadCache: Cache = { videos: null, loadError: null };

type PendingRaw = {
  files: Array<{ path: string; name: string; mimeType: string; size?: number }>;
  error: string | null;
};

async function readPendingOnce(): Promise<PendingRaw> {
  const { files: raw, error } = await ShareIntent.getPendingPayload();
  return {
    files: Array.isArray(raw) ? raw : [],
    error: error && String(error).trim() ? String(error).trim() : null,
  };
}

/**
 * Poll native pending files until copy finishes, fails with error, or timeout.
 * Immediate navigate races the background copy — empty once ≠ failure.
 */
async function waitForPending(
  isCancelled: () => boolean,
): Promise<PendingRaw> {
  const started = Date.now();
  let lastError: string | null = null;
  while (!isCancelled() && Date.now() - started < WAIT_FOR_COPY_MS) {
    const pending = await readPendingOnce();
    if (pending.files.length > 0) return pending;
    if (pending.error) {
      lastError = pending.error;
      // Native finished without files (too large / copy failed) — stop waiting.
      return pending;
    }
    await new Promise((r) => window.setTimeout(r, POLL_INTERVAL_MS));
  }
  if (isCancelled()) return { files: [], error: null };
  const finalPending = await readPendingOnce();
  if (!finalPending.error && lastError) finalPending.error = lastError;
  return finalPending;
}

function pendingToVideos(
  files: Array<{ path: string; name: string; mimeType: string; size?: number }>,
): SharePublishVideo[] {
  const out: SharePublishVideo[] = [];
  for (const item of files) {
    const video = shareIntentItemToVideo(item);
    if (video) out.push(video);
  }
  return out;
}

export function useShareToPublishPayload() {
  const hasCachedVideos = Boolean(payloadCache.videos && payloadCache.videos.length > 0);
  const [loading, setLoading] = useState(!hasCachedVideos);
  const [videos, setVideos] = useState<SharePublishVideo[]>(payloadCache.videos ?? []);
  const [loadError, setLoadError] = useState<string | null>(
    hasCachedVideos ? null : payloadCache.loadError,
  );
  const loadGenRef = useRef(0);

  const reload = useCallback(async () => {
    const gen = ++loadGenRef.current;
    const isCancelled = () => gen !== loadGenRef.current;
    setLoading(true);
    setLoadError(null);

    try {
      if (!Capacitor.isNativePlatform()) {
        payloadCache = {
          videos: null,
          loadError: "share.publish.errors.nativeOnly",
        };
        if (isCancelled()) return;
        setVideos([]);
        setLoadError(payloadCache.loadError);
        return;
      }

      if (isShareToPublishDismissed()) {
        payloadCache = { videos: null, loadError: "share.publish.errors.noVideo" };
        if (isCancelled()) return;
        setVideos([]);
        setLoadError(payloadCache.loadError);
        return;
      }

      const pending = await waitForPending(isCancelled);
      if (isCancelled()) return;

      if (!pending.files.length) {
        const err = pending.error || "share.publish.errors.noVideo";
        payloadCache = { videos: null, loadError: err };
        setVideos([]);
        setLoadError(err);
        return;
      }

      const nextVideos = pendingToVideos(pending.files);
      if (!nextVideos.length) {
        payloadCache = { videos: null, loadError: "share.publish.errors.noVideo" };
        setVideos([]);
        setLoadError(payloadCache.loadError);
        return;
      }

      payloadCache = { videos: nextVideos, loadError: null };
      setVideos(nextVideos);
      setLoadError(null);
    } catch (e) {
      if (isCancelled()) return;
      const msg = e instanceof Error ? e.message : "Failed to load shared video";
      payloadCache = { videos: null, loadError: msg };
      setVideos([]);
      setLoadError(msg);
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (payloadCache.videos && payloadCache.videos.length > 0) {
      setVideos(payloadCache.videos);
      setLoadError(null);
      setLoading(false);
      return;
    }

    let removeListener: (() => Promise<void>) | undefined;
    void reload();

    void ShareIntent.addListener("shareIntentReceived", () => {
      clearShareToPublishDismissed();
      if (!payloadCache.videos?.length) {
        void reload();
      }
    }).then((h) => {
      removeListener = () => h.remove();
    });

    return () => {
      loadGenRef.current += 1;
      void removeListener?.();
    };
  }, [reload]);

  const clearPayload = useCallback(async (options?: { keepLocalFiles?: boolean }) => {
    loadGenRef.current += 1;
    dismissShareToPublishSession();
    payloadCache = { videos: null, loadError: null };
    setVideos([]);
    setLoadError(null);
    setLoading(false);
    try {
      await ShareIntent.clearPendingRoute();
    } catch {
      /* ignore */
    }
    // After Drive upload succeeds we still need the cache file for <video> preview.
    // Defer file deletion until the user leaves the wizard (keepLocalFiles: false).
    if (!options?.keepLocalFiles) {
      try {
        await ShareIntent.clearPending();
      } catch {
        /* ignore */
      }
    }
  }, []);

  return {
    loading,
    videos,
    video: videos[0] ?? null,
    loadError,
    reload,
    clearPayload,
  };
}
