import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useShowToast } from '@/shared/hooks/useShowToast';
import { useAssignAsset } from '@/2-8-company-assets/hooks/useAssetAssignments';
import { useEmployeesForAssign } from '@/2-8-company-assets/hooks/useEmployeesForAssign';
import { UserPlus, FileText, X } from 'lucide-react';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

interface Asset {
  id: string;
  name: string;
  status: string;
}

interface AssignAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  onSuccess: () => void;
}

export const AssignAssetModal = ({ isOpen, onClose, asset, onSuccess }: AssignAssetModalProps) => {
  const { t } = useAppTranslation();
  const showToast = useShowToast();
  const assignMutation = useAssignAsset();
  const { data: employees = [], isLoading: employeesLoading } = useEmployeesForAssign();
  const [employeeId, setEmployeeId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      showToast({ title: t('common.error', 'Error'), description: t('companyAssets.fileMax10MB', 'File size max 10MB'), variant: 'destructive' });
      return;
    }
    if (!ALLOWED_TYPES.includes(f.type)) {
      showToast({ title: t('common.error', 'Error'), description: t('companyAssets.fileTypesPdfJpgPng', 'PDF, JPG, PNG only'), variant: 'destructive' });
      return;
    }
    setFile(f);
  };

  const handleSubmit = async () => {
    if (!asset?.id) return;
    if (!employeeId) {
      showToast({ title: t('common.error', 'Error'), description: t('companyAssets.selectEmployee', 'Select employee'), variant: 'destructive' });
      return;
    }
    if (!file) {
      showToast({ title: t('common.error', 'Error'), description: t('companyAssets.assignDocumentRequired', 'Handover document required'), variant: 'destructive' });
      return;
    }
    try {
      await assignMutation.mutateAsync({ assetId: asset.id, employeeId, file, notes });
      showToast({ title: t('companyAssets.assignmentSuccess', 'Asset assigned successfully.'), description: '', variant: 'default' });
      setEmployeeId('');
      setFile(null);
      setNotes('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast({ title: t('common.error', 'Error'), description: err?.message ?? t('common.failed', 'Failed'), variant: 'destructive' });
    }
  };

  const handleClose = () => {
    setEmployeeId('');
    setFile(null);
    setNotes('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  }

  if (!asset) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 shrink-0" />
            {t('companyAssets.assignAsset', 'Assign / Handover')}
          </DialogTitle>
          <DialogDescription>
            {asset.name} — {t('companyAssets.assignDocumentRequired', 'Handover document required (PDF/JPG/PNG, max 10MB)')}
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-4 py-2">
          <div className="min-w-0 space-y-1">
            <Label>{t('companyAssets.selectEmployee', 'Select employee')} *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId} disabled={employeesLoading}>
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder={employeesLoading ? t('companyAssets.loading', 'Loading...') : t('companyAssets.selectEmployee', 'Select employee')} />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name} {emp.department_name ? `(${emp.department_name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1">
            <Label>{t('companyAssets.handoverDocumentLabel', 'Handover document')} *</Label>
            <div className="mt-1 flex min-w-0 items-center gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="min-w-0 w-full overflow-hidden"
              />
              {file && (
                <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {file && (
              <p className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">{file.name}</span>
              </p>
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <Label>{t('companyAssets.notesOptional', 'Notes (optional)')}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 min-h-0 w-full min-w-0 resize-y" />
          </div>
          <div className="flex shrink-0 justify-end gap-2 pt-2">
            <Button variant="outline" className="shrink-0" onClick={handleClose}>{t('common.cancel', 'Cancel')}</Button>
            <Button className="shrink-0" onClick={handleSubmit} disabled={assignMutation.isPending || !employeeId || !file}>
              {assignMutation.isPending ? t('companyAssets.loading', 'Loading...') : t('companyAssets.assignButton', 'Assign')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
