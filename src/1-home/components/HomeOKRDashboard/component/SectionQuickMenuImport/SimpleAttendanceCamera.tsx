
import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Button } from '@/shared/components/ui/button';
import { Camera, MapPin, CheckCircle } from 'lucide-react';
import { useSimpleAttendance } from '../../../../hooks/useSimpleAttendance';
import { FaceRegistrationDialog } from '../../../../components/FaceRegistrationDialog';
import { LateReasonModal } from '../../../../components/LateReasonModal';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { format } from 'date-fns';
import { id, enUS } from 'date-fns/locale';

export const SimpleAttendanceCamera = ({ onAttendanceUpdate, onCameraStateChange }: { onAttendanceUpdate?: () => void; onCameraStateChange?: (isActive: boolean) => void }) => {
  const { t, dateFnsLocale } = useAppTranslation();
  const webcamRef = useRef<Webcam>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [actionType, setActionType] = useState<'checkin' | 'checkout' | null>(null);
  const [showFaceRegistration, setShowFaceRegistration] = useState(false);
  const [capturedImageForRegistration, setCapturedImageForRegistration] = useState<string>('');
  
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
    setShowCamera(true);
    onCameraStateChange?.(true);
  }, [onCameraStateChange]);

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
        
        <div className="relative">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            className="w-full rounded-lg"
          />
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={captureAndSubmit}
            disabled={isCapturing}
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
            {t('quickMenu.time', 'Time')}: {format(new Date(lastCheckIn), "HH:mm:ss", { locale: dateFnsLocale })}
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
            {t('quickMenu.time', 'Time')}: {format(new Date(lastCheckOut), "HH:mm:ss", { locale: dateFnsLocale })}
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
