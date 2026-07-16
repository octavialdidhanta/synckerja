import { supabase, SUPABASE_URL } from '@/shared/lib/supabaseClient';
import {
  buildLeadMagnetAssetPublicUrl,
  LEAD_MAGNET_ASSETS_BUCKET,
  sanitizeLeadMagnetAssetFileName,
  validateLeadMagnetDeliveryFile,
  type LeadMagnetDeliveryFileValidationError,
} from './leadMagnetDeliveryAsset';

export type UploadLeadMagnetAssetResult = {
  storagePath: string;
  publicUrl: string;
  fileName: string;
  mime: string;
  sizeBytes: number;
};

export type UploadLeadMagnetAssetError = LeadMagnetDeliveryFileValidationError | 'upload' | 'auth';

export async function deleteLeadMagnetAsset(storagePath: string): Promise<void> {
  if (!storagePath.trim()) return;
  await supabase.storage.from(LEAD_MAGNET_ASSETS_BUCKET).remove([storagePath]);
}

export async function uploadLeadMagnetAsset(params: {
  organizationId: string;
  campaignId: string;
  file: File;
  previousStoragePath?: string | null;
}): Promise<{ ok: true; result: UploadLeadMagnetAssetResult } | { ok: false; error: UploadLeadMagnetAssetError }> {
  const validationError = validateLeadMagnetDeliveryFile(params.file);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: 'auth' };
  }

  const assetId = crypto.randomUUID();
  const safeName = sanitizeLeadMagnetAssetFileName(params.file.name);
  const storagePath = `${params.organizationId}/${params.campaignId}/${assetId}_${safeName}`;

  const contentType = params.file.type || 'application/octet-stream';
  const { error: uploadError } = await supabase.storage
    .from(LEAD_MAGNET_ASSETS_BUCKET)
    .upload(storagePath, params.file, {
      cacheControl: '3600',
      upsert: false,
      contentType,
    });

  if (uploadError) {
    return { ok: false, error: 'upload' };
  }

  if (params.previousStoragePath && params.previousStoragePath !== storagePath) {
    void deleteLeadMagnetAsset(params.previousStoragePath);
  }

  const publicUrl = buildLeadMagnetAssetPublicUrl(SUPABASE_URL, storagePath);

  return {
    ok: true,
    result: {
      storagePath,
      publicUrl,
      fileName: params.file.name,
      mime: contentType,
      sizeBytes: params.file.size,
    },
  };
}
