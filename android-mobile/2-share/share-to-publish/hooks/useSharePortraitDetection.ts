import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import type { SharePublishVideo } from "../lib/sharePublishVideo";

export function useSharePortraitDetection(video: SharePublishVideo | null | undefined) {
  const [isPortrait, setIsPortrait] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!video) {
      setIsPortrait(null);
      return;
    }

    let cancelled = false;
    setChecking(true);
    const url = Capacitor.convertFileSrc(video.path);
    const el = document.createElement("video");
    el.preload = "metadata";
    el.muted = true;
    el.playsInline = true;

    const cleanup = () => {
      el.removeAttribute("src");
      el.load();
    };

    el.onloadedmetadata = () => {
      if (cancelled) return;
      const w = el.videoWidth || 0;
      const h = el.videoHeight || 0;
      setIsPortrait(h > 0 && w > 0 ? h > w : null);
      setChecking(false);
      cleanup();
    };
    el.onerror = () => {
      if (cancelled) return;
      setIsPortrait(null);
      setChecking(false);
      cleanup();
    };
    el.src = url;

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [video?.path]);

  return { isPortrait, checking };
}
