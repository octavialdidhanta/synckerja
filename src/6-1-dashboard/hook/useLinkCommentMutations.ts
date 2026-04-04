
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { toast } from 'sonner';
import { LinkComment } from './useLinkCommentsQuery';
import { devLog } from '@/shared/lib/logger';

export const useAddLinkComment = (socialMediaPlanId: string, linkUrl?: string) => {
  const queryClient = useQueryClient();
  const queryKey = ['link-comments', socialMediaPlanId];

  return useMutation({
    mutationFn: async ({
      commentText
    }: {
      commentText: string;
    }) => {
      // Defensive validation - check for undefined, null, or empty
      if (commentText === undefined || commentText === null) {
        devLog.debug('⚠️ Comment validation: commentText is undefined or null');
        throw new Error('Comment text is required');
      }

      // Early validation - skip logging for empty comments (already validated in UI)
      if (!commentText.trim()) {
        devLog.debug('⚠️ Comment validation: empty text provided (should be caught by UI)');
        throw new Error('Comment text is required');
      }

      devLog.debug('💬 Adding comment:', {
        socialMediaPlanId,
        commentTextLength: commentText.length
      });

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        devLog.debug('❌ User not authenticated:', userError);
        throw new Error('User not authenticated');
      }

      // First, let's check if the social_media_plan exists and user has access
      const { data: planData, error: planError } = await supabase
        .from('social_media_plans')
        .select('id, organization_id')
        .eq('id', socialMediaPlanId)
        .single();

      if (planError || !planData) {
        devLog.debug('❌ Social media plan not found or no access:', planError);
        throw new Error('Social media plan not found or no access');
      }

      // Check user's active organization
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('active_organization_id, full_name')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profileData) {
        devLog.debug('❌ Profile not found:', profileError);
        throw new Error('Profile not found');
      }

      if (profileData.active_organization_id !== planData.organization_id) {
        devLog.debug('❌ Organization mismatch:', {
          userOrg: profileData.active_organization_id,
          planOrg: planData.organization_id
        });
        throw new Error('User not authorized for this organization');
      }

      const commenterDisplayName = String(
        profileData.full_name || user.email || 'Team',
      ).trim();
      // link_url is NOT NULL in DB; align with sniping_images / public review (e.g. default-link for plan-level thread)
      const resolvedLinkUrl = (linkUrl && linkUrl.trim()) || 'default-link';
      // Ensure JSON payload types match DB (text/uuid) — odd profile shapes can otherwise contribute to 42804 upstream.
      const insertData = {
        social_media_plan_id: socialMediaPlanId,
        link_url: String(resolvedLinkUrl),
        comment_text: String(commentText.trim()),
        created_by: user.id,
        commenter_display_name: commenterDisplayName.length > 0 ? commenterDisplayName : null,
      };

      const { data, error } = await supabase
        .from('link_comments')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        devLog.debug('❌ Error inserting comment:', {
          message: error.message,
          code: error.code,
          details: error.details
        });
        throw error;
      }

      devLog.debug('✅ Comment inserted successfully:', data.id);

      // Fetch creator info separately
      try {
        const creatorInfo = {
          full_name: profileData.full_name || 'Unknown User',
          email: user.email || ''
        };

        return {
          ...data,
          creator: creatorInfo
        } as LinkComment;
      } catch (err) {
        devLog.debug('⚠️ Could not fetch creator info for new comment');
        return {
          ...data,
          creator: undefined
        } as LinkComment;
      }
    },
    onSuccess: (newComment) => {
      devLog.debug('✅ Comment added successfully:', newComment.id);
      
      // Invalidate and refetch immediately
      queryClient.invalidateQueries({
        queryKey,
        exact: true
      });
      
      // Also refetch to ensure immediate update
      queryClient.refetchQueries({
        queryKey,
        exact: true
      });
      
      toast.success('Comment added successfully');
    },
    onError: (error: any) => {
      // Don't log validation errors (already handled in UI)
      const isValidationError = error.message?.includes('Comment text is required');
      
      if (!isValidationError) {
        devLog.debug('❌ Error adding comment:', {
          message: error.message,
          code: error.code
        });
      }
      
      let errorMessage = 'Failed to add comment';
      if (error.message?.includes('auth')) {
        errorMessage = 'Authentication required';
      } else if (error.message?.includes('Comment text')) {
        errorMessage = 'Comment text is required';
        // Don't show toast for validation errors (already shown in UI)
        return;
      } else if (error.message?.includes('organization')) {
        errorMessage = 'Organization access denied';
      } else if (error.message?.includes('row-level security')) {
        errorMessage = 'Permission denied - please check your access rights';
      }
      
      toast.error(errorMessage);
    }
  });
};

export const useUpdateLinkComment = (socialMediaPlanId: string, _linkUrl?: string) => {
  const queryClient = useQueryClient();
  const queryKey = ['link-comments', socialMediaPlanId];

  return useMutation({
    mutationFn: async ({
      commentId,
      commentText
    }: {
      commentId: string;
      commentText: string;
    }) => {
      devLog.debug('✏️ Updating comment:', commentId);

      const updates = {
        comment_text: commentText,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('link_comments')
        .update(updates)
        .eq('id', commentId)
        .select()
        .single();

      if (error) {
        devLog.debug('❌ Error updating comment:', error);
        throw error;
      }

      // Fetch creator info separately
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('user_id', data.created_by)
          .single();

        return {
          ...data,
          creator: profileData || undefined
        } as LinkComment;
      } catch (err) {
        return {
          ...data,
          creator: undefined
        } as LinkComment;
      }
    },
    onSuccess: () => {
      devLog.debug('✅ Comment updated successfully');
      queryClient.invalidateQueries({
        queryKey
      });
      toast.success('Comment updated successfully');
    },
    onError: (error) => {
      devLog.debug('❌ Error updating comment:', error);
      toast.error('Failed to update comment');
    }
  });
};

export const useDeleteLinkComment = (socialMediaPlanId: string, _linkUrl?: string) => {
  const queryClient = useQueryClient();
  const queryKey = ['link-comments', socialMediaPlanId];

  return useMutation({
    mutationFn: async (commentId: string) => {
      devLog.debug('🗑️ Deleting comment:', commentId);

      const { error } = await supabase
        .from('link_comments')
        .delete()
        .eq('id', commentId);

      if (error) {
        devLog.debug('❌ Error deleting comment:', error);
        throw error;
      }

      devLog.debug('✅ Comment deleted successfully');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey
      });
      toast.success('Comment deleted successfully');
    },
    onError: (error) => {
      devLog.debug('❌ Error deleting comment:', error);
      toast.error('Failed to delete comment');
    }
  });
};
