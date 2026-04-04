
import { useMemo, useCallback } from 'react';
import { useLinkCommentsQuery } from './useLinkCommentsQuery';
import { useAddLinkComment, useUpdateLinkComment, useDeleteLinkComment } from './useLinkCommentMutations';

export { type LinkComment } from './useLinkCommentsQuery';

export const useLinkComments = (socialMediaPlanId: string, linkUrl?: string) => {
  const {
    data: comments = [],
    isLoading,
    error
  } = useLinkCommentsQuery(socialMediaPlanId, linkUrl);

  const addCommentMutation = useAddLinkComment(socialMediaPlanId, linkUrl);
  const updateCommentMutation = useUpdateLinkComment(socialMediaPlanId, linkUrl);
  const deleteCommentMutation = useDeleteLinkComment(socialMediaPlanId, linkUrl);

  // Safe wrapper for addComment to prevent undefined/null values
  const safeAddComment = useCallback(async (params: { commentText: string }) => {
    // Defensive validation before calling mutation
    if (!params || typeof params !== 'object') {
      throw new Error('Invalid parameters: commentText is required');
    }
    if (params.commentText === undefined || params.commentText === null) {
      throw new Error('Comment text is required');
    }
    if (typeof params.commentText !== 'string') {
      throw new Error('Comment text must be a string');
    }
    if (!params.commentText.trim()) {
      throw new Error('Comment text cannot be empty');
    }
    return addCommentMutation.mutateAsync(params);
  }, [addCommentMutation.mutateAsync]);

  const safeUpdateComment = useCallback(async (commentId: string, commentText: string) => {
    if (!commentId || typeof commentId !== 'string') {
      throw new Error('Comment id is required');
    }
    if (commentText === undefined || commentText === null || typeof commentText !== 'string') {
      throw new Error('Comment text is required');
    }
    if (!commentText.trim()) {
      throw new Error('Comment text cannot be empty');
    }

    return updateCommentMutation.mutateAsync({
      commentId,
      commentText: commentText.trim()
    });
  }, [updateCommentMutation.mutateAsync]);

  const safeDeleteComment = useCallback(async (commentId: string) => {
    if (!commentId || typeof commentId !== 'string') {
      throw new Error('Comment id is required');
    }

    return deleteCommentMutation.mutateAsync(commentId);
  }, [deleteCommentMutation.mutateAsync]);

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(() => ({
    comments,
    isLoading,
    error,
    addComment: safeAddComment,
    updateComment: safeUpdateComment,
    deleteComment: safeDeleteComment,
    isAddingComment: addCommentMutation.isPending,
    isUpdatingComment: updateCommentMutation.isPending,
    isDeletingComment: deleteCommentMutation.isPending
  }), [
    comments,
    isLoading,
    error,
    safeAddComment,
    safeUpdateComment,
    safeDeleteComment,
    addCommentMutation.isPending,
    updateCommentMutation.isPending,
    deleteCommentMutation.isPending
  ]);
};
