import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Label } from '@/shared/components/ui/label';
import { AlertCircle } from 'lucide-react';

interface TrainingRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programName: string;
  onRegister: (reason: string, checklist: ConsentChecklist) => void;
  isLoading?: boolean;
}

interface ConsentChecklist {
  penalty_agreement: boolean;
  attendance_commitment: boolean;
  participation_commitment: boolean;
  confidentiality_agreement: boolean;
  evaluation_agreement: boolean;
}

const checklistItems = [
  {
    key: 'penalty_agreement' as keyof ConsentChecklist,
    label: 'Saya bersedia dikenakan sanksi/penalty jika mendadak tidak hadir pada hari pelaksanaan pelatihan tanpa alasan yang jelas',
  },
  {
    key: 'attendance_commitment' as keyof ConsentChecklist,
    label: 'Saya berkomitmen untuk menghadiri seluruh sesi pelatihan dari awal hingga akhir',
  },
  {
    key: 'participation_commitment' as keyof ConsentChecklist,
    label: 'Saya berkomitmen untuk berpartisipasi aktif dalam semua kegiatan pelatihan yang diberikan',
  },
  {
    key: 'confidentiality_agreement' as keyof ConsentChecklist,
    label: 'Saya akan menjaga kerahasiaan informasi yang diperoleh selama pelatihan dan tidak menyebarluaskannya',
  },
  {
    key: 'evaluation_agreement' as keyof ConsentChecklist,
    label: 'Saya bersedia mengikuti evaluasi dan memberikan feedback yang konstruktif setelah pelatihan selesai',
  },
];

export const TrainingRegistrationModal = ({
  open,
  onOpenChange,
  programName,
  onRegister,
  isLoading = false,
}: TrainingRegistrationModalProps) => {
  const [reason, setReason] = useState('');
  const [checklist, setChecklist] = useState<ConsentChecklist>({
    penalty_agreement: false,
    attendance_commitment: false,
    participation_commitment: false,
    confidentiality_agreement: false,
    evaluation_agreement: false,
  });

  const handleChecklistChange = (key: keyof ConsentChecklist, checked: boolean) => {
    setChecklist(prev => ({
      ...prev,
      [key]: checked,
    }));
  };

  const isFormValid = () => {
    return reason.trim().length >= 10 && Object.values(checklist).every(Boolean);
  };

  const handleSubmit = () => {
    if (!isFormValid()) return;
    console.log('Submitting registration:', { reason: reason.trim(), checklist });
    onRegister(reason.trim(), checklist);
    handleClose();
  };

  const handleClose = () => {
    setReason('');
    setChecklist({
      penalty_agreement: false,
      attendance_commitment: false,
      participation_commitment: false,
      confidentiality_agreement: false,
      evaluation_agreement: false,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Pendaftaran Program Pelatihan
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Sampaikan alasan mengikuti pelatihan dan lengkapi persetujuan agar pendaftaran Anda dapat diproses.
          </DialogDescription>
          <p className="text-sm text-gray-600 mt-1">
            {programName}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Registration Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-medium">
              Alasan Mengikuti Pelatihan <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Jelaskan alasan Anda ingin mengikuti pelatihan ini..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">
              Minimal 10 karakter ({reason.length}/10)
            </p>
          </div>

          {/* Consent Checklist */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <Label className="text-sm font-medium">
                Persetujuan dan Komitmen <span className="text-red-500">*</span>
              </Label>
            </div>
            
            <div className="space-y-3 pl-6">
              {checklistItems.map((item) => (
                <div key={item.key} className="flex items-start space-x-3">
                  <Checkbox
                    id={item.key}
                    checked={checklist[item.key]}
                    onCheckedChange={(checked) => 
                      handleChecklistChange(item.key, checked as boolean)
                    }
                    className="mt-0.5"
                  />
                  <Label 
                    htmlFor={item.key} 
                    className="text-sm leading-5 cursor-pointer"
                  >
                    {item.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {!isFormValid() && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <p className="text-sm text-yellow-800">
                  {reason.trim().length < 10 
                    ? 'Harap lengkapi alasan pendaftaran (minimal 10 karakter) dan centang semua persetujuan untuk melanjutkan.'
                    : 'Harap centang semua persetujuan untuk melanjutkan.'}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Batal
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!isFormValid() || isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? 'Mendaftar...' : 'Daftar Program'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

