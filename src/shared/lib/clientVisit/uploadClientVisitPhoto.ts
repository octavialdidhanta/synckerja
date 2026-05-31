import { supabase } from '@/shared/lib/supabaseClient';

export type ClientVisitPhotoType = 'start' | 'end';

export interface ClientVisitPhotoUploadResult {
  path: string;
  url: string;
}

function dataUrlToBlob(imageDataUrl: string): Blob {
  const base64Data = imageDataUrl.includes(',')
    ? imageDataUrl.split(',')[1]
    : imageDataUrl;
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: 'image/jpeg' });
}

/**
 * Upload client visit photo to `attendance-photos` bucket (same as attendance).
 * Path: `{employeeId}/visit_{start|end}_{isoTimestamp}.jpg`
 */
export async function uploadClientVisitPhoto(
  employeeId: string,
  imageDataUrl: string,
  type: ClientVisitPhotoType,
): Promise<ClientVisitPhotoUploadResult> {
  if (!employeeId?.trim()) {
    throw new Error('Employee ID not found');
  }
  if (!imageDataUrl?.trim()) {
    throw new Error('Photo data is empty');
  }

  const blob = dataUrlToBlob(imageDataUrl);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `visit_${type}_${timestamp}.jpg`;
  const filePath = `${employeeId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('attendance-photos')
    .upload(filePath, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Photo upload failed: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('attendance-photos').getPublicUrl(filePath);

  return { path: filePath, url: publicUrl };
}
