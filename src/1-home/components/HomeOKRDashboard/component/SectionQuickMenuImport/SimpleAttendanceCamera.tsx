import React, { useState, useRef, useCallback, useMemo } from 'react';
import Webcam from 'react-webcam';
import { Button } from '@/shared/components/ui/button';
import { Camera, MapPin, CheckCircle, Loader2, VideoOff } from 'lucide-react';
import { useSimpleAttendance } from '../../../../hooks/useSimpleAttendance';
import { FaceRegistrationDialog } from '../../../../components/FaceRegistrationDialog';
import { LateReasonModal } from '../../../../components/LateReasonModal';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { format, isValid } from 'date-fns';

/** Prefer front camera with modest resolution; avoids overly strict constraints that fail on some laptops. */
const WEBCAM_VIDEO_STANDARD: MediaStreamConstraints['video'] = {
  facingMode: 'user',
  width: { ideal: 640, max: 1920 },
  height: { ideal: 480, max: 1080 },
};

export const SimpleAttendanceCamera = ({ onAttendanceUpdate, onCameraStateChange }: { onAttendanceUpdate?: () => void; onCameraStateChange?: (isActive: boolean) => void }) => {
  const { t, dateFnsLocale } = useAppTranslation();
  const webcamRef = useRef<Webcam>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [actionType, setActionType] = useState<'checkin' | 'checkout' | null>(null);
  const [showFaceRegistration, setShowFaceRegistration] = useState(false);
  const [capturedImageForRegistration, setCapturedImageForRegistration] = useState<string>('');
  const [cameraSession, setCameraSession] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  /** After failure, retry with minimal constraints (`true`) so more devices succeed. */
  const [useBasicVideoConstraints, setUseBasicVideoConstraints] = useState(false);

  const videoConstraints = useMemo((): MediaStreamConstraints['video'] => {
    return useBasicVideoConstraints ? true : WEBCAM_VIDEO_STANDARD;
  }, [useBasicVideoConstraints]);
  
  const { 
    handleSimpleAttendance, 
    loading, 
    hasCheckedIn, 
    hasCheckedOut, 
    lastCheckIn,
    lastCheckOut,
    showLateReasonModal,
    lateMinutes,
    saveLateReason,
    closeLateReasonModal
  } = useSimpleAttendance();

  const handleClockAction = useCallback(async (type: 'checkin' | 'checkout') => {
    setActionType(type);
    setCameraError(null);
    setCameraReady(false);
    setUseBasicVideoConstraints(false);
    setCameraSession((s) => s + 1);
    setShowCamera(true);
    onCameraStateChange?.(true);
  }, [onCameraStateChange]);

  const handleUserMedia = useCallback(() => {
    setCameraReady(true);
    setCameraError(null);
  }, []);

  const handleUserMediaError = useCallback(
    (err: string | DOMException) => {
      setCameraReady(false);
      const name = typeof err === 'object' && err && 'name' in err ? (err as DOMException).name : '';
      let message: string;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        message = t(
          'quickMenu.cameraDenied',
          'Akses kamera ditolak. Izinkan kamera di ikon gembok/izin di bilah alamat browser, lalu ketuk Coba lagi.',
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        message = t('quickMenu.cameraNotFound', 'Tidak ada kamera yang terdeteksi di perangkat ini.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        message = t(
          'quickMenu.cameraBusy',
          'Kamera sedang dipakai aplikasi lain atau tidak bisa dibuka. Tutup aplikasi lain yang memakai kamera, lalu coba lagi.',
        );
      } else {
        message =
          typeof err === 'string'
            ? err
            : (err as DOMException)?.message ||
              t('quickMenu.cameraFailed', 'Kamera tidak bisa diaktifkan.');
      }
      setCameraError(message);
    },
    [t],
  );

  const retryCamera = useCallback(() => {
    setCameraError(null);
    setCameraReady(false);
    setCameraSession((s) => s + 1);
  }, []);

  const retryCameraBasic = useCallback(() => {
    setUseBasicVideoConstraints(true);
    setCameraError(null);
    setCameraReady(false);
    setCameraSession((s) => s + 1);
  }, []);

  const captureAndSubmit = useCallback(async () => {
    if (!webcamRef.current || !actionType) return;

    setIsCapturing(true);
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        try {
          await handleSimpleAttendance(actionType, imageSrc);
          setShowCamera(false);
          setActionType(null);
          onCameraStateChange?.(false);
          onAttendanceUpdate?.();
        } catch (error) {
          // Check if error is related to face registration
          if (error instanceof Error && error.message.includes('Wajah tidak terdaftar')) {
            setCapturedImageForRegistration(imageSrc);
            setShowFaceRegistration(true);
          } else {
            throw error; // Re-throw other errors
          }
        }
      }
    } catch {
      // Clock action failed; toast handled by useSimpleAttendance
    } finally {
      setIsCapturing(false);
    }
  }, [actionType, handleSimpleAttendance, onAttendanceUpdate]);

  const handleFaceRegistrationSuccess = useCallback(() => {
    setShowFaceRegistration(false);
    setCapturedImageForRegistration('');
    // Retry attendance after successful face registration
    if (capturedImageForRegistration && actionType) {
      handleSimpleAttendance(actionType, capturedImageForRegistration)
        .then(() => {
          setShowCamera(false);
          setActionType(null);
          onCameraStateChange?.(false);
          onAttendanceUpdate?.();
        })
        .catch((error) => {
          console.error('Retry attendance failed:', error);
        });
    }
  }, [capturedImageForRegistration, actionType, handleSimpleAttendance, onAttendanceUpdate]);

  const cancelCapture = useCallback(() => {
    setShowCamera(false);
    setActionType(null);
    setCameraError(null);
    setCameraReady(false);
    setUseBasicVideoConstraints(false);
    onCameraStateChange?.(false);
  }, [onCameraStateChange]);

  if (showCamera) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-blue-600 mb-4">
          <Camera className="h-5 w-5" />
          <span className="text-sm font-semibold">
            {actionType === 'checkin' ? t('quickMenu.clockIn', 'Clock In') : t('quickMenu.clockOut', 'Clock Out')} - {t('quickMenu.takePhoto', 'Take Photo')}
          </span>
        </div>
        
        <div className="relative aspect-video w-full min-h-[200px] overflow-hidden rounded-lg bg-muted">
          <Webcam
            key={cameraSession}
            ref={webcamRef}
            audio={false}
            mirrored
            playsInline
            screenshotFormat="image/jpeg"
            screenshotQuality={0.92}
            videoConstraints={videoConstraints}
            onUserMedia={handleUserMedia}
            onUserMediaError={handleUserMediaError}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {!cameraReady && !cameraError && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground"
              aria-live="polite"
            >
              <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
              <span className="max-w-[90%] text-center text-sm">
                {t('quickMenu.cameraStarting', 'Menghidupkan kamera…')}
              </span>
            </div>
          )}
          {cameraError && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-muted p-4 text-center"
              role="alert"
            >
              <VideoOff className="h-12 w-12 text-muted-foreground" aria-hidden />
              <p className="text-sm text-foreground">{cameraError}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" size="sm" variant="default" onClick={retryCamera}>
                  {t('quickMenu.cameraRetry', 'Coba lagi')}
                </Button>
                {!useBasicVideoConstraints && (
                  <Button type="button" size="sm" variant="outline" onClick={retryCameraBasic}>
                    {t('quickMenu.cameraRetryBasic', 'Mode kamera sederhana')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={captureAndSubmit}
            disabled={isCapturing || !cameraReady || !!cameraError}
            className="flex-1"
          >
            {isCapturing ? t('quickMenu.processing', 'Processing...') : t('quickMenu.confirm', 'Confirm')} {actionType === 'checkin' ? t('quickMenu.clockIn', 'Clock In') : t('quickMenu.clockOut', 'Clock Out')}
          </Button>
          <Button 
            variant="outline" 
            onClick={cancelCapture}
            disabled={isCapturing}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-gray-600 mb-3">
        <MapPin className="h-5 w-5" />
        <span className="text-xs font-medium">{t('quickMenu.attendanceSystem', 'Attendance System')}</span>
      </div>

      {/* Success banners */}
      {hasCheckedIn && lastCheckIn && (
        <div className="bg-muted border border-border rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 text-foreground">
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm font-semibold">{t('quickMenu.clockInSuccess', 'Clock In Successful!')}</span>
          </div>
          <p className="text-success-foreground text-xs mt-1">
            {t('quickMenu.time', 'Time')}:{' '}
            {(() => {
              const d = new Date(lastCheckIn);
              return isValid(d)
                ? format(d, 'HH:mm:ss', { locale: dateFnsLocale })
                : String(lastCheckIn);
            })()}
          </p>
        </div>
      )}

      {hasCheckedOut && lastCheckOut && (
        <div className="bg-muted border border-border rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 text-foreground">
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm font-semibold">{t('quickMenu.clockOutSuccess', 'Clock Out Successful!')}</span>
          </div>
          <p className="mt-1 text-xs text-primary">
            {t('quickMenu.time', 'Time')}:{' '}
            {(() => {
              const d = new Date(lastCheckOut);
              return isValid(d)
                ? format(d, 'HH:mm:ss', { locale: dateFnsLocale })
                : String(lastCheckOut);
            })()}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button 
          onClick={() => handleClockAction('checkin')}
          disabled={loading || hasCheckedIn}
          className={`flex items-center gap-2 text-sm font-semibold ${hasCheckedIn ? 'bg-gray-400 cursor-not-allowed' : ''}`}
        >
          <Camera className="h-4 w-4" />
          {t('quickMenu.clockIn', 'Clock In')}
        </Button>
        
        <Button 
          onClick={() => handleClockAction('checkout')}
          disabled={loading || !hasCheckedIn || hasCheckedOut}
          variant="outline"
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <Camera className="h-4 w-4" />
          {t('quickMenu.clockOut', 'Clock Out')}
        </Button>
      </div>

      {loading && (
        <div className="text-center text-gray-600 text-sm">
          {t('quickMenu.processingAttendance', 'Processing attendance...')}
        </div>
      )}

      <FaceRegistrationDialog
        isOpen={showFaceRegistration}
        onClose={() => {
          setShowFaceRegistration(false);
          setCapturedImageForRegistration('');
        }}
        onSuccess={handleFaceRegistrationSuccess}
        capturedImage={capturedImageForRegistration}
      />

      <LateReasonModal
        isOpen={showLateReasonModal}
        onClose={closeLateReasonModal}
        onSubmit={saveLateReason}
        lateMinutes={lateMinutes}
      />
    </div>
  );
};
