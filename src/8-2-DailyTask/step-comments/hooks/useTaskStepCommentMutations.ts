import { useMutation, useQueryClient } from '@tanstack/react-query';
import { parseMentionedProfileIds } from '../lib/commentMentionUtils';
import {
  fetchCurrentProfileId,
  insertTaskStepComment,
  removeTaskStepCommentReaction,
  softDeleteTaskStepComment,
  updateTaskStepCommentBody,
  upsertTaskStepCommentReaction,
} from '../services/taskStepCommentService';
import { taskStepCommentsQueryKey } from './useTaskStepCommentsQuery';
import type { MentionableEmployee, TaskStepCommentReactionEmoji } from '../types';

export function useTaskStepCommentMutations(
  organizationId: string | undefined,
  taskStepId: string | undefined,
  mentionEmployees: MentionableEmployee[],
) {
  const queryClient = useQueryClient();
  const enabled = Boolean(organizationId && taskStepId);

  const invalidate = () => {
    if (!organizationId || !taskStepId) return;
    queryClient.invalidateQueries({ queryKey: taskStepCommentsQueryKey(organizationId, taskStepId) });
  };

  const addComment = useMutation({
    mutationFn: async (params: { body: string; parentId?: string | null }) => {
      if (!organizationId || !taskStepId) throw new Error('Missing context');
      const profileId = await fetchCurrentProfileId();
      if (!profileId) throw new Error('Not authenticated');
      const mentionedProfileIds = parseMentionedProfileIds(params.body, mentionEmployees);
      return insertTaskStepComment({
        organizationId,
        taskStepId,
        profileId,
        body: params.body,
        mentionedProfileIds,
        parentId: params.parentId ?? null,
      });
    },
    onSuccess: invalidate,
  });

  const editComment = useMutation({
    mutationFn: async (params: { commentId: string; body: string }) => {
      const mentionedProfileIds = parseMentionedProfileIds(params.body, mentionEmployees);
      await updateTaskStepCommentBody(params.commentId, params.body, mentionedProfileIds);
    },
    onSuccess: invalidate,
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      await softDeleteTaskStepComment(commentId);
    },
    onSuccess: invalidate,
  });

  const reactToComment = useMutation({
    mutationFn: async (params: { commentId: string; emoji: TaskStepCommentReactionEmoji }) => {
      const profileId = await fetchCurrentProfileId();
      if (!profileId) throw new Error('Not authenticated');
      await upsertTaskStepCommentReaction(params.commentId, profileId, params.emoji);
    },
    onSuccess: invalidate,
  });

  const removeReaction = useMutation({
    mutationFn: async (commentId: string) => {
      const profileId = await fetchCurrentProfileId();
      if (!profileId) throw new Error('Not authenticated');
      await removeTaskStepCommentReaction(commentId, profileId);
    },
    onSuccess: invalidate,
  });

  return {
    enabled,
    addComment,
    editComment,
    deleteComment,
    reactToComment,
    removeReaction,
    isPending:
      addComment.isPending ||
      editComment.isPending ||
      deleteComment.isPending ||
      reactToComment.isPending ||
      removeReaction.isPending,
  };
}
