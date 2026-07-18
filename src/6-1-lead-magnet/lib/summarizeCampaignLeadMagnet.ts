import { resolveDeliveryLinks, type LeadMagnetDeliveryLink } from './deliveryLinks';
import {
  buildLeadMagnetAssetPublicUrl,
  formatLeadMagnetFileSize,
  parseLeadMagnetDeliveryMode,
} from './leadMagnetDeliveryAsset';
import type { LeadMagnetCampaign, LeadMagnetDeliveryMode } from '../types/leadMagnet.types';

export type CampaignLeadMagnetSummary = {
  mode: LeadMagnetDeliveryMode;
  /** Short label for table cell */
  label: string;
  hasContent: boolean;
  links: LeadMagnetDeliveryLink[];
  fileName: string | null;
  fileMime: string | null;
  fileSizeLabel: string | null;
  fileStoragePath: string | null;
  filePublicUrl: string | null;
  deliveryText: string;
};

export function isLikelyPdf(args: {
  url?: string | null;
  fileName?: string | null;
  mime?: string | null;
}): boolean {
  const mime = (args.mime ?? '').toLowerCase();
  if (mime === 'application/pdf' || mime.includes('pdf')) return true;
  const name = (args.fileName ?? '').toLowerCase();
  if (name.endsWith('.pdf')) return true;
  const url = (args.url ?? '').toLowerCase().split('?')[0] ?? '';
  return url.endsWith('.pdf');
}

function hostnameOrUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 40);
  }
}

export function summarizeCampaignLeadMagnet(
  campaign: Pick<
    LeadMagnetCampaign,
    | 'delivery_mode'
    | 'delivery_links'
    | 'delivery_button_label'
    | 'delivery_url'
    | 'delivery_storage_path'
    | 'delivery_file_name'
    | 'delivery_file_mime'
    | 'delivery_file_size_bytes'
    | 'delivery_text'
  >,
  supabaseUrl: string,
): CampaignLeadMagnetSummary {
  const mode = parseLeadMagnetDeliveryMode(campaign.delivery_mode);
  const links = resolveDeliveryLinks({
    delivery_links: campaign.delivery_links,
    delivery_button_label: campaign.delivery_button_label,
    delivery_url: campaign.delivery_url,
  });
  const fileName = campaign.delivery_file_name?.trim() || null;
  const fileMime = campaign.delivery_file_mime?.trim() || null;
  const fileStoragePath = campaign.delivery_storage_path?.trim() || null;
  const filePublicUrl =
    mode === 'upload' && fileStoragePath
      ? buildLeadMagnetAssetPublicUrl(supabaseUrl, fileStoragePath)
      : null;
  const fileSizeLabel =
    mode === 'upload' && campaign.delivery_file_size_bytes != null
      ? formatLeadMagnetFileSize(campaign.delivery_file_size_bytes)
      : null;

  let label = '';
  if (links.length === 1) {
    const first = links[0]!;
    label = first.label.trim() || hostnameOrUrl(first.url);
  } else if (links.length > 1) {
    const first = links[0]!;
    const base = first.label.trim() || hostnameOrUrl(first.url);
    label = `${base} +${links.length - 1}`;
  } else if (mode === 'upload' && fileName) {
    // Fallback when upload has no delivery button label yet.
    label = fileName;
  } else {
    const legacyLabel = String(campaign.delivery_button_label ?? '').trim();
    if (legacyLabel) label = legacyLabel;
  }

  return {
    mode,
    label: label || '',
    hasContent: Boolean(label) || links.some((l) => l.url) || Boolean(fileName),
    links,
    fileName,
    fileMime,
    fileSizeLabel,
    fileStoragePath,
    filePublicUrl,
    deliveryText: campaign.delivery_text?.trim() ?? '',
  };
}
