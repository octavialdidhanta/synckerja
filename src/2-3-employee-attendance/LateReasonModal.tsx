import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import { Clock, AlertTriangle } from 'lucide-react';

interface LateReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  lateMinutes?: number;
}

export const LateReasonModal: React.FC<LateReasonModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  lateMinutes = 0,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(reason);
      setReason('');
    } catch (error) {
      console.error('Failed to save late reason:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="h-5 w-5" />
            Alasan Keterlambatan
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-gray-600">
            <Clock className="h-4 w-4" />
            Anda terlambat {lateMinutes} menit. Silakan berikan alasan keterlambatan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-medium">
              Alasan Keterlambatan <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Contoh: Terjebak macet di jalan utama, ada keperluan keluarga mendadak, kendaraan bermasalah, dll."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[100px] resize-none"
              required
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500">
              Minimum 10 karakter. Berikan alasan yang jelas dan lengkap.
            </p>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={!reason.trim() || reason.trim().length < 10 || isSubmitting}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isSubmitting ? 'Menyimpan...' : 'Kirim Alasan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
