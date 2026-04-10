import React, { useState, useRef, useCallback } from "react";
import { Camera, CameraOff, X, RotateCcw } from "lucide-react";
import { Button } from "@/mobile/components/ui/button";
import { cn } from "@/lib/utils";
import { logger } from "@/config/logger";
import { Skeleton } from "@/mobile/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/mobile/components/ui/dialog";
import { useToast } from "@/mobile/components/ui/use-toast";

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageData: string) => void;
  title: string;
  /** Selfie (absensi) vs belakang (receipt/dokumen). Default user. */
  facingMode?: "user" | "environment";
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
  overlayClassName,
  contentClassName,
}: CameraModalProps) => {
  const { toast } = useToast();
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
        // Emulator / perangkat tanpa kamera belakang: minta kamera default agar preview tetap jalan.
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
        title: "Error Kamera",
        description: "Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, facingMode]);

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
        title: "Kamera belum siap",
        description: "Tunggu preview kamera tampil lalu coba lagi.",
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
  }, [toast, mirrorPreview]);

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
    if (isOpen && !stream) {
      startCamera();
    }
    return () => {
      if (!isOpen) {
        stopCamera();
      }
    };
  }, [isOpen, stream, startCamera, stopCamera]);

  // Set video srcObject when stream becomes available (video element may mount after stream is set)
  React.useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent
        overlayClassName={overlayClassName}
        className={cn("max-w-md w-full mx-auto", contentClassName)}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Ambil foto menggunakan kamera untuk absensi
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
            {!capturedImage ? (
              <>
                {stream ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${mirrorPreview ? "scale-x-[-1]" : ""} ${isVideoPlaying ? "opacity-100" : "opacity-0 absolute inset-0 pointer-events-none"}`}
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
                    <CameraOff className="h-14 w-14 text-muted-foreground shrink-0 opacity-80" aria-hidden />
                    <p className="text-sm text-muted-foreground">Tidak dapat membuka kamera</p>
                    <Button type="button" size="sm" variant="secondary" onClick={() => void startCamera()}>
                      Coba lagi
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
              <img
                src={capturedImage}
                alt="Captured"
                className="w-full h-full object-cover"
              />
            )}
          </div>

          <div className="flex gap-2">
            {!capturedImage ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Batal
                </Button>
                <Button
                  onClick={capturePhoto}
                  disabled={!stream || isLoading || !isVideoPlaying}
                  className="flex-1"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Ambil Foto
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={retakePhoto}
                  className="flex-1"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Ulangi
                </Button>
                <Button
                  onClick={handleConfirm}
                  className="flex-1"
                >
                  Konfirmasi
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
