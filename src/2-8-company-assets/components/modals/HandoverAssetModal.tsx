import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useShowToast } from '@/shared/hooks/useShowToast';
import { useHandoverAsset } from '@/2-8-company-assets/hooks/useAssetAssignments';
import { useEmployeesForAssign } from '@/2-8-company-assets/hooks/useEmployeesForAssign';
import { ArrowRightLeft, FileText, X } from 'lucide-react';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
/** Sentinel value for "Return to company" - Radix Select does not allow empty string for SelectItem */
const RETURN_TO_COMPANY_VALUE = '__return_to_company__';

interface Asset {
  id: string;
  name: string;
  status: string;
  assigned_to_employee_id?: string | null;
}

interface HandoverAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  onSuccess: () => void;
}

export const HandoverAssetModal = ({ isOpen, onClose, asset, onSuccess }: HandoverAssetModalProps) => {
  const { t } = useAppTranslation();
  const showToast = useShowToast();
  const handoverMutation = useHandoverAsset();
  const { data: employees = [], isLoading: employeesLoading } = useEmployeesForAssign();
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [handoverType, setHandoverType] = useState<'transfer' | 'resignation'>('transfer');
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
    const noRecipient = !newEmployeeId || newEmployeeId === RETURN_TO_COMPANY_VALUE;
    const isResignationReturn = handoverType === 'resignation' && noRecipient;
    if (!isResignationReturn && noRecipient) {
      showToast({ title: t('common.error', 'Error'), description: t('companyAssets.selectEmployee', 'Select employee'), variant: 'destructive' });
      return;
    }
    if (!file) {
      showToast({ title: t('common.error', 'Error'), description: t('companyAssets.assignDocumentRequired', 'Handover document required'), variant: 'destructive' });
      return;
    }
    try {
      await handoverMutation.mutateAsync({
        assetId: asset.id,
        newEmployeeId: noRecipient ? null : newEmployeeId,
        handoverType,
        file,
        notes,
      });
      showToast({ title: isResignationReturn ? t('companyAssets.returnSuccess', 'Asset returned successfully.') : t('companyAssets.handoverSuccess', 'Handover recorded successfully.'), description: '', variant: 'default' });
      setNewEmployeeId('');
      setHandoverType('transfer');
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
    setNewEmployeeId('');
    setHandoverType('transfer');
    setFile(null);
    setNotes('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const filteredEmployees = employees.filter((e) => e.id !== asset?.assigned_to_employee_id);

  if (!asset) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 shrink-0" />
            {t('companyAssets.handoverAsset', 'Handover')}
          </DialogTitle>
          <DialogDescription>
            {asset.name} — {t('companyAssets.handoverDescription', 'Select new recipient or leave empty to return to company, then upload handover document.')}
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-4 py-2">
          <div className="min-w-0 space-y-1">
            <Label>{t('companyAssets.handoverType', 'Handover type')} *</Label>
            <Select value={handoverType} onValueChange={(v: 'transfer' | 'resignation') => setHandoverType(v)}>
              <SelectTrigger className="w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transfer">{t('companyAssets.handoverTypeTransfer', 'Transfer')}</SelectItem>
                <SelectItem value="resignation">{t('companyAssets.handoverTypeResignation', 'Resignation')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1">
            <Label>
              {t('companyAssets.recipientNewEmployee', 'Recipient (new employee)')}
              {handoverType === 'transfer' ? ' *' : ` (${t('companyAssets.optionalReturnToCompany', 'optional, leave empty = return to company')})`}
            </Label>
            <Select value={newEmployeeId} onValueChange={setNewEmployeeId} disabled={employeesLoading}>
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder={employeesLoading ? t('companyAssets.loading', 'Loading...') : t('companyAssets.selectEmployee', 'Select employee')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={RETURN_TO_COMPANY_VALUE}>{t('companyAssets.returnToCompanyNoRecipient', 'Return to company (no recipient)')}</SelectItem>
                {filteredEmployees.map((emp) => (
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
            <Button
              className="shrink-0"
              onClick={handleSubmit}
              disabled={
                handoverMutation.isPending ||
                !file ||
                (handoverType === 'transfer' && (!newEmployeeId || newEmployeeId === RETURN_TO_COMPANY_VALUE))
              }
            >
              {handoverMutation.isPending ? t('companyAssets.loading', 'Loading...') : t('companyAssets.handoverButton', 'Handover')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
