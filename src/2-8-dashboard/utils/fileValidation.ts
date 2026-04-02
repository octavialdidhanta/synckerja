
import { z } from 'zod';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE, FILE_CATEGORIES, FILE_VISIBILITY } from './fileTypes';

export const fileUploadSchema = z.object({
  file_name: z.string().min(1, 'Nama file wajib diisi').max(255, 'Nama file terlalu panjang'),
  file_category: z.enum(Object.keys(FILE_CATEGORIES) as [keyof typeof FILE_CATEGORIES, ...Array<keyof typeof FILE_CATEGORIES>]),
  visibility: z.enum(Object.keys(FILE_VISIBILITY) as [keyof typeof FILE_VISIBILITY, ...Array<keyof typeof FILE_VISIBILITY>]),
  description: z.string().max(200, 'Deskripsi maksimal 200 karakter').optional(),
  expires_at: z.string().optional()
});

export type FileUploadData = z.infer<typeof fileUploadSchema>;

export const validateFile = (file: File): { isValid: boolean; error?: string } => {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `Ukuran file melebihi batas maksimal (50MB). File Anda: ${(file.size / 1024 / 1024).toFixed(2)}MB`
    };
  }

  // Check file type
  if (!Object.keys(ALLOWED_FILE_TYPES).includes(file.type)) {
    return {
      isValid: false,
      error: `Tipe file tidak didukung. Format yang diizinkan: ${Object.values(ALLOWED_FILE_TYPES).join(', ')}`
    };
  }

  return { isValid: true };
};

export const generateUniqueFileName = (originalName: string): string => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop();
  const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.'));
  
  return `${nameWithoutExt}_${timestamp}_${randomString}.${extension}`;
};
