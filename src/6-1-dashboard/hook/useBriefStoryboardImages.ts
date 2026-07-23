import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { devLog } from '@/shared/lib/logger';

export const BRIEF_STORYBOARD_IMAGES_BUCKET = 'brief-visual-images';
export const BRIEF_STORYBOARD_IMAGES_QUERY_KEY = 'brief-storyboard-images';
export const BRIEF_STORYBOARD_IMAGE_COLUMN_INDEX = 1;
export const BRIEF_STORYBOARD_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const BRIEF_STORYBOARD_IMAGE_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export interface BriefStoryboardImageRow {
  id: string;
  social_media_plan_id: string;
  row_index: number;
  column_index: number;
  sort_order: number;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
  updated_at: string;
}

export interface BriefStoryboardImageWithUrl extends BriefStoryboardImageRow {
  publicUrl: string;
}

function normalizeImageExtension(file: File): string {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

function getBriefStoryboardImagePublicUrl(storagePath: string): string {
  return supabase.storage.from(BRIEF_STORYBOARD_IMAGES_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

export async function removeAllBriefStoryboardImagesForPlan(socialMediaPlanId: string): Promise<void> {
  const { data: rows, error: fetchError } = await supabase
    .from('brief_storyboard_images')
    .select('storage_path')
    .eq('social_media_plan_id', socialMediaPlanId);
  if (fetchError) throw fetchError;

  const paths = (rows || []).map((row) => (row as { storage_path: string }).storage_path);
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(BRIEF_STORYBOARD_IMAGES_BUCKET)
      .remove(paths);
    if (storageError) throw storageError;
  }

  const { error: deleteError } = await supabase
    .from('brief_storyboard_images')
    .delete()
    .eq('social_media_plan_id', socialMediaPlanId);
  if (deleteError) throw deleteError;
}

function validateImageFile(file: File): void {
  if (!BRIEF_STORYBOARD_IMAGE_ACCEPTED_TYPES.includes(file.type as (typeof BRIEF_STORYBOARD_IMAGE_ACCEPTED_TYPES)[number])) {
    throw new Error('Only PNG, JPG, and WEBP images are supported');
  }
  if (file.size > BRIEF_STORYBOARD_IMAGE_MAX_SIZE_BYTES) {
    throw new Error('Image must be 5MB or smaller');
  }
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('Failed to read image dimensions'));
      img.src = objectUrl;
    });
    return dimensions;
  } catch (error) {
    devLog.debug('Failed to read storyboard image dimensions', error);
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function useBriefStoryboardImages(socialMediaPlanId: string | undefined) {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const queryKey = useMemo(
    () => [BRIEF_STORYBOARD_IMAGES_QUERY_KEY, socialMediaPlanId],
    [socialMediaPlanId],
  );

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<BriefStoryboardImageRow[]> => {
      if (!socialMediaPlanId) return [];
      const { data, error } = await supabase
        .from('brief_storyboard_images')
        .select(
          'id, social_media_plan_id, row_index, column_index, sort_order, storage_path, file_name, mime_type, file_size, width, height, created_at, updated_at',
        )
        .eq('social_media_plan_id', socialMediaPlanId)
        .eq('column_index', BRIEF_STORYBOARD_IMAGE_COLUMN_INDEX)
        .order('row_index', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as BriefStoryboardImageRow[];
    },
    enabled: Boolean(socialMediaPlanId),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ rowIndex, files }: { rowIndex: number; files: File[] }) => {
      if (!socialMediaPlanId || !organizationId) throw new Error('Plan and organization are required');
      if (files.length === 0) return [] as BriefStoryboardImageRow[];
      files.forEach(validateImageFile);

      const { data: rows, error: orderError } = await supabase
        .from('brief_storyboard_images')
        .select('sort_order')
        .eq('social_media_plan_id', socialMediaPlanId)
        .eq('row_index', rowIndex)
        .eq('column_index', BRIEF_STORYBOARD_IMAGE_COLUMN_INDEX)
        .order('sort_order', { ascending: false })
        .limit(1);
      if (orderError) throw orderError;
      let nextOrder = rows?.[0] ? (rows[0] as { sort_order: number }).sort_order + 1 : 0;

      const insertedRows: BriefStoryboardImageRow[] = [];
      for (const file of files) {
        const extension = normalizeImageExtension(file);
        const path = `${organizationId}/${socialMediaPlanId}/${rowIndex}/${crypto.randomUUID()}.${extension}`;
        const dimensions = await getImageDimensions(file);
        const { error: uploadError } = await supabase.storage
          .from(BRIEF_STORYBOARD_IMAGES_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;

        const { data: inserted, error: insertError } = await supabase
          .from('brief_storyboard_images')
          .insert({
            social_media_plan_id: socialMediaPlanId,
            row_index: rowIndex,
            column_index: BRIEF_STORYBOARD_IMAGE_COLUMN_INDEX,
            sort_order: nextOrder,
            storage_path: path,
            file_name: file.name,
            mime_type: file.type,
            file_size: file.size,
            width: dimensions?.width ?? null,
            height: dimensions?.height ?? null,
          })
          .select(
            'id, social_media_plan_id, row_index, column_index, sort_order, storage_path, file_name, mime_type, file_size, width, height, created_at, updated_at',
          )
          .single();

        if (insertError) {
          await supabase.storage.from(BRIEF_STORYBOARD_IMAGES_BUCKET).remove([path]);
          throw insertError;
        }

        insertedRows.push(inserted as BriefStoryboardImageRow);
        nextOrder += 1;
      }

      return insertedRows;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      devLog.debug('Storyboard image upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload storyboard image');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: row, error: fetchError } = await supabase
        .from('brief_storyboard_images')
        .select('id, storage_path, social_media_plan_id, row_index, column_index')
        .eq('id', id)
        .single();
      if (fetchError || !row) throw fetchError || new Error('Storyboard image not found');

      const typedRow = row as Pick<
        BriefStoryboardImageRow,
        'id' | 'storage_path' | 'social_media_plan_id' | 'row_index' | 'column_index'
      >;
      const { error: storageError } = await supabase.storage
        .from(BRIEF_STORYBOARD_IMAGES_BUCKET)
        .remove([typedRow.storage_path]);
      if (storageError) throw storageError;

      const { error: deleteError } = await supabase.from('brief_storyboard_images').delete().eq('id', id);
      if (deleteError) throw deleteError;

      const { data: remainingRows, error: remainingError } = await supabase
        .from('brief_storyboard_images')
        .select('id')
        .eq('social_media_plan_id', typedRow.social_media_plan_id)
        .eq('row_index', typedRow.row_index)
        .eq('column_index', typedRow.column_index)
        .order('sort_order', { ascending: true });
      if (remainingError) throw remainingError;

      for (let i = 0; i < (remainingRows || []).length; i += 1) {
        const remainingId = (remainingRows?.[i] as { id: string }).id;
        const { error: reorderError } = await supabase
          .from('brief_storyboard_images')
          .update({ sort_order: i })
          .eq('id', remainingId);
        if (reorderError) throw reorderError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      devLog.debug('Storyboard image delete error:', error);
      toast.error('Failed to delete storyboard image');
    },
  });

  const clearPlanMutation = useMutation({
    mutationFn: async () => {
      if (!socialMediaPlanId) throw new Error('Plan required');
      await removeAllBriefStoryboardImagesForPlan(socialMediaPlanId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      devLog.debug('Storyboard image clear error:', error);
      toast.error('Failed to clear storyboard images');
    },
  });

  const insertRowMutation = useMutation({
    mutationFn: async (insertAtRowIndex: number) => {
      if (!socialMediaPlanId) throw new Error('Plan required');
      const { data: rows, error } = await supabase
        .from('brief_storyboard_images')
        .select('id, row_index')
        .eq('social_media_plan_id', socialMediaPlanId)
        .eq('column_index', BRIEF_STORYBOARD_IMAGE_COLUMN_INDEX)
        .gte('row_index', insertAtRowIndex)
        .order('row_index', { ascending: false })
        .order('sort_order', { ascending: false });
      if (error) throw error;

      for (const row of rows || []) {
        const typedRow = row as { id: string; row_index: number };
        const { error: updateError } = await supabase
          .from('brief_storyboard_images')
          .update({ row_index: typedRow.row_index + 1 })
          .eq('id', typedRow.id);
        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      devLog.debug('Storyboard image insert-row error:', error);
      toast.error('Failed to shift storyboard image rows');
    },
  });

  const deleteRowMutation = useMutation({
    mutationFn: async (rowIndex: number) => {
      if (!socialMediaPlanId) throw new Error('Plan required');
      const { data: targetRows, error: targetError } = await supabase
        .from('brief_storyboard_images')
        .select('id, storage_path')
        .eq('social_media_plan_id', socialMediaPlanId)
        .eq('column_index', BRIEF_STORYBOARD_IMAGE_COLUMN_INDEX)
        .eq('row_index', rowIndex);
      if (targetError) throw targetError;

      const targetPaths = (targetRows || []).map((row) => (row as { storage_path: string }).storage_path);
      if (targetPaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from(BRIEF_STORYBOARD_IMAGES_BUCKET)
          .remove(targetPaths);
        if (storageError) throw storageError;
      }

      const { error: deleteError } = await supabase
        .from('brief_storyboard_images')
        .delete()
        .eq('social_media_plan_id', socialMediaPlanId)
        .eq('column_index', BRIEF_STORYBOARD_IMAGE_COLUMN_INDEX)
        .eq('row_index', rowIndex);
      if (deleteError) throw deleteError;

      const { data: rowsToShift, error: shiftError } = await supabase
        .from('brief_storyboard_images')
        .select('id, row_index')
        .eq('social_media_plan_id', socialMediaPlanId)
        .eq('column_index', BRIEF_STORYBOARD_IMAGE_COLUMN_INDEX)
        .gt('row_index', rowIndex)
        .order('row_index', { ascending: true })
        .order('sort_order', { ascending: true });
      if (shiftError) throw shiftError;

      for (const row of rowsToShift || []) {
        const typedRow = row as { id: string; row_index: number };
        const { error: updateError } = await supabase
          .from('brief_storyboard_images')
          .update({ row_index: typedRow.row_index - 1 })
          .eq('id', typedRow.id);
        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      devLog.debug('Storyboard image delete-row error:', error);
      toast.error('Failed to remove storyboard row images');
    },
  });

  const images = useMemo(() => query.data ?? [], [query.data]);
  const rowImagesMap = useMemo<Record<number, BriefStoryboardImageWithUrl[]>>(() => {
    return images.reduce<Record<number, BriefStoryboardImageWithUrl[]>>((acc, image) => {
      const entry = {
        ...image,
        publicUrl: getBriefStoryboardImagePublicUrl(image.storage_path),
      };
      if (!acc[image.row_index]) acc[image.row_index] = [];
      acc[image.row_index].push(entry);
      return acc;
    }, {});
  }, [images]);

  const uploadMany = useCallback(
    async (rowIndex: number, files: File[]) => uploadMutation.mutateAsync({ rowIndex, files }),
    [uploadMutation],
  );
  const remove = useCallback((id: string) => deleteMutation.mutateAsync(id), [deleteMutation]);
  const removeAllForPlan = useCallback(() => clearPlanMutation.mutateAsync(), [clearPlanMutation]);
  const insertRow = useCallback(
    (insertAtRowIndex: number) => insertRowMutation.mutateAsync(insertAtRowIndex),
    [insertRowMutation],
  );
  const deleteRow = useCallback((rowIndex: number) => deleteRowMutation.mutateAsync(rowIndex), [deleteRowMutation]);

  const uploadingRowIndex = uploadMutation.isPending
    ? (uploadMutation.variables?.rowIndex ?? null)
    : null;
  const deletingImageId = deleteMutation.isPending ? (deleteMutation.variables ?? null) : null;

  return {
    images,
    rowImagesMap,
    uploadMany,
    remove,
    removeAllForPlan,
    insertRow,
    deleteRow,
    refetch: query.refetch,
    isLoading: query.isLoading,
    uploadingRowIndex,
    deletingImageId,
    isUploading: uploadMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isClearing: clearPlanMutation.isPending,
    isWorking:
      uploadMutation.isPending ||
      deleteMutation.isPending ||
      clearPlanMutation.isPending ||
      insertRowMutation.isPending ||
      deleteRowMutation.isPending,
  };
}

