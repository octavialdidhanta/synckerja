import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleHelp, FileText, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import {
  formatLeadMagnetFileSize,
  LEAD_MAGNET_DELIVERY_ALLOWED_EXTENSIONS,
  LEAD_MAGNET_DELIVERY_MAX_BYTES,
  type LeadMagnetDeliveryMode,
} from '../lib/leadMagnetDeliveryAsset';
import { deleteLeadMagnetAsset, uploadLeadMagnetAsset } from '../lib/uploadLeadMagnetAsset';
import type { LeadMagnetCampaignForm } from '../types/leadMagnet.types';

const ACCEPT = Array.from(LEAD_MAGNET_DELIVERY_ALLOWED_EXTENSIONS).join(',');

type DeliveryFormSlice = Pick<
  LeadMagnetCampaignForm,
  | 'delivery_mode'
  | 'delivery_url'
  | 'delivery_storage_path'
  | 'delivery_file_name'
  | 'delivery_file_mime'
  | 'delivery_file_size_bytes'
>;

type LeadMagnetDeliveryStepProps = {
  form: DeliveryFormSlice;
  onPatch: (partial: Partial<LeadMagnetCampaignForm>) => void;
  organizationId: string | null;
  campaignId: string | null | undefined;
  ensureCampaignId: () => Promise<string | null>;
  onPersistAfterUpload?: (
    partial: Partial<LeadMagnetCampaignForm>,
    campaignId: string,
  ) => Promise<void>;
};

function InfoHint({ info }: { info: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground"
            aria-label={info}
          >
            <CircleHelp className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-snug">
          {info}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function LeadMagnetDeliveryStep({
  form,
  onPatch,
  organizationId,
  campaignId,
  ensureCampaignId,
  onPersistAfterUpload,
}: LeadMagnetDeliveryStepProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const setMode = async (mode: LeadMagnetDeliveryMode) => {
    if (mode === form.delivery_mode) return;

    if (mode === 'link') {
      if (form.delivery_storage_path) {
        void deleteLeadMagnetAsset(form.delivery_storage_path);
      }
      onPatch({
        delivery_mode: 'link',
        delivery_storage_path: null,
        delivery_file_name: null,
        delivery_file_mime: null,
        delivery_file_size_bytes: null,
      });
      return;
    }

    onPatch({
      delivery_mode: 'upload',
      delivery_url: '',
      delivery_storage_path: null,
      delivery_file_name: null,
      delivery_file_mime: null,
      delivery_file_size_bytes: null,
    });
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    if (!organizationId) {
      toast.error(t('leadMagnet.wizard.validation.orgRequired'));
      return;
    }

    setUploading(true);
    try {
      let resolvedCampaignId = campaignId ?? null;
      if (!resolvedCampaignId) {
        resolvedCampaignId = await ensureCampaignId();
        if (!resolvedCampaignId) return;
      }

      const result = await uploadLeadMagnetAsset({
        organizationId,
        campaignId: resolvedCampaignId,
        file,
        previousStoragePath: form.delivery_storage_path,
      });

      if (!result.ok) {
        const key =
          result.error === 'size'
            ? 'leadMagnet.wizard.validation.deliveryFileTooLarge'
            : result.error === 'type'
              ? 'leadMagnet.wizard.validation.deliveryFileTypeInvalid'
              : result.error === 'auth'
                ? 'leadMagnet.wizard.validation.authRequired'
                : 'leadMagnet.wizard.validation.deliveryUploadFailed';
        toast.error(t(key));
        return;
      }

      const deliveryPatch = {
        delivery_mode: 'upload' as const,
        delivery_storage_path: result.result.storagePath,
        delivery_file_name: result.result.fileName,
        delivery_file_mime: result.result.mime,
        delivery_file_size_bytes: result.result.sizeBytes,
        delivery_url: result.result.publicUrl,
      };
      onPatch(deliveryPatch);
      await onPersistAfterUpload?.(deliveryPatch, resolvedCampaignId);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = async () => {
    if (form.delivery_storage_path) {
      void deleteLeadMagnetAsset(form.delivery_storage_path);
    }
    onPatch({
      delivery_storage_path: null,
      delivery_file_name: null,
      delivery_file_mime: null,
      delivery_file_size_bytes: null,
      delivery_url: '',
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-background p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <h3 className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('leadMagnet.wizard.deliverySourceTitle')}
        </h3>
        {form.delivery_mode === 'link' ? (
          <InfoHint info={t('leadMagnet.wizard.deliveryLinkHint')} />
        ) : (
          <InfoHint info={t('leadMagnet.wizard.deliveryPublicLinkWarning')} />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <ModeButton
          active={form.delivery_mode === 'link'}
          label={t('leadMagnet.wizard.deliveryModeLink')}
          onClick={() => void setMode('link')}
        />
        <ModeButton
          active={form.delivery_mode === 'upload'}
          label={t('leadMagnet.wizard.deliveryModeUpload')}
          onClick={() => void setMode('upload')}
        />
      </div>

      {form.delivery_mode === 'link' ? (
        <div className="flex flex-col gap-1.5">
          <Label className="leading-tight">{t('leadMagnet.wizard.deliveryUrl')}</Label>
          <Input
            value={form.delivery_url}
            placeholder={t('leadMagnet.wizard.deliveryUrlPlaceholder')}
            onChange={(e) => onPatch({ delivery_url: e.target.value })}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => void handleFileSelected(e.target.files?.[0])}
          />

          {form.delivery_file_name ? (
            <div className="flex items-start gap-3 rounded-md border bg-background p-3">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{form.delivery_file_name}</p>
                {form.delivery_file_size_bytes != null ? (
                  <p className="text-xs text-muted-foreground">
                    {formatLeadMagnetFileSize(form.delivery_file_size_bytes)}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t('leadMagnet.wizard.deliveryUploadReplace')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={uploading}
                  onClick={() => void handleRemoveFile()}
                  aria-label={t('leadMagnet.wizard.deliveryUploadRemove')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/20 px-4 py-8 text-sm text-muted-foreground transition hover:bg-muted/40 disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Upload className="h-6 w-6" />
              )}
              <span>{t('leadMagnet.wizard.deliveryUploadHint')}</span>
              <span className="text-xs">
                {t('leadMagnet.wizard.deliveryFileTypesHint', {
                  maxMb: Math.round(LEAD_MAGNET_DELIVERY_MAX_BYTES / (1024 * 1024)),
                })}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
      }`}
    >
      {label}
    </button>
  );
}
