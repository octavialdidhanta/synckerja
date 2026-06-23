import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useShowToast } from '@/shared/hooks/useShowToast';
import { useReturnAsset, useAssetAssignments } from '@/2-8-company-assets/hooks/useAssetAssignments';
import { Package, FileText, X } from 'lucide-react';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

interface Asset {
  id: string;
  name: string;
  status: string;
}

interface ReturnAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  onSuccess: () => void;
}

export const ReturnAssetModal = ({ isOpen, onClose, asset, onSuccess }: ReturnAssetModalProps) => {
  const { t } = useAppTranslation();
  const showToast = useShowToast();
  const returnMutation = useReturnAsset();
  const { assignments } = useAssetAssignments(asset?.id ?? null);
  const documentOptional = assignments.length === 1;
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
    if (!documentOptional && !file) {
      showToast({ title: t('common.error', 'Error'), description: t('companyAssets.returnDocumentRequired', 'Return document required'), variant: 'destructive' });
      return;
    }
    try {
      await returnMutation.mutateAsync({
        assetId: asset.id,
        file: file ?? undefined,
        notes,
        documentOptional,
      });
      showToast({ title: t('companyAssets.returnSuccess', 'Asset returned successfully.'), description: '', variant: 'default' });
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
    setFile(null);
    setNotes('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  if (!asset) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('companyAssets.returnAsset', 'Return')}
          </DialogTitle>
          <DialogDescription>
            {asset.name} — {documentOptional ? t('companyAssets.returnDocumentOptionalHint', 'Return document optional if asset has only been assigned once.') : t('companyAssets.returnDocumentRequired', 'Return document required')}
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-4 py-2">
          <div className="min-w-0 space-y-1">
            <Label>
              {t('companyAssets.returnDocumentLabel', 'Return document')}
              {documentOptional ? ` (${t('companyAssets.optional', 'optional')})` : ' *'}
            </Label>
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
            {documentOptional && <p className="mt-1 text-xs text-muted-foreground">{t('companyAssets.returnDocumentOptionalSingleAssignment', 'This asset has only one assignment; return document is optional.')}</p>}
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
              disabled={returnMutation.isPending || (!documentOptional && !file)}
            >
              {returnMutation.isPending ? t('companyAssets.loading', 'Loading...') : t('companyAssets.returnButton', 'Return')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
