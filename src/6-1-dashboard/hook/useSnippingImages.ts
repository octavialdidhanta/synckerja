import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { toast } from 'sonner';
import { devLog } from '@/shared/lib/logger';

// Global cache to track if table exists - shared across all instances
const tableExistsCache = new Map<string, boolean>();

// Function to invalidate all sniping-images queries and set them to empty array
// This ensures ALL queries (including new ones) return empty array without network requests
const invalidateAllSnipingImagesQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  // Cancel any in-flight queries first
  queryClient.cancelQueries({ queryKey: ['sniping-images'] });
  
  // Set all related queries to empty array immediately
  queryClient.setQueriesData(
    { queryKey: ['sniping-images'], exact: false },
    () => []
  );
  
  // Set default options for all future queries with this pattern
  // This ensures new queries also get empty array without network request
  queryClient.setQueryDefaults(
    ['sniping-images'],
    {
      staleTime: Infinity,
      gcTime: Infinity,
      retry: false,
      placeholderData: [], // All new queries will get empty array immediately
      initialData: [], // All new queries will get empty array as initial data
    }
  );
};

export interface SnipingImage {
  id: string;
  social_media_plan_id: string;
  link_url: string;
  image_path: string;
  image_name: string;
  image_type?: string;
  image_size?: number;
  link_comments_id?: string | null;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

/** PostgREST returns 400 if `eq` on a uuid column receives a non-uuid string. */
const SOCIAL_PLAN_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const useSnippingImagesQuery = (socialMediaPlanId: string, linkUrl: string) => {
  const queryClient = useQueryClient();
  const effectiveLinkUrl = linkUrl || 'default-link';
  const queryKey = useMemo(
    () => ['sniping-images', socialMediaPlanId, effectiveLinkUrl],
    [socialMediaPlanId, effectiveLinkUrl],
  );

  const cacheKey = 'sniping_images_table_exists';
  const tableMissing = tableExistsCache.get(cacheKey) === false;
  const planIdOk = Boolean(socialMediaPlanId?.trim()) && SOCIAL_PLAN_UUID_RE.test(socialMediaPlanId.trim());

  // Always one useQuery — branching into two useQuery returns breaks Rules of Hooks when cache flips.
  return useQuery({
    queryKey,
    queryFn: async (): Promise<SnipingImage[]> => {
      if (!socialMediaPlanId) return [];

      const currentTableExists = tableExistsCache.get(cacheKey);
      if (currentTableExists === false) {
        return [];
      }

      try {
        const { data, error } = await supabase
          .from('sniping_images')
          .select('*')
          .eq('social_media_plan_id', socialMediaPlanId)
          .eq('link_url', effectiveLinkUrl)
          .order('created_at', { ascending: false });

        if (error) {
          if (error.code === '42P01') {
            tableExistsCache.set(cacheKey, false);
            devLog.debug('⚠️ sniping_images table does not exist (first detection), cached globally');

            invalidateAllSnipingImagesQueries(queryClient);

            return [];
          }
          console.error('❌ Error fetching sniping images:', error);
          throw error;
        }

        if (currentTableExists !== true) {
          tableExistsCache.set(cacheKey, true);
          devLog.debug('✅ sniping_images table exists, cached');
        }
        return (data || []) as SnipingImage[];
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err?.code === '42P01') {
          tableExistsCache.set(cacheKey, false);
          devLog.debug('⚠️ sniping_images table does not exist (catch), cached globally');

          invalidateAllSnipingImagesQueries(queryClient);

          return [];
        }
        throw error;
      }
    },
    enabled: planIdOk && !tableMissing,
    placeholderData: tableMissing ? ([] as SnipingImage[]) : undefined,
    initialData: tableMissing ? ([] as SnipingImage[]) : undefined,
    staleTime: tableMissing ? Infinity : 30 * 1000,
    gcTime: tableMissing ? Infinity : 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};

const useAddSnipingImage = (socialMediaPlanId: string, linkUrl: string) => {
  const queryClient = useQueryClient();
  const effectiveLinkUrl = linkUrl || 'default-link';
  const queryKey = ['sniping-images', socialMediaPlanId, effectiveLinkUrl];

  return useMutation({
    mutationFn: async ({
      imagePath,
      imageName,
      imageType,
      imageSize,
      linkCommentsId
    }: {
      imagePath: string;
      imageName: string;
      imageType?: string;
      imageSize?: number;
      linkCommentsId?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('sniping_images')
        .insert({
          social_media_plan_id: socialMediaPlanId,
          link_url: effectiveLinkUrl,
          image_path: imagePath,
          image_name: imageName,
          image_type: imageType,
          image_size: imageSize,
          link_comments_id: linkCommentsId || null,
          created_by: user.id
        })
        .select()
        .single();

      if (error) {
        // Check for table not found - could be PostgreSQL error code, PostgREST error, or HTTP 404
        const isTableNotFound = 
          error.code === '42P01' || // PostgreSQL table not found
          error.code === 'PGRST116' || // PostgREST table not found  
          error.status === 404 || // HTTP 404 Not Found
          error.statusCode === 404 ||
          error.message?.includes('does not exist') ||
          error.message?.includes('relation "sniping_images" does not exist') ||
          error.message?.includes('Not Found');
        
        if (isTableNotFound) {
          // Cache that table doesn't exist
          tableExistsCache.set('sniping_images_table_exists', false);
          devLog.debug('⚠️ sniping_images table does not exist - image uploaded to storage but not saved to database', {
            errorCode: error.code,
            errorStatus: error.status,
            errorMessage: error.message
          });
          
          // Image was uploaded to storage successfully, but can't save to database
          // Return a mock object so the UI doesn't break and user knows image was uploaded
          return {
            id: `temp-${Date.now()}`,
            social_media_plan_id: socialMediaPlanId,
            link_url: effectiveLinkUrl,
            image_path: imagePath,
            image_name: imageName,
            image_type: imageType,
            image_size: imageSize,
            link_comments_id: linkCommentsId || null,
            created_by: user.id,
            created_at: new Date().toISOString()
          } as SnipingImage;
        }
        
        devLog.debug('❌ Error adding sniping image:', error);
        throw error;
      }

      return data as SnipingImage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.refetchQueries({ queryKey });
    },
    onError: (error: any) => {
      // Check if it's a table not found error (already handled in mutationFn)
      const isTableNotFound = 
        error.code === '42P01' ||
        error.code === 'PGRST116' ||
        error.status === 404 ||
        error.statusCode === 404 ||
        error.message?.includes('does not exist') ||
        error.message?.includes('Table does not exist') ||
        error.message?.includes('Not Found');
      
      if (!isTableNotFound) {
        devLog.debug('❌ Error adding sniping image:', error);
        toast.error('Failed to add image to database');
      }
      // Don't show error toast for table not found - image was uploaded to storage
    }
  });
};

const useDeleteSnipingImage = (socialMediaPlanId: string, linkUrl: string) => {
  const queryClient = useQueryClient();
  const effectiveLinkUrl = linkUrl || 'default-link';
  const queryKey = ['sniping-images', socialMediaPlanId, effectiveLinkUrl];

  return useMutation({
    mutationFn: async (imageId: string) => {
      // First get the image to delete the file from storage
      const { data: image, error: fetchError } = await supabase
        .from('sniping_images')
        .select('image_path')
        .eq('id', imageId)
        .single();

      if (fetchError) {
        // If table doesn't exist, just try to delete from storage
        if (fetchError.code === '42P01') {
          console.warn('⚠️ sniping_images table does not exist, skipping database deletion');
        } else {
          console.error('❌ Error fetching image for deletion:', fetchError);
          throw fetchError;
        }
      } else {
        // Delete from storage
        if (image?.image_path) {
          const { error: storageError } = await supabase.storage
            .from('sniping-images')
            .remove([image.image_path]);

          if (storageError) {
            console.error('❌ Error deleting image from storage:', storageError);
            // Continue even if storage deletion fails
          }
        }

        // Delete from database
        const { error } = await supabase
          .from('sniping_images')
          .delete()
          .eq('id', imageId);

        if (error) {
          // If table doesn't exist, that's okay
          if (error.code === '42P01') {
            console.warn('⚠️ sniping_images table does not exist');
            return;
          }
          console.error('❌ Error deleting sniping image:', error);
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.refetchQueries({ queryKey });
      toast.success('Image deleted successfully');
    },
    onError: (error: any) => {
      console.error('❌ Error deleting sniping image:', error);
      toast.error('Failed to delete image');
    }
  });
};

export const useSnippingImages = (socialMediaPlanId: string, linkUrl: string) => {
  const { data: images = [], isLoading, error } = useSnippingImagesQuery(socialMediaPlanId, linkUrl);
  const addImageMutation = useAddSnipingImage(socialMediaPlanId, linkUrl);
  const deleteImageMutation = useDeleteSnipingImage(socialMediaPlanId, linkUrl);

  return useMemo(() => ({
    images,
    isLoading,
    error,
    addImage: (imagePath: string, imageName: string, imageType?: string, imageSize?: number, linkCommentsId?: string | null) => 
      addImageMutation.mutateAsync({ imagePath, imageName, imageType, imageSize, linkCommentsId }),
    deleteImage: (imageId: string) => deleteImageMutation.mutate(imageId),
    isAddingImage: addImageMutation.isPending,
    isDeletingImage: deleteImageMutation.isPending
  }), [
    images,
    isLoading,
    error,
    addImageMutation.mutateAsync,
    addImageMutation.isPending,
    deleteImageMutation.mutate,
    deleteImageMutation.isPending
  ]);
};

