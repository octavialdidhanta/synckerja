import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/features/ui/dialog";
import { Button } from "@/mobile/components/ui/button";
import { Textarea } from "@/mobile/components/ui/textarea";
import { AlertTriangle } from "lucide-react";
import { useIsMobile } from "@/mobile/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface LateAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  lateMinutes: number;
  scheduledTime: string;
}

export const LateAttendanceModal = ({
  isOpen,
  onClose,
  onSubmit,
  lateMinutes,
  scheduledTime,
}: LateAttendanceModalProps) => {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMobile = useIsMobile();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setReason("");
      onClose();
    }
  };

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(reason);
      setReason("");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "w-full max-w-none m-0 rounded-none translate-x-0 translate-y-0 flex flex-col p-0 gap-0 border-none bg-background shadow-xl focus:outline-none overflow-hidden",
          isMobile
            ? "fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none rounded-none modal-above-safe-area flex flex-col p-0 gap-0 overflow-hidden"
            : "sm:max-w-sm sm:rounded-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:left-[50%] sm:top-[50%] sm:max-h-[90vh] sm:p-6"
        )}
        fullscreenAnimation={isMobile}
      >
        <DialogHeader
          className={cn(
            "flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left",
            isMobile ? "safe-area-top px-4 pt-4 pb-3" : "sm:px-0 sm:pt-0 sm:pb-0 sm:border-0 sm:bg-transparent"
          )}
        >
          <div className={cn(isMobile ? "flex flex-col gap-2" : "text-center space-y-3")}>
            <div className="mx-auto w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <DialogTitle className="text-lg font-semibold text-left">
              Keterlambatan Terdeteksi
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground text-left">
              Anda terlambat {lateMinutes} menit dari jadwal {scheduledTime}. Mohon berikan alasan
              keterlambatan.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div
          className={cn(
            "space-y-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll",
            isMobile ? "px-4 pt-4 pb-4" : "pt-2"
          )}
        >
          <div className="space-y-2">
            <label htmlFor="late-reason" className="text-sm font-medium">
              Alasan Keterlambatan <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="late-reason"
              placeholder="Masukkan alasan keterlambatan..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[80px] resize-none text-sm"
              maxLength={200}
            />
            <div className="text-xs text-muted-foreground text-right">{reason.length}/200</div>
          </div>
        </div>

        <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!reason.trim() || isSubmitting}
              onClick={handleSubmit}
              className="min-w-[120px] flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                "Konfirmasi"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
