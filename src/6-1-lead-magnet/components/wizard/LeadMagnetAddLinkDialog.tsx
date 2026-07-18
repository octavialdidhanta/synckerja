import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  DEFAULT_DELIVERY_LINK_LABEL,
  LEAD_MAGNET_MAX_BUTTON_LABEL_CHARS,
  isValidHttpsDeliveryUrl,
  truncateDeliveryButtonLabel,
  type LeadMagnetDeliveryLink,
} from '../../lib/deliveryLinks';
import {
  LEAD_MAGNET_DELIVERY_ALLOWED_EXTENSIONS,
  formatLeadMagnetFileSize,
  LEAD_MAGNET_DELIVERY_MAX_BYTES,
} from '../../lib/leadMagnetDeliveryAsset';
import { deleteLeadMagnetAsset, uploadLeadMagnetAsset } from '../../lib/uploadLeadMagnetAsset';

const ACCEPT = Array.from(LEAD_MAGNET_DELIVERY_ALLOWED_EXTENSIONS).join(',');

export type LeadMagnetAddLinkDialogResult = {
  link: LeadMagnetDeliveryLink;
  /** Present when user filled link #1 via upload */
  upload?: {
    delivery_mode: 'upload';
    delivery_storage_path: string;
    delivery_file_name: string;
    delivery_file_mime: string;
    delivery_file_size_bytes: number;
  } | null;
  deleted?: boolean;
};

type LeadMagnetAddLinkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = add new; number = edit existing index */
  editIndex: number | null;
  initial: LeadMagnetDeliveryLink | null;
  /** Upload only allowed when editing/adding as slot 0 */
  allowUpload: boolean;
  organizationId: string | null;
  campaignId: string | null | undefined;
  ensureCampaignId: () => Promise<string | null>;
  existingStoragePath?: string | null;
  onSave: (result: LeadMagnetAddLinkDialogResult) => void | Promise<void>;
};

export function LeadMagnetAddLinkDialog({
  open,
  onOpenChange,
  editIndex,
  initial,
  allowUpload,
  organizationId,
  campaignId,
  ensureCampaignId,
  existingStoragePath,
  onSave,
}: LeadMagnetAddLinkDialogProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState(DEFAULT_DELIVERY_LINK_LABEL);
  const [url, setUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMeta, setUploadMeta] = useState<LeadMagnetAddLinkDialogResult['upload']>(null);
  const [localStoragePath, setLocalStoragePath] = useState<string | null>(null);

  const isEdit = editIndex != null;

  useEffect(() => {
    if (!open) return;
    setLabel(initial?.label?.trim() || DEFAULT_DELIVERY_LINK_LABEL);
    setUrl(initial?.url?.trim() ?? '');
    setUploadMeta(null);
    setLocalStoragePath(existingStoragePath ?? null);
  }, [open, initial, existingStoragePath]);

  const canSave =
    truncateDeliveryButtonLabel(label).length > 0 && isValidHttpsDeliveryUrl(url) && !uploading;

  const handleUpload = async (file: File | undefined) => {
    if (!file || !allowUpload) return;
    if (!organizationId) {
      toast.error(t('leadMagnet.wizard.validation.orgRequired'));
      return;
    }
    setUploading(true);
    try {
      const id = campaignId ?? (await ensureCampaignId());
      if (!id) {
        toast.error(t('leadMagnet.wizard.saveFailed'));
        return;
      }
      const result = await uploadLeadMagnetAsset({
        organizationId,
        campaignId: id,
        file,
        previousStoragePath: localStoragePath,
      });
      if (!result.ok) {
        const key =
          result.error === 'size'
            ? 'deliveryFileTooLarge'
            : result.error === 'type'
            ? 'deliveryFileTypeInvalid'
            : result.error === 'auth'
            ? 'authRequired'
            : 'deliveryUploadFailed';
        toast.error(t(`leadMagnet.wizard.validation.${key}`));
        return;
      }
      setUrl(result.result.publicUrl);
      setLocalStoragePath(result.result.storagePath);
      setUploadMeta({
        delivery_mode: 'upload',
        delivery_storage_path: result.result.storagePath,
        delivery_file_name: result.result.fileName,
        delivery_file_mime: result.result.mime,
        delivery_file_size_bytes: result.result.sizeBytes,
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    await onSave({
      link: {
        label: truncateDeliveryButtonLabel(label),
        url: url.trim(),
      },
      upload: allowUpload ? uploadMeta : null,
      deleted: false,
    });
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (localStoragePath && allowUpload) {
      void deleteLeadMagnetAsset(localStoragePath);
    }
    await onSave({
      link: { label: '', url: '' },
      upload: null,
      deleted: true,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('leadMagnet.wizard.editALinkTitle')
              : t('leadMagnet.wizard.addALinkTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('leadMagnet.wizard.addALinkHint', {
              max: LEAD_MAGNET_MAX_BUTTON_LABEL_CHARS,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="lm-link-label">{t('leadMagnet.wizard.buttonLabel')}</Label>
            <Input
              id="lm-link-label"
              value={label}
              maxLength={LEAD_MAGNET_MAX_BUTTON_LABEL_CHARS}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={DEFAULT_DELIVERY_LINK_LABEL}
            />
            <p className="text-xs text-muted-foreground">
              {label.trim().length}/{LEAD_MAGNET_MAX_BUTTON_LABEL_CHARS}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lm-link-url">{t('leadMagnet.wizard.link')}</Label>
            <Input
              id="lm-link-url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (uploadMeta) setUploadMeta(null);
              }}
              placeholder="https://"
              inputMode="url"
            />
            <p className="text-xs text-muted-foreground">
              {t('leadMagnet.wizard.deliveryLinkHint')}
            </p>
          </div>

          {allowUpload ? (
            <div className="space-y-2 rounded-md border border-dashed border-border/80 bg-muted/30 p-3">
              <p className="text-xs font-medium text-foreground">
                {t('leadMagnet.wizard.fillFromUpload')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('leadMagnet.wizard.deliveryUploadHint')} ·{' '}
                {formatLeadMagnetFileSize(LEAD_MAGNET_DELIVERY_MAX_BYTES)}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => void handleUpload(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                )}
                {t('leadMagnet.wizard.deliveryModeUpload')}
              </Button>
              {uploadMeta?.delivery_file_name ? (
                <p className="truncate text-xs text-muted-foreground">
                  {uploadMeta.delivery_file_name}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {isEdit ? (
            <Button type="button" variant="destructive" onClick={() => void handleDelete()}>
              {t('leadMagnet.wizard.deleteLink')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" disabled={!canSave} onClick={() => void handleSave()}>
              {t('common.save')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
