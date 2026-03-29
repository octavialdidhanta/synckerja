import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Camera, User } from 'lucide-react';

interface FaceRegistrationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister?: (imageData: string) => void;
}

export const FaceRegistrationDialog: React.FC<FaceRegistrationDialogProps> = ({
  isOpen,
  onClose,
  onRegister
}) => {
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCapture = () => {
    setIsCapturing(true);
    // Simulate face capture
    setTimeout(() => {
      setIsCapturing(false);
      onRegister?.('captured-image-data');
      onClose();
    }, 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Face Registration
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Capture the employee&apos;s face image to enable attendance validation.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            <Camera className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-sm text-gray-600">
              {isCapturing ? 'Capturing face...' : 'Position your face in the camera'}
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleCapture} 
              disabled={isCapturing}
              className="flex-1"
            >
              {isCapturing ? 'Capturing...' : 'Capture Face'}
            </Button>
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={isCapturing}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
