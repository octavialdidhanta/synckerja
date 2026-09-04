import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  Flashlight,
  ScanBarcode,
  QrCode,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/shared/components/ui/drawer";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { usePosCashierIsPhoneLayout } from "../../hooks/usePosCashierIsPhoneLayout";
import { POS_CASHIER_I18N } from "../../lib/posCashierCopy";

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

function getBarcodeDetectorCtor(): BarcodeDetectorCtor | null {
  const w = window as Window & { BarcodeDetector?: BarcodeDetectorCtor };
  return w.BarcodeDetector ?? null;
}

type TorchCaps = MediaTrackCapabilities & { torch?: boolean };

function trackSupportsTorch(track: MediaStreamTrack | null | undefined): boolean {
  if (!track || typeof track.getCapabilities !== "function") return false;
  try {
    const caps = track.getCapabilities() as TorchCaps;
    return Boolean(caps.torch);
  } catch {
    return false;
  }
}

/** Chromium/Android: continuous torch via MediaStreamTrack constraints. */
async function applyTrackTorch(track: MediaStreamTrack, on: boolean): Promise<boolean> {
  try {
    await track.applyConstraints({
      advanced: [{ torch: on } as unknown as MediaTrackConstraintSet],
    });
    return true;
  } catch {
    try {
      await track.applyConstraints({
        torch: on,
      } as MediaTrackConstraints);
      return true;
    } catch {
      return false;
    }
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (raw: string) => void;
};

/** Multi-line glowing scan band (Gojek / QRIS style). */
function PosScanBeamLines({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("absolute inset-x-0 z-[1] h-[7.5rem] animate-pos-scan-beam", className)}
      style={{
        backgroundImage: [
          "repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(56,189,248,0.08) 2px, rgba(125,211,252,0.55) 3px, rgba(14,165,233,0.35) 4px, transparent 5px, transparent 7px)",
          "linear-gradient(to bottom, transparent 0%, rgba(56,189,248,0.2) 40%, rgba(34,211,238,0.45) 50%, rgba(56,189,248,0.2) 60%, transparent 100%)",
        ].join(", "),
        boxShadow:
          "0 0 18px 4px rgba(56,189,248,0.55), 0 0 40px 12px rgba(34,211,238,0.35)",
        filter: "saturate(1.25)",
      }}
    />
  );
}

function CircleIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-md active:scale-95"
    >
      {children}
    </button>
  );
}

/**
 * Camera barcode/QR scanner — Gojek/QRIS-style full-bleed UI on phone.
 * Video stays hidden until playing so the browser play glyph never flashes.
 */
export function PosCameraBarcodeScanDialog({ open, onOpenChange, onScan }: Props) {
  const { t } = useAppTranslation();
  const isPhone = usePosCashierIsPhoneLayout();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const handledRef = useRef(false);

  const stop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // Hide video in the DOM *before* clearing the stream — otherwise Chromium
    // flashes the play-glyph for a frame while the drawer is still closing.
    const video = videoRef.current;
    if (video) {
      video.style.opacity = "0";
      video.style.visibility = "hidden";
      video.style.pointerEvents = "none";
      try {
        video.pause();
      } catch {
        /* ignore */
      }
    }
    setCameraReady(false);
    setTorchOn(false);
    setTorchSupported(false);

    const stream = streamRef.current;
    streamRef.current = null;
    if (video) {
      video.srcObject = null;
      try {
        video.removeAttribute("src");
        video.load();
      } catch {
        /* ignore */
      }
    }
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const requestClose = useCallback(() => {
    // Hide immediately on back tap (before Vaul close animation).
    setCameraReady(false);
    const video = videoRef.current;
    if (video) {
      video.style.opacity = "0";
      video.style.visibility = "hidden";
    }
    stop();
    onOpenChange(false);
  }, [onOpenChange, stop]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setCameraReady(false);
        const video = videoRef.current;
        if (video) {
          video.style.opacity = "0";
          video.style.visibility = "hidden";
        }
        stop();
      }
      onOpenChange(next);
    },
    [onOpenChange, stop],
  );

  const setTorch = useCallback(async (on: boolean) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const ok = await applyTrackTorch(track, on);
    if (ok) {
      setTorchOn(on);
      setTorchSupported(true);
      return;
    }
    setTorchSupported(false);
    setTorchOn(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      setError(null);
      setUnsupported(false);
      handledRef.current = false;
      return;
    }

    const Detector = getBarcodeDetectorCtor();
    if (!Detector) {
      setUnsupported(true);
      return;
    }

    let cancelled = false;
    handledRef.current = false;
    setCameraReady(false);
    setError(null);

    const waitForVideoEl = (): Promise<HTMLVideoElement | null> =>
      new Promise((resolve) => {
        const tryNow = () => {
          if (cancelled) {
            resolve(null);
            return;
          }
          const el = videoRef.current;
          if (el) {
            resolve(el);
            return;
          }
          requestAnimationFrame(tryNow);
        };
        tryNow();
      });

    const refreshTorchSupport = () => {
      const track = streamRef.current?.getVideoTracks()[0];
      setTorchSupported(trackSupportsTorch(track));
    };

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        refreshTorchSupport();

        const video = await waitForVideoEl();
        if (!video || cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          return;
        }

        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        video.disablePictureInPicture = true;

        const markReady = () => {
          if (cancelled) return;
          const el = videoRef.current;
          if (el) {
            el.style.opacity = "";
            el.style.visibility = "";
            el.style.pointerEvents = "";
          }
          setCameraReady(true);
          // Torch capability often appears only after the track is live.
          refreshTorchSupport();
        };
        video.addEventListener("playing", markReady, { once: true });

        try {
          await video.play();
        } catch {
          /* autoplay may reject briefly */
        }
        if (video.readyState >= 2) markReady();

        const detector = new Detector({
          formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e"],
        });

        const tick = async () => {
          if (cancelled || handledRef.current) return;
          const el = videoRef.current;
          if (el && el.readyState >= 2) {
            try {
              const codes = await detector.detect(el);
              const raw = codes.find((c) => c.rawValue?.trim())?.rawValue?.trim();
              if (raw) {
                handledRef.current = true;
                setCameraReady(false);
                const v = videoRef.current;
                if (v) {
                  v.style.opacity = "0";
                  v.style.visibility = "hidden";
                }
                stop();
                onScan(raw);
                onOpenChange(false);
                return;
              }
            } catch {
              /* frame skip */
            }
          }
          rafRef.current = requestAnimationFrame(() => {
            void tick();
          });
        };
        rafRef.current = requestAnimationFrame(() => {
          void tick();
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, onOpenChange, onScan, stop]);

  const titleText = t(POS_CASHIER_I18N.scanCameraTitle, "Scan barcode");
  const showVideo = open && cameraReady;

  const cameraStage = (
    <div className="relative min-h-0 w-full flex-1 bg-slate-900">
      {unsupported ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900 px-6 text-center text-sm text-white/90">
          <ScanBarcode className="h-10 w-10 opacity-70" aria-hidden />
          <p>
            {t(
              POS_CASHIER_I18N.scanCameraUnsupported,
              "Camera barcode is not supported on this device. Use a Bluetooth HID scanner instead.",
            )}
          </p>
        </div>
      ) : error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 px-6 text-center text-sm text-red-200">
          {t(POS_CASHIER_I18N.scanCameraError, "Could not open camera")}: {error}
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            className={
              showVideo
                ? "absolute inset-0 z-0 h-full w-full object-cover"
                : "pointer-events-none absolute left-0 top-0 z-0 h-px w-px opacity-0"
            }
            playsInline
            muted
            autoPlay
            controls={false}
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
          />
          {/* Solid cover while closed / warming up — blocks Chromium play-glyph. */}
          {!showVideo ? (
            <div className="absolute inset-0 z-[1] bg-slate-900" aria-hidden />
          ) : null}

          {/* Top chrome — circular white buttons */}
          <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <CircleIconButton
              label={t(POS_CASHIER_I18N.scanCameraClose, "Close")}
              onClick={requestClose}
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
            </CircleIconButton>
            {torchSupported ? (
              <CircleIconButton
                label={
                  torchOn
                    ? t(POS_CASHIER_I18N.scanTorchOff, "Turn off flashlight")
                    : t(POS_CASHIER_I18N.scanTorchOn, "Turn on flashlight")
                }
                onClick={() => void setTorch(!torchOn)}
              >
                {torchOn ? (
                  <Flashlight className="h-5 w-5 text-amber-500" strokeWidth={2.25} fill="currentColor" />
                ) : (
                  <Flashlight className="h-5 w-5" strokeWidth={2.25} />
                )}
              </CircleIconButton>
            ) : (
              <span className="h-11 w-11" aria-hidden />
            )}
          </div>

          {/* Scan beam — full camera; soft edge fade so turnaround is not hard-clipped */}
          <div
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
            style={{
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, #000 10%, #000 90%, transparent 100%)",
              maskImage:
                "linear-gradient(to bottom, transparent 0%, #000 10%, #000 90%, transparent 100%)",
            }}
            aria-busy={!cameraReady}
          >
            <PosScanBeamLines />
          </div>

          {/* Branding + CTA — pinned just above the bottom sheet */}
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex flex-col items-center gap-2.5 px-6">
            <p className="text-center text-[13px] font-medium tracking-wide text-white drop-shadow-md">
              {t(POS_CASHIER_I18N.scanPoweredBy, "Powered by Synckerja POS")}
            </p>
            <div
              className="inline-flex max-w-full items-center gap-2 rounded-full px-3.5 py-2 text-white shadow-lg"
              style={{
                background: "linear-gradient(90deg, #22d3ee 0%, #22c55e 100%)",
              }}
            >
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/25">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              <span className="truncate text-[13px] font-semibold leading-tight">
                {t(POS_CASHIER_I18N.scanAcceptHere, "Scan barcode / QR di sini")}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const bottomSheet = (
    <div className="relative z-30 flex-shrink-0 rounded-t-[28px] bg-white px-4 pt-2 pb-[max(1.25rem,calc(env(safe-area-inset-bottom,0px)+1.25rem),var(--footer-bottom-inset,0px),3.25rem)] shadow-[0_-8px_30px_rgba(0,0,0,0.18)]">
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" aria-hidden />
      <div
        className="mb-3 flex items-center gap-3 rounded-2xl px-3.5 py-3 text-white"
        style={{
          background: "linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)",
        }}
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/20">
          <QrCode className="h-5 w-5" />
        </span>
        <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug">
          {t(
            POS_CASHIER_I18N.scanSheetHint,
            "Arahkan kamera ke QR tamu atau barcode produk",
          )}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-sky-600">
            <QrCode className="h-5 w-5" />
          </div>
          <p className="text-[12px] font-semibold leading-snug text-slate-800">
            {t(POS_CASHIER_I18N.scanTipGuestQr, "QR pesanan tamu")}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <ScanBarcode className="h-5 w-5" />
          </div>
          <p className="text-[12px] font-semibold leading-snug text-slate-800">
            {t(POS_CASHIER_I18N.scanTipProduct, "Barcode produk")}
          </p>
        </div>
      </div>
    </div>
  );

  if (isPhone) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange} dismissible>
        <DrawerContent
          aboveAppNav={false}
          smoothFast
          className="z-[70] flex h-[100dvh] max-h-[100dvh] flex-col gap-0 overflow-hidden rounded-none border-0 bg-black p-0 shadow-2xl [&>div:first-child]:hidden"
          overlayClassName="z-[70]"
        >
          <DrawerTitle className="sr-only">{titleText}</DrawerTitle>
          {cameraStage}
          {!unsupported && !error ? bottomSheet : null}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[min(92dvh,720px)] w-[min(94vw,420px)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-black p-0 shadow-xl [&>button.absolute]:hidden"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{titleText}</DialogTitle>
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="relative min-h-[360px] flex-1">{cameraStage}</div>
          {!unsupported && !error ? bottomSheet : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
