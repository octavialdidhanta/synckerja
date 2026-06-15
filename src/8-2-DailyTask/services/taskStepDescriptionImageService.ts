import { supabase } from '@/shared/lib/supabaseClient';

export const TASK_STEP_DESCRIPTION_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = 'task-files';

function extensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
  };
  return map[mime.toLowerCase()] ?? 'png';
}

function buildStoragePath(params: {
  stepId?: string | null;
  organizationId: string;
  ext: string;
}): string {
  const stamp = Date.now();
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${stamp}-${Math.random().toString(36).slice(2, 9)}`;
  const folder = params.stepId
    ? params.stepId
    : `org-${params.organizationId}/pending`;
  return `task-step-description-images/${folder}/${stamp}-${id}.${params.ext}`;
}

export async function uploadTaskStepDescriptionImage(params: {
  file: File | Blob;
  stepId?: string | null;
  organizationId: string;
  fileName?: string;
}): Promise<{ publicUrl: string; storagePath: string }> {
  const { file, stepId, organizationId, fileName } = params;
  const mime = file.type || 'image/png';
  if (!mime.startsWith('image/')) {
    throw new Error('Only image files are allowed');
  }
  if (file.size > TASK_STEP_DESCRIPTION_IMAGE_MAX_BYTES) {
    throw new Error('Image must be 5 MB or smaller');
  }

  const ext =
    fileName?.split('.').pop()?.toLowerCase() ||
    extensionFromMime(mime);
  const storagePath = buildStoragePath({ stepId, organizationId, ext });

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: mime,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  return { publicUrl, storagePath };
}
