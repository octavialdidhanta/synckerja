
import { supabase } from '@/shared/lib/supabaseClient';

export const uploadCVFile = async (file: File, applicantName?: string): Promise<string> => {
  console.log('📤 Starting CV file upload:', file.name);
  
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
  const filePath = `cvs/${fileName}`;

  console.log('📁 Upload path:', filePath);

  try {
    const { data, error } = await supabase.storage
      .from('recruitment-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('❌ CV upload error:', error);
      throw new Error(`Failed to upload CV: ${error.message}`);
    }

    console.log('✅ CV uploaded successfully:', data.path);
    return data.path;
  } catch (error) {
    console.error('💥 Critical upload error:', error);
    throw error;
  }
};

// Export with the expected name for compatibility
export const uploadCV = uploadCVFile;
