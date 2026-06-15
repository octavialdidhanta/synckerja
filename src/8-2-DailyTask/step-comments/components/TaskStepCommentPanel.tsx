import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useToast } from '@/shared/components/ui/use-toast';
import { canWriteStepComment } from '../lib/commentAccess';
import { useMentionableEmployees } from '../hooks/useMentionableEmployees';
import { useTaskStepCommentMutations } from '../hooks/useTaskStepCommentMutations';
import { useTaskStepCommentsQuery } from '../hooks/useTaskStepCommentsQuery';
import { fetchCurrentProfileId, markTaskStepCommentsRead } from '../services/taskStepCommentService';
import { taskStepCommentUnreadQueryKey } from '../hooks/useTaskStepCommentUnread';
import { useQueryClient } from '@tanstack/react-query';
import { TaskStepCommentComposer } from './TaskStepCommentComposer';
import { TaskStepCommentList } from './TaskStepCommentList';
import type { StepCommentWriteContext } from '../types';

interface TaskStepCommentPanelProps {
  taskStepId: string;
  writeContext: StepCommentWriteContext;
  isActive?: boolean;
  className?: string;
  /** Hide built-in title when parent shell already shows one (floating panel). */
  showHeader?: boolean;
}

export function TaskStepCommentPanel({
  taskStepId,
  writeContext,
  isActive = true,
  className = '',
  showHeader = true,
}: TaskStepCommentPanelProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();
  const { data: currentEmployee } = useCurrentEmployee();
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useTaskStepCommentsQuery(
    organizationId ?? undefined,
    isActive ? taskStepId : undefined,
  );
  const { data: employees = [] } = useMentionableEmployees(organizationId ?? undefined);
  const { data: currentProfileId = null } = useQuery({
    queryKey: ['current-profile-id', user?.id],
    enabled: Boolean(user?.id),
    queryFn: fetchCurrentProfileId,
    staleTime: 5 * 60 * 1000,
  });

  const hasCommented = useMemo(
    () => comments.some((c) => c.profile_id === currentProfileId && !c.is_deleted),
    [comments, currentProfileId],
  );

  const canWrite = canWriteStepComment({
    ...writeContext,
    hasCommented,
    currentUserId: user?.id,
    currentEmployeeId: currentEmployee?.id,
  });

  const { addComment, editComment, deleteComment, reactToComment, removeReaction, isPending } =
    useTaskStepCommentMutations(organizationId ?? undefined, taskStepId, employees);

  useEffect(() => {
    if (!isActive || !taskStepId) return;
    void markTaskStepCommentsRead(taskStepId).then(() => {
      queryClient.invalidateQueries({ queryKey: taskStepCommentUnreadQueryKey(taskStepId) });
    });
  }, [isActive, taskStepId, queryClient]);

  const reportError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    toast({
      variant: 'destructive',
      title: t('dailyTask.stepComments.errorTitle', 'Comment failed'),
      description: message,
    });
  };

  return (
    <div className={`flex h-full min-h-0 flex-col bg-muted/20 ${className}`}>
      {showHeader && (
        <div className="shrink-0 border-b border-border px-3 py-2">
          <h5 className="text-xs font-semibold text-gray-900">
            {t('dailyTask.stepComments.title', 'Discussion')}
          </h5>
        </div>
      )}
      <div className="scrollbar-hide seamless-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <TaskStepCommentList
          comments={comments}
          isLoading={isLoading}
          currentProfileId={currentProfileId}
          employees={employees}
          canWrite={canWrite}
          isMutating={isPending}
          onReply={async (parentId, body) => {
            try {
              await addComment.mutateAsync({ body, parentId });
            } catch (e) {
              reportError(e);
            }
          }}
          onEdit={async (commentId, body) => {
            try {
              await editComment.mutateAsync({ commentId, body });
            } catch (e) {
              reportError(e);
            }
          }}
          onDelete={async (commentId) => {
            try {
              await deleteComment.mutateAsync(commentId);
            } catch (e) {
              reportError(e);
            }
          }}
          onReact={async (commentId, emoji) => {
            try {
              await reactToComment.mutateAsync({ commentId, emoji });
            } catch (e) {
              reportError(e);
            }
          }}
          onRemoveReaction={async (commentId) => {
            try {
              await removeReaction.mutateAsync(commentId);
            } catch (e) {
              reportError(e);
            }
          }}
        />
      </div>
      {canWrite ? (
        <div className="shrink-0 border-t border-border p-2">
          <TaskStepCommentComposer
            employees={employees}
            disabled={!canWrite}
            isSubmitting={addComment.isPending}
            onSubmit={async (body) => {
              try {
                await addComment.mutateAsync({ body });
              } catch (e) {
                reportError(e);
                throw e;
              }
            }}
          />
        </div>
      ) : (
        <div className="shrink-0 border-t border-border px-3 py-2">
          <p className="text-[10px] text-gray-500">
            {t(
              'dailyTask.stepComments.readOnly',
              'Only assignees, the task creator, and participants can comment.',
            )}
          </p>
        </div>
      )}
    </div>
  );
}
