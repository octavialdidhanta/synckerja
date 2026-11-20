import { supabase } from '@/shared/lib/supabaseClient';

/**
 * Upload a candidate CV from the public application form.
 * Path must be `apply/<recruitment link token>/<file>`: anon may only upload there while the link
 * is active (storage policy `recruitment_files_insert_public`). Only the hiring org can read it.
 */
export const uploadCVFile = async (file: File, recruitmentLinkToken?: string): Promise<string> => {
  const linkToken = (recruitmentLinkToken ?? '').trim();
  if (!linkToken) {
    throw new Error('Missing recruitment token. Please access this job through a valid recruitment link.');
  }

  const fileExt = (file.name.split('.').pop() || '').toLowerCase();
  if (!['pdf', 'doc', 'docx'].includes(fileExt)) {
    throw new Error('CV must be a PDF, DOC, or DOCX file.');
  }

  const randomPart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const filePath = `apply/${linkToken}/${randomPart}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('recruitment-files')
    .upload(filePath, file, {
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) {
    console.error('❌ CV upload error:', error);
    throw new Error(`Failed to upload CV: ${error.message}`);
  }

  return data.path;
};

// Export with the expected name for compatibility
export const uploadCV = uploadCVFile;
