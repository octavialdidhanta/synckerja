
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, User, CheckCircle, X, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Progress } from '@/shared/components/ui/progress';
import { useEnhancedFaceRegistration } from '@/2-1-employees/MyInfo/Attendance/hooks/useEnhancedFaceRegistration';
import { validateFaceQuality, generateFaceDescriptor, areModelsLoaded, initializeFaceAPI } from '@/shared/utils/faceRecognition';

export const EnhancedFaceRegistration = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'camera' | 'capture' | 'process'>('camera');
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string>('');
  const [faceQuality, setFaceQuality] = useState<{ isValid: boolean; confidence: number; message: string } | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const { loading, registrations, registerFace, fetchRegistrations, checkFaceRegistration } = useEnhancedFaceRegistration();

  // Initialize face-api models
  const initializeModels = useCallback(async () => {
    if (areModelsLoaded()) {
      setModelsReady(true);
      return;
    }

    setModelsLoading(true);
    try {
      const success = await initializeFaceAPI();
      setModelsReady(success);
      if (!success) {
        console.error('Failed to initialize face recognition models');
      }
    } catch (error) {
      console.error('Error initializing face models:', error);
      setModelsReady(false);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  // Initialize camera
  const initializeCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        videoRef.current.onloadedmetadata = () => {
          setCameraReady(true);
        };
      }
    } catch (error) {
      console.error('Camera access error:', error);
    }
  }, []);

  // Cleanup camera
  const cleanupCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setCapturedImage('');
    setFaceQuality(null);
    setStep('camera');
  }, []);

  // Capture photo
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady || !modelsReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageData);
    setStep('capture');

    // Validate face quality
    const quality = await validateFaceQuality(imageData);
    setFaceQuality(quality);
  }, [cameraReady, modelsReady]);

  // Register face
  const handleRegisterFace = async () => {
    if (!capturedImage || !faceQuality?.isValid) return;

    setStep('process');
    try {
      const faceDescriptor = await generateFaceDescriptor(capturedImage);
      
      if (!faceDescriptor) {
        throw new Error('Failed to generate face descriptor');
      }

      // Convert Float32Array to string for storage
      const encodingString = Array.from(faceDescriptor).join(',');
      
      await registerFace(encodingString, capturedImage);
      
      setIsOpen(false);
      cleanupCamera();
      fetchRegistrations();
    } catch (error) {
      console.error('Face registration error:', error);
      setStep('capture');
    }
  };

  // Open modal and initialize
  const openModal = async () => {
    setIsOpen(true);
    await initializeModels();
    initializeCamera();
  };

  // Close modal and cleanup
  const closeModal = () => {
    setIsOpen(false);
    cleanupCamera();
  };

  useEffect(() => {
    fetchRegistrations();
    initializeModels();
    return () => cleanupCamera();
  }, [fetchRegistrations, cleanupCamera, initializeModels]);

  const getStepProgress = () => {
    switch (step) {
      case 'camera': return 33;
      case 'capture': return 66;
      case 'process': return 100;
      default: return 0;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <User className="h-5 w-5" />
          <span>Face Registration</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">
              Status: {registrations.length > 0 ? 'Registered' : 'Not Registered'}
            </p>
            <p className="text-xs text-gray-500">
              {registrations.length} face(s) registered
            </p>
          </div>
          <Button onClick={openModal} size="sm" disabled={modelsLoading}>
            {modelsLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Camera className="h-4 w-4 mr-2" />
            )}
            {registrations.length > 0 ? 'Update Face' : 'Register Face'}
          </Button>
        </div>

        {registrations.length > 0 && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Your face is registered. You can now use face validation for attendance.
            </AlertDescription>
          </Alert>
        )}

        {modelsLoading && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              Loading face recognition models... This may take a moment.
            </AlertDescription>
          </Alert>
        )}

        <Dialog open={isOpen} onOpenChange={closeModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Camera className="h-5 w-5" />
                <span>Face Registration</span>
              </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Ikuti langkah-langkah berikut untuk merekam ulang wajah Anda dan mengaktifkan validasi absensi berbasis wajah.
          </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Progress</span>
                  <span>{Math.round(getStepProgress())}%</span>
                </div>
                <Progress value={getStepProgress()} className="h-2" />
              </div>

              {!modelsReady ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-sm text-gray-600">Loading face recognition models...</p>
                </div>
              ) : step === 'camera' ? (
                <>
                  <div className="relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full rounded-lg bg-gray-100"
                      style={{ maxHeight: '300px' }}
                    />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>

                  {cameraReady && (
                    <div className="flex items-center space-x-2 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>Camera ready - Position your face in the center</span>
                    </div>
                  )}

                  <Button
                    onClick={capturePhoto}
                    disabled={!cameraReady || !modelsReady}
                    className="w-full"
                  >
                    Capture Face Photo
                  </Button>
                </>
              ) : step === 'capture' ? (
                <>
                  <img 
                    src={capturedImage} 
                    alt="Captured face" 
                    className="w-full rounded-lg"
                  />
                  
                  {faceQuality && (
                    <Alert variant={faceQuality.isValid ? "default" : "destructive"}>
                      {faceQuality.isValid ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <AlertDescription>
                        {faceQuality.message}
                        {faceQuality.confidence > 0 && (
                          <span className="block text-xs mt-1">
                            Confidence: {Math.round(faceQuality.confidence * 100)}%
                          </span>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="flex space-x-2">
                    <Button
                      onClick={handleRegisterFace}
                      disabled={loading || !faceQuality?.isValid}
                      className="flex-1"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Face'
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setCapturedImage('');
                        setFaceQuality(null);
                        setStep('camera');
                      }}
                      disabled={loading}
                    >
                      Retake
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-sm text-gray-600">Processing and saving your face data...</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
