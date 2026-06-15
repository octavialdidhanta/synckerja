import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { buildCommentTree, getRepliesForComment } from '../hooks/useTaskStepCommentsQuery';
import { TaskStepCommentItem } from './TaskStepCommentItem';
import type { MentionableEmployee, TaskStepComment, TaskStepCommentReactionEmoji } from '../types';

interface TaskStepCommentListProps {
  comments: TaskStepComment[];
  isLoading: boolean;
  currentProfileId: string | null;
  employees: MentionableEmployee[];
  canWrite: boolean;
  isMutating?: boolean;
  onReply: (parentId: string, body: string) => Promise<void>;
  onEdit: (commentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onReact: (commentId: string, emoji: TaskStepCommentReactionEmoji) => Promise<void>;
  onRemoveReaction: (commentId: string) => Promise<void>;
}

export function TaskStepCommentList({
  comments,
  isLoading,
  currentProfileId,
  employees,
  canWrite,
  isMutating,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onRemoveReaction,
}: TaskStepCommentListProps) {
  const { t } = useAppTranslation();

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  const roots = buildCommentTree(comments);
  if (roots.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-3 py-6 text-center">
        <p className="text-xs text-gray-500">
          {t('dailyTask.stepComments.empty', 'No comments yet. Start the discussion.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2">
      {roots.map((comment) => (
        <TaskStepCommentItem
          key={comment.id}
          comment={comment}
          replies={getRepliesForComment(comments, comment.id)}
          currentProfileId={currentProfileId}
          employees={employees}
          canWrite={canWrite}
          isMutating={isMutating}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onReact={onReact}
          onRemoveReaction={onRemoveReaction}
        />
      ))}
    </div>
  );
}
