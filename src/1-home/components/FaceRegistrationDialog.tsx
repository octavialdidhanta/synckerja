import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';

interface FaceRegistrationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  capturedImage: string;
}

export const FaceRegistrationDialog = ({
  isOpen,
  onClose,
  onSuccess,
  capturedImage
}: FaceRegistrationDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wajah Tidak Terdaftar</DialogTitle>
          <DialogDescription>
            Wajah Anda belum terdaftar dalam sistem. Silakan hubungi administrator untuk mendaftarkan wajah Anda.
          </DialogDescription>
        </DialogHeader>
        
        {capturedImage && (
          <div className="mt-4">
            <img 
              src={capturedImage} 
              alt="Captured face" 
              className="w-full h-auto rounded-lg border"
            />
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <Button onClick={onClose} className="flex-1">
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

