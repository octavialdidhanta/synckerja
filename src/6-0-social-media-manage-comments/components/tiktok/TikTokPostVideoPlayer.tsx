import { memo, useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  isTikTokPhotoPost,
  isTikTokPlayerMessage,
  postTikTokPlayerMessage,
  resolveTikTokVideoId,
  tiktokVideoPlayerSrc,
} from "@/6-0-social-media-manage-comments/lib/tiktokVideoEmbed";
import { cn } from "@/shared/lib/utils";

type TikTokPostVideoPlayerProps = {
  videoId: string;
  shareUrl: string | null;
  coverImageUrl: string | null;
  title: string;
  duration?: number | null;
  className?: string;
};

const NATIVE_READY_TIMEOUT_MS = 5000;

/**
 * Compact TikTok player/v1. Iframe mounts on tap with autoplay so the gesture
 * is not swallowed by nested overflow. A local speaker button unmutes via postMessage.
 * Native WebView often rejects localhost referrers — omit referrer and fall back
 * to the TikTok app/browser if the player reports an error.
 */
export const TikTokPostVideoPlayer = memo(function TikTokPostVideoPlayer({
  videoId,
  shareUrl,
  coverImageUrl,
  title,
  duration = null,
  className,
}: TikTokPostVideoPlayerProps) {
  const { t } = useTranslation();
  const resolvedId = resolveTikTokVideoId(videoId, shareUrl);
  const isPhotoPost = isTikTokPhotoPost(shareUrl, duration);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playerReady, setPlayerReady] = useState(false);
  const [nativeFailed, setNativeFailed] = useState(false);
  const isNative = Capacitor.isNativePlatform();
  const watchUrl = shareUrl?.trim() || (resolvedId ? `https://www.tiktok.com/video/${resolvedId}` : null);

  useEffect(() => {
    setPlaying(false);
    setMuted(true);
    setPlayerReady(false);
    setNativeFailed(false);
  }, [resolvedId]);

  const sendUnmute = useCallback(() => {
    postTikTokPlayerMessage(iframeRef.current, "unMute");
  }, []);

  const openOnTikTok = useCallback(async () => {
    if (!watchUrl) return;
    if (isNative) {
      await Browser.open({ url: watchUrl });
      return;
    }
    window.open(watchUrl, "_blank", "noopener,noreferrer");
  }, [isNative, watchUrl]);

  useEffect(() => {
    if (!playing) return;
    const onMessage = (event: MessageEvent) => {
      if (!isTikTokPlayerMessage(event, iframeRef.current)) return;
      const type = String(event.data.type ?? "");
      if (type === "onPlayerReady") {
        setPlayerReady(true);
        sendUnmute();
      }
      if (type === "onMute") setMuted(Boolean(event.data.value));
      if (type === "onPlayerError" || type === "onError") {
        if (isNative) setNativeFailed(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [playing, sendUnmute, isNative]);

  useEffect(() => {
    if (!playing || !isNative || isPhotoPost || playerReady || nativeFailed) return;
    const timer = window.setTimeout(() => setNativeFailed(true), NATIVE_READY_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [playing, isNative, isPhotoPost, playerReady, nativeFailed]);

  if (!resolvedId) {
    return coverImageUrl ? (
      <div className={cn("mx-auto w-full max-w-[325px]", className)}>
        <img
          src={coverImageUrl}
          alt=""
          className="aspect-[9/16] w-full object-cover"
        />
      </div>
    ) : null;
  }

  const embedSrc = tiktokVideoPlayerSrc(resolvedId, {
    isPhotoPost,
    autoplay: playing && !isPhotoPost,
  });

  return (
    <div
      className={cn(
        "relative mx-auto aspect-[9/16] w-full max-w-[325px] isolate overflow-hidden bg-black",
        className,
      )}
    >
      {playing || isPhotoPost ? (
        <iframe
          ref={iframeRef}
          key={`${resolvedId}-${playing ? "play" : "idle"}`}
          title={title}
          src={embedSrc}
          className={cn(
            "absolute inset-0 z-10 h-full w-full border-0",
            nativeFailed ? "invisible" : null,
          )}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          referrerPolicy={isNative ? "no-referrer" : "strict-origin-when-cross-origin"}
        />
      ) : (
        <>
          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-black" />
          )}
          <button
            type="button"
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/20"
            aria-label="Play"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              flushSync(() => setPlaying(true));
            }}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/70">
              <span className="ml-1 h-0 w-0 border-y-[10px] border-y-transparent border-l-[18px] border-l-white" />
            </span>
          </button>
        </>
      )}
      {nativeFailed && watchUrl ? (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/70 px-4">
          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
            />
          ) : null}
          <button
            type="button"
            className="relative z-10 rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void openOnTikTok();
            }}
          >
            {t("digitalMarketing.manageComments.openOnTikTok", "Open on TikTok")}
          </button>
        </div>
      ) : null}
      {playing && !isPhotoPost && !nativeFailed ? (
        <button
          type="button"
          className="absolute bottom-2 right-2 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white"
          aria-label={muted ? "Unmute" : "Mute"}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            postTikTokPlayerMessage(iframeRef.current, muted ? "unMute" : "mute");
            setMuted(!muted);
          }}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      ) : null}
    </div>
  );
});
