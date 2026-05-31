import { useCallback, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { Button } from '@/shared/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAttendanceOperations } from '@/2-3-employee-attendance/hooks/useAttendanceOperations';

/**
 * OKR objective attendance check-in via shared RPC hook (photo required).
 * Use from OKR views when clock-in from objectives is re-enabled.
 */
export function ObjectiveAttendanceCheckIn({
  label = 'Check In Absensi',
  onSuccess,
}: {
  label?: string;
  onSuccess?: () => void;
}) {
  const webcamRef = useRef<Webcam>(null);
  const [open, setOpen] = useState(false);
  const { checkIn, loading } = useAttendanceOperations();

  const handleCapture = useCallback(async () => {
    const image = webcamRef.current?.getScreenshot();
    if (!image) {
      toast.error('Gagal mengambil foto');
      return;
    }

    if (!navigator.geolocation) {
      toast.error('Geolocation tidak didukung browser ini');
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });

      const success = await checkIn({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        faceImageData: image,
        gpsAccuracyMeters:
          position.coords.accuracy > 0 ? position.coords.accuracy : null,
        isManualLocation: false,
      });

      if (success) {
        setOpen(false);
        onSuccess?.();
      }
    } catch (error) {
      if (error instanceof GeolocationPositionError) {
        toast.error('Akses lokasi ditolak atau tidak tersedia');
      } else {
        toast.error('Gagal melakukan check-in');
      }
    }
  }, [checkIn, onSuccess]);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Camera className="mr-2 h-4 w-4" />
        {label}
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <Webcam
        ref={webcamRef}
        audio={false}
        screenshotFormat="image/jpeg"
        videoConstraints={{ facingMode: 'user', width: 640, height: 480 }}
        className="w-full max-w-sm rounded-md"
      />
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={loading}>
          Batal
        </Button>
        <Button type="button" size="sm" onClick={handleCapture} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
          Ambil Foto & Check In
        </Button>
      </div>
    </div>
  );
}
