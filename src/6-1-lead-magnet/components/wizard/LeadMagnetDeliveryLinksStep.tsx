import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2, Plus } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  DEFAULT_DELIVERY_LINK_LABEL,
  LEAD_MAGNET_MAX_DELIVERY_LINKS,
  mirrorDeliveryFieldsFromLinks,
  type LeadMagnetDeliveryLink,
} from '../../lib/deliveryLinks';
import { deleteLeadMagnetAsset } from '../../lib/uploadLeadMagnetAsset';
import type { LeadMagnetCampaignForm } from '../../types/leadMagnet.types';
import {
  LeadMagnetAddLinkDialog,
  type LeadMagnetAddLinkDialogResult,
} from './LeadMagnetAddLinkDialog';

type LeadMagnetDeliveryLinksStepProps = {
  form: Pick<
    LeadMagnetCampaignForm,
    | 'delivery_links'
    | 'delivery_url'
    | 'delivery_button_label'
    | 'delivery_mode'
    | 'delivery_storage_path'
    | 'delivery_file_name'
    | 'delivery_file_mime'
    | 'delivery_file_size_bytes'
  >;
  onPatch: (partial: Partial<LeadMagnetCampaignForm>) => void;
  organizationId: string | null;
  campaignId: string | null | undefined;
  ensureCampaignId: () => Promise<string | null>;
  onPersistAfterUpload?: (
    partial: Partial<LeadMagnetCampaignForm>,
    campaignId: string,
  ) => Promise<void>;
};

function linksFromForm(
  form: LeadMagnetDeliveryLinksStepProps['form'],
): LeadMagnetDeliveryLink[] {
  if (Array.isArray(form.delivery_links) && form.delivery_links.length > 0) {
    return form.delivery_links;
  }
  const url = form.delivery_url?.trim() ?? '';
  const label = form.delivery_button_label?.trim() || DEFAULT_DELIVERY_LINK_LABEL;
  if (!url && !form.delivery_button_label) return [];
  if (!url) return [];
  return [{ label, url }];
}

export function LeadMagnetDeliveryLinksStep({
  form,
  onPatch,
  organizationId,
  campaignId,
  ensureCampaignId,
  onPersistAfterUpload,
}: LeadMagnetDeliveryLinksStepProps) {
  const { t } = useTranslation();
  const links = linksFromForm(form);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const applyLinks = async (
    nextLinks: LeadMagnetDeliveryLink[],
    extra?: Partial<LeadMagnetCampaignForm>,
  ) => {
    const mirrored = mirrorDeliveryFieldsFromLinks(nextLinks);
    const partial: Partial<LeadMagnetCampaignForm> = {
      delivery_links: nextLinks,
      delivery_url: mirrored.delivery_url,
      delivery_button_label: mirrored.delivery_button_label,
      ...extra,
    };
    onPatch(partial);

    if (extra?.delivery_mode === 'upload' && onPersistAfterUpload) {
      const id = campaignId ?? (await ensureCampaignId());
      if (id) await onPersistAfterUpload(partial, id);
    }
  };

  const openAdd = () => {
    if (links.length >= LEAD_MAGNET_MAX_DELIVERY_LINKS) return;
    setEditIndex(null);
    setDialogOpen(true);
  };

  const openEdit = (index: number) => {
    setEditIndex(index);
    setDialogOpen(true);
  };

  const handleDialogSave = async (result: LeadMagnetAddLinkDialogResult) => {
    if (result.deleted && editIndex != null) {
      const next = links.filter((_, i) => i !== editIndex);
      const clearingUpload = editIndex === 0 && form.delivery_mode === 'upload';
      if (clearingUpload && form.delivery_storage_path) {
        void deleteLeadMagnetAsset(form.delivery_storage_path);
      }
      await applyLinks(next, clearingUpload
        ? {
          delivery_mode: 'link',
          delivery_storage_path: null,
          delivery_file_name: null,
          delivery_file_mime: null,
          delivery_file_size_bytes: null,
        }
        : undefined);
      return;
    }

    const link = result.link;
    let next: LeadMagnetDeliveryLink[];
    if (editIndex == null) {
      next = [...links, link].slice(0, LEAD_MAGNET_MAX_DELIVERY_LINKS);
    } else {
      next = links.map((row, i) => (i === editIndex ? link : row));
    }

    const slotIndex = editIndex ?? next.length - 1;
    const uploadExtra =
      result.upload && slotIndex === 0
        ? {
          delivery_mode: 'upload' as const,
          delivery_storage_path: result.upload.delivery_storage_path,
          delivery_file_name: result.upload.delivery_file_name,
          delivery_file_mime: result.upload.delivery_file_mime,
          delivery_file_size_bytes: result.upload.delivery_file_size_bytes,
        }
        : slotIndex === 0 && form.delivery_mode === 'upload' && !result.upload
        ? {
          // Manual HTTPS replaced uploaded file URL
          delivery_mode: 'link' as const,
          delivery_storage_path: null as string | null,
          delivery_file_name: null as string | null,
          delivery_file_mime: null as string | null,
          delivery_file_size_bytes: null as number | null,
        }
        : undefined;

    if (
      uploadExtra?.delivery_mode === 'link'
      && form.delivery_storage_path
      && form.delivery_url
      && link.url !== form.delivery_url
    ) {
      void deleteLeadMagnetAsset(form.delivery_storage_path);
    }

    await applyLinks(next, uploadExtra);
  };

  const editingInitial =
    editIndex != null ? links[editIndex] ?? null : { label: DEFAULT_DELIVERY_LINK_LABEL, url: '' };
  const allowUpload =
    editIndex === 0 || (editIndex == null && links.length === 0);

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-background p-4 shadow-sm">
      <div>
        <p className="text-sm font-medium">{t('leadMagnet.wizard.dmWithLink')}</p>
        <p className="text-xs text-muted-foreground">{t('leadMagnet.wizard.dmWithLinkHint')}</p>
      </div>

      <ul className="space-y-2">
        {links.map((link, index) => (
          <li key={`${link.label}-${index}`}>
            <button
              type="button"
              onClick={() => openEdit(index)}
              className="flex w-full items-center gap-3 rounded-md border border-border/70 bg-muted/20 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
            >
              <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {link.label || DEFAULT_DELIVERY_LINK_LABEL}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {link.url || t('leadMagnet.wizard.linkEmpty')}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {links.length < LEAD_MAGNET_MAX_DELIVERY_LINKS ? (
        <Button type="button" variant="outline" size="sm" onClick={openAdd}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('leadMagnet.wizard.addALink')}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t('leadMagnet.wizard.maxLinks', { max: LEAD_MAGNET_MAX_DELIVERY_LINKS })}
        </p>
      )}

      <LeadMagnetAddLinkDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editIndex={editIndex}
        initial={editingInitial}
        allowUpload={allowUpload}
        organizationId={organizationId}
        campaignId={campaignId}
        ensureCampaignId={ensureCampaignId}
        existingStoragePath={
          allowUpload && form.delivery_mode === 'upload' ? form.delivery_storage_path : null
        }
        onSave={handleDialogSave}
      />
    </div>
  );
}
