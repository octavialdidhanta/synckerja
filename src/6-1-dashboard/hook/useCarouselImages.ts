import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { toast } from 'sonner';
import { devLog } from '@/shared/lib/logger';

export const CAROUSEL_BUCKET = 'social-media-carousel';
export const CAROUSEL_QUERY_KEY = 'social-media-carousel';

export interface CarouselImageRow {
  id: string;
  social_media_plan_id: string;
  sort_order: number;
  storage_path: string;
  created_at: string;
}

export function getCarouselImagePublicUrl(storagePath: string): string {
  return supabase.storage.from(CAROUSEL_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

/** Download a carousel image by storage path; opens in new tab if fetch fails (CORS). */
export async function downloadCarouselImage(
  storagePath: string,
  fileName: string,
): Promise<'ok' | 'fallback'> {
  const url = getCarouselImagePublicUrl(storagePath);
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('Fetch failed');
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(blobUrl);
    return 'ok';
  } catch {
    window.open(url, '_blank');
    return 'fallback';
  }
}

export function useCarouselImages(socialMediaPlanId: string | undefined) {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const queryKey = useMemo(() => [CAROUSEL_QUERY_KEY, socialMediaPlanId], [socialMediaPlanId]);

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<CarouselImageRow[]> => {
      if (!socialMediaPlanId) return [];
      const { data, error } = await supabase
        .from('social_media_plan_carousel_images')
        .select('id, social_media_plan_id, sort_order, storage_path, created_at')
        .eq('social_media_plan_id', socialMediaPlanId)
        .order('sort_order', { ascending: true });
      if (error) {
        devLog.debug('Carousel images fetch error:', error);
        throw error;
      }
      return (data || []) as CarouselImageRow[];
    },
    enabled: !!socialMediaPlanId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false, // Disabled to prevent reload when switching windows
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!socialMediaPlanId || !organizationId) throw new Error('Plan and organization required');
      const ext = file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg') ? '.jpg' : '.jpg';
      const path = `${organizationId}/${socialMediaPlanId}/${crypto.randomUUID()}${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(CAROUSEL_BUCKET)
        .upload(path, file, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;

      const { data: rows } = await supabase
        .from('social_media_plan_carousel_images')
        .select('sort_order')
        .eq('social_media_plan_id', socialMediaPlanId)
        .order('sort_order', { ascending: false })
        .limit(1);
      const nextOrder = rows?.[0] != null ? (rows[0] as { sort_order: number }).sort_order + 1 : 0;

      const { data: inserted, error: insertError } = await supabase
        .from('social_media_plan_carousel_images')
        .insert({
          social_media_plan_id: socialMediaPlanId,
          sort_order: nextOrder,
          storage_path: path,
        })
        .select()
        .single();
      if (insertError) {
        await supabase.storage.from(CAROUSEL_BUCKET).remove([path]);
        throw insertError;
      }
      return inserted as CarouselImageRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e) => {
      devLog.debug('Carousel upload error:', e);
      toast.error('Failed to upload image');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!socialMediaPlanId) throw new Error('Plan required');
      const { data: row, error: fetchErr } = await supabase
        .from('social_media_plan_carousel_images')
        .select('storage_path')
        .eq('id', id)
        .single();
      if (fetchErr || !row) throw fetchErr || new Error('Image not found');
      const path = (row as { storage_path: string }).storage_path;
      await supabase.storage.from(CAROUSEL_BUCKET).remove([path]);
      const { error: delErr } = await supabase
        .from('social_media_plan_carousel_images')
        .delete()
        .eq('id', id);
      if (delErr) throw delErr;

      const { data: remaining } = await supabase
        .from('social_media_plan_carousel_images')
        .select('id')
        .eq('social_media_plan_id', socialMediaPlanId)
        .order('sort_order', { ascending: true });
      if (remaining && remaining.length > 0) {
        for (let i = 0; i < remaining.length; i++) {
          await supabase
            .from('social_media_plan_carousel_images')
            .update({ sort_order: i })
            .eq('id', (remaining[i] as { id: string }).id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e) => {
      devLog.debug('Carousel delete error:', e);
      toast.error('Failed to delete image');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      if (!socialMediaPlanId) throw new Error('Plan required');
      // Two-phase update to avoid unique constraint (social_media_plan_id, sort_order):
      // first set all to a temp offset, then set final order.
      const offset = 10000;
      for (let i = 0; i < orderedIds.length; i++) {
        const { error } = await supabase
          .from('social_media_plan_carousel_images')
          .update({ sort_order: offset + i })
          .eq('id', orderedIds[i])
          .eq('social_media_plan_id', socialMediaPlanId);
        if (error) throw error;
      }
      for (let i = 0; i < orderedIds.length; i++) {
        const { error } = await supabase
          .from('social_media_plan_carousel_images')
          .update({ sort_order: i })
          .eq('id', orderedIds[i])
          .eq('social_media_plan_id', socialMediaPlanId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e) => {
      devLog.debug('Carousel reorder error:', e);
      toast.error('Failed to reorder images');
    },
  });

  const removeAllMutation = useMutation({
    mutationFn: async () => {
      if (!socialMediaPlanId) throw new Error('Plan required');
      const { data: rows, error: fetchErr } = await supabase
        .from('social_media_plan_carousel_images')
        .select('id, storage_path')
        .eq('social_media_plan_id', socialMediaPlanId);
      if (fetchErr) throw fetchErr;
      const paths = (rows || []).map((r) => (r as { storage_path: string }).storage_path);
      if (paths.length > 0) {
        const { error: storageErr } = await supabase.storage.from(CAROUSEL_BUCKET).remove(paths);
        if (storageErr) throw storageErr;
      }
      const { error: delErr } = await supabase
        .from('social_media_plan_carousel_images')
        .delete()
        .eq('social_media_plan_id', socialMediaPlanId);
      if (delErr) throw delErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e) => {
      devLog.debug('Carousel removeAll error:', e);
      toast.error('Failed to clear carousel images');
    },
  });

  const images = query.data ?? [];
  const upload = useCallback(
    (file: File) => uploadMutation.mutateAsync(file),
    [uploadMutation]
  );
  const remove = useCallback(
    (id: string) => deleteMutation.mutateAsync(id),
    [deleteMutation]
  );
  const reorder = useCallback(
    (orderedIds: string[]) => reorderMutation.mutateAsync(orderedIds),
    [reorderMutation]
  );
  const removeAll = useCallback(
    () => removeAllMutation.mutateAsync(),
    [removeAllMutation]
  );

  return {
    images,
    isLoading: query.isLoading,
    error: query.error,
    upload,
    remove,
    reorder,
    removeAll,
    isUploading: uploadMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isReordering: reorderMutation.isPending,
    isRemovingAll: removeAllMutation.isPending,
    refetch: query.refetch,
    count: images.length,
  };
}

/** Fetch carousel image counts for multiple plan IDs (for table/dashboard). */
export function useCarouselCountsMap(planIds: string[]) {
  const query = useQuery({
    queryKey: [CAROUSEL_QUERY_KEY, 'counts', planIds.sort().join(',')],
    queryFn: async (): Promise<Record<string, number>> => {
      if (planIds.length === 0) return {};
      const { data, error } = await supabase
        .from('social_media_plan_carousel_images')
        .select('social_media_plan_id')
        .in('social_media_plan_id', planIds);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const id of planIds) map[id] = 0;
      for (const row of data || []) {
        const id = (row as { social_media_plan_id: string }).social_media_plan_id;
        map[id] = (map[id] ?? 0) + 1;
      }
      return map;
    },
    enabled: planIds.length > 0,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false, // Disabled to prevent reload when switching windows
  });
  return { countsMap: query.data ?? {}, isLoading: query.isLoading, refetch: query.refetch };
}
