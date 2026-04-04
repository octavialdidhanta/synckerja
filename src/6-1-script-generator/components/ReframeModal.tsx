import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Loader2 } from 'lucide-react';

interface ReframeModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (instruction: string) => Promise<void>;
  isRegenerating?: boolean;
}

export const ReframeModal: React.FC<ReframeModalProps> = ({
  open,
  onClose,
  onConfirm,
  isRegenerating = false,
}) => {
  const { t } = useAppTranslation();
  const [instruction, setInstruction] = useState('');

  useEffect(() => {
    if (open) {
      setInstruction('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = instruction.trim();
    if (!trimmed) return;
    try {
      await onConfirm(trimmed);
      onClose();
    } catch {
      // Parent handles error (toast); modal stays open for retry
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg" style={{ zIndex: 999999 }}>
        <DialogHeader>
          <DialogTitle>
            {t('scriptGenerator.reframe.modalTitle', 'Regenerate dari sudut pandang masalah berbeda')}
          </DialogTitle>
          <DialogDescription>
            {t('scriptGenerator.reframe.modalDescription', 'Ketik instruksi untuk mengganti framing masalah. AI akan meregenerasi seluruh script.')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('scriptGenerator.reframe.instructionLabel', 'Instruksi')}
            </label>
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={t('scriptGenerator.reframe.instructionPlaceholder', 'Contoh: ganti masalah jadi EO kesulitan dapat sponsor, lihat dari sudut pandang peserta event yang bingung')}
              className="min-h-[100px]"
              disabled={isRegenerating}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isRegenerating}>
              {t('common.cancel', 'Batal')}
            </Button>
            <Button type="submit" disabled={isRegenerating || !instruction.trim()}>
              {isRegenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('scriptGenerator.reframe.regenerating', 'Meregenerasi...')}
                </>
              ) : (
                t('scriptGenerator.reframe.submitButton', 'Regenerate')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
