import { supabase } from '@/shared/lib/supabaseClient';

export type AttendancePhotoType = 'check_in' | 'check_out';

export interface AttendancePhotoUploadResult {
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
 * Upload attendance photo to `attendance-photos` bucket.
 * Path convention: `{employeeId}/{type}_{isoTimestamp}.jpg`
 */
export async function uploadAttendancePhoto(
  employeeId: string,
  imageDataUrl: string,
  type: AttendancePhotoType,
): Promise<AttendancePhotoUploadResult> {
  if (!employeeId?.trim()) {
    throw new Error('Employee ID not found');
  }
  if (!imageDataUrl?.trim()) {
    throw new Error('Photo data is empty');
  }

  const blob = dataUrlToBlob(imageDataUrl);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${type}_${timestamp}.jpg`;
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
