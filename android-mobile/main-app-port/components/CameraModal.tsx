import React, { useState, useRef, useCallback, useId } from "react";
import { Camera, CameraOff, RotateCcw } from "lucide-react";
import { Button } from "@/mobile-app/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { logger } from "@/shared/lib/logger";
import { Skeleton } from "@/mobile-app/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useToast } from "@/mobile-app/components/ui/use-toast";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MobileFormModalFooter } from "@/mobile-app/components/MobileFormModalFooter";

const cameraFullscreenShellClass =
  "fixed left-0 right-0 top-0 bottom-0 z-[80] m-0 flex max-h-none min-h-0 w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-black p-0";

/** Siluet kepala saja: tengkorak, telinga, rahang, dagu. Koordinat viewBox 360×640. */
const HEAD_GUIDE_PATH =
  "M180 188 C192 188 205.7 191 216 196 C226.3 201 235 209 242 218 C249 227 254 238.3 258 250 C262 261.7 265 277 266 288 C267 299 262.3 308.7 264 316 C265.7 323.3 272.3 325 276 332 C279.7 339 286 349.7 286 358 C286 366.3 280.7 375.7 276 382 C271.3 388.3 263 389.3 258 396 C253 402.7 250.7 413.3 246 422 C241.3 430.7 235.3 441.7 230 448 C224.7 454.3 219.3 456 214 460 C208.7 464 203.7 469.3 198 472 C192.3 474.7 186 476 180 476 C174 476 167.7 474.7 162 472 C156.3 469.3 151.3 464 146 460 C140.7 456 135.3 454.3 130 448 C124.7 441.7 118.7 430.7 114 422 C109.3 413.3 107 402.7 102 396 C97 389.3 88.7 388.3 84 382 C79.3 375.7 74 366.3 74 358 C74 349.7 80.3 339 84 332 C87.7 325 94.3 323.3 96 316 C97.7 308.7 93 299 94 288 C95 277 98 261.7 102 250 C106 238.3 111 227 118 218 C125 209 133.7 201 144 196 C154.3 191 168 188 180 188 Z";

function FaceGuide({ hint }: { hint: string }) {
  const rawId = useId().replace(/:/g, "");
  const pathId = `head-guide-${rawId}`;
  const maskId = `head-mask-${rawId}`;
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 360 640"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          <path id={pathId} d={HEAD_GUIDE_PATH} />
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="360" height="640">
            <rect width="360" height="640" fill="white" />
            <use href={`#${pathId}`} fill="black" />
          </mask>
        </defs>
        <rect width="360" height="640" fill="rgba(0,0,0,0.55)" mask={`url(#${maskId})`} />
        <use
          href={`#${pathId}`}
          fill="none"
          stroke="white"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray="14 10"
        />
      </svg>
      <p className="absolute inset-x-6 top-[max(0.75rem,env(safe-area-inset-top,0px),var(--safe-area-inset-top,0px))] text-center text-sm font-medium text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
        {hint}
      </p>
    </div>
  );
}

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageData: string) => void;
  title: string;
  /** Selfie (absensi) vs belakang (receipt/dokumen). Default user. */
  facingMode?: "user" | "environment";
  /** Full viewport shell (default: true on mobile). */
  fullscreen?: boolean;
  /** Bingkai wajah di kamera depan (absensi) supaya wajah berada di area itu. */
  faceGuide?: boolean;
  /** Naikkan z-index saat modal ini ditumpuk di atas dialog fullscreen lain */
  overlayClassName?: string;
  contentClassName?: string;
}

export const CameraModal = ({
  isOpen,
  onClose,
  onCapture,
  title,
  facingMode = "user",
  fullscreen,
  faceGuide = false,
  overlayClassName,
  contentClassName,
}: CameraModalProps) => {
  const { toast } = useToast();
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const isFullscreen = fullscreen ?? isMobile;
  /** Selfie: mirror preview & capture. Kamera belakang (receipt): tanpa flip. */
  const mirrorPreview = facingMode === "user";
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setIsLoading(true);
      setCameraError(false);
      const preferEnv =
        facingMode === "environment"
          ? ({ facingMode: { ideal: "environment" as const } } as const)
          : ({ facingMode: "user" as const } as const);

      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: preferEnv });
      } catch (firstErr) {
        if (facingMode === "environment") {
          logger.warn("environment camera unavailable, falling back to default:", firstErr);
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        } else {
          throw firstErr;
        }
      }
      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      logger.error("Error accessing camera:", error);
      setCameraError(true);
      setStream(null);
      streamRef.current = null;
      toast({
        title: t("cameraModal.errorTitle", "Camera error"),
        description: t(
          "cameraModal.errorDesc",
          "Cannot access the camera. Please grant camera permission.",
        ),
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, facingMode, t]);

  const stopCamera = useCallback(() => {
    const current = streamRef.current;
    if (current) {
      current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsVideoPlaying(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth <= 0 || video.videoHeight <= 0) {
      toast({
        title: t("cameraModal.notReadyTitle", "Camera not ready"),
        description: t("cameraModal.notReadyDesc", "Wait for the preview then try again."),
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    if (mirrorPreview) {
      context.save();
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      context.restore();
    } else {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    const imageData = canvas.toDataURL("image/jpeg", 0.8);
    if (imageData && imageData.length > 0) {
      setCapturedImage(imageData);
    }
  }, [toast, mirrorPreview, t]);

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      handleClose();
    }
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setCameraError(false);
    onClose();
  };

  const retakePhoto = () => {
    stopCamera();
    setCapturedImage(null);
  };

  React.useEffect(() => {
    if (isOpen && !stream && !capturedImage) {
      void startCamera();
    }
    return () => {
      if (!isOpen) {
        stopCamera();
      }
    };
  }, [isOpen, stream, capturedImage, startCamera, stopCamera]);

  React.useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const previewViewportClass = isFullscreen
    ? "relative min-h-0 flex-1 overflow-hidden bg-black"
    : "relative aspect-square overflow-hidden rounded-lg bg-muted";

  const renderPreview = () => (
    <div className={previewViewportClass}>
      {!capturedImage ? (
        <>
          {stream ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={cn(
                  "absolute inset-0 h-full w-full object-cover",
                  mirrorPreview && "scale-x-[-1]",
                  !isVideoPlaying && "pointer-events-none opacity-0",
                )}
                onPlaying={() => setIsVideoPlaying(true)}
                onCanPlay={() => setIsVideoPlaying(true)}
              />
              {!isVideoPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <Skeleton className="h-24 w-24 rounded-lg" />
                </div>
              )}
            </>
          ) : cameraError && !isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted px-4 text-center">
              <CameraOff className="h-14 w-14 shrink-0 text-muted-foreground opacity-80" aria-hidden />
              <p className="text-sm text-muted-foreground">
                {t("cameraModal.unavailable", "Cannot open camera")}
              </p>
              <Button type="button" size="sm" variant="secondary" onClick={() => void startCamera()}>
                {t("quickMenu.cameraRetry", "Try again")}
              </Button>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <Skeleton className="h-24 w-24 rounded-lg" />
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </>
      ) : (
        <img src={capturedImage} alt="Captured" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {faceGuide && !cameraError ? <FaceGuide hint={t("cameraModal.faceGuide", "Place your face inside the frame")} /> : null}
    </div>
  );

  const renderActions = () => {
    if (isFullscreen) {
      return (
        <MobileFormModalFooter className="camera-footer-safe relative z-20 border-white/10 bg-black [&>div]:w-full">
          {!capturedImage ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="h-11 flex-1 border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                type="button"
                onClick={capturePhoto}
                disabled={!stream || isLoading || !isVideoPlaying}
                className="h-11 flex-1"
              >
                <Camera className="h-4 w-4" />
                {t("cameraModal.capture", "Take photo")}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={retakePhoto}
                className="h-11 flex-1 border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                {t("cameraModal.retake", "Retake")}
              </Button>
              <Button type="button" onClick={handleConfirm} className="h-11 flex-1">
                {t("cameraModal.confirm", "Confirm")}
              </Button>
            </>
          )}
        </MobileFormModalFooter>
      );
    }

    return (
      <div className="flex w-full gap-2">
        {!capturedImage ? (
          <>
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="button"
              onClick={capturePhoto}
              disabled={!stream || isLoading || !isVideoPlaying}
              className="flex-1"
            >
              <Camera className="mr-2 h-4 w-4" />
              {t("cameraModal.capture", "Take photo")}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={retakePhoto} className="flex-1">
              <RotateCcw className="mr-2 h-4 w-4" />
              {t("cameraModal.retake", "Retake")}
            </Button>
            <Button type="button" onClick={handleConfirm} className="flex-1">
              {t("cameraModal.confirm", "Confirm")}
            </Button>
          </>
        )}
      </div>
    );
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent
        overlayClassName={cn(
          isFullscreen && "fixed inset-0 !bottom-0 z-[80] bg-black/90",
          overlayClassName,
        )}
        className={cn(
          isFullscreen
            ? cn(cameraFullscreenShellClass, contentClassName)
            : cn("mx-auto w-full max-w-md gap-4 p-6", contentClassName),
        )}
        fullscreenAnimation={isFullscreen}
        hideCloseButton={isFullscreen}
      >
        {isFullscreen ? (
          <>
            <DialogTitle className="sr-only">{title}</DialogTitle>
            <DialogDescription className="sr-only">{title}</DialogDescription>

            <div className="flex min-h-0 flex-1 flex-col bg-black">
              {renderPreview()}
              {renderActions()}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                {title}
              </DialogTitle>
              <DialogDescription className="sr-only">{title}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {renderPreview()}
              {renderActions()}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
