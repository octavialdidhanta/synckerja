import { useState } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { formatDateTime } from '@/shared/utils/dateFormatter';
import { splitCommentBodySegments } from '../lib/commentMentionUtils';
import { TextWithAutoLinks } from '@/8-2-DailyTask/components/TextWithAutoLinks';
import { TaskStepCommentComposer } from './TaskStepCommentComposer';
import { TaskStepCommentReactions } from './TaskStepCommentReactions';
import type { MentionableEmployee, TaskStepComment, TaskStepCommentReactionEmoji } from '../types';

interface TaskStepCommentItemProps {
  comment: TaskStepComment;
  replies: TaskStepComment[];
  currentProfileId: string | null;
  employees: MentionableEmployee[];
  canWrite: boolean;
  isMutating?: boolean;
  onReply: (parentId: string, body: string) => Promise<void>;
  onEdit: (commentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onReact: (commentId: string, emoji: TaskStepCommentReactionEmoji) => Promise<void>;
  onRemoveReaction: (commentId: string) => Promise<void>;
  depth?: number;
}

function CommentBody({ body }: { body: string }) {
  const segments = splitCommentBodySegments(body);
  return (
    <p className="whitespace-pre-wrap break-words text-xs text-gray-800">
      {segments.map((seg, i) =>
        seg.type === 'mention' ? (
          <span key={i} className="font-medium text-primary">
            @{seg.value}
          </span>
        ) : (
          <TextWithAutoLinks key={i} text={seg.value} />
        ),
      )}
    </p>
  );
}

export function TaskStepCommentItem({
  comment,
  replies,
  currentProfileId,
  employees,
  canWrite,
  isMutating,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onRemoveReaction,
  depth = 0,
}: TaskStepCommentItemProps) {
  const { t } = useAppTranslation();
  const [replyOpen, setReplyOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const isAuthor = currentProfileId === comment.profile_id;
  const edited = comment.updated_at && comment.created_at !== comment.updated_at;

  if (comment.is_deleted) {
    return (
      <div className={`rounded-md border border-dashed border-border bg-muted/20 px-2 py-1.5 ${depth > 0 ? 'ml-4' : ''}`}>
        <p className="text-xs italic text-gray-500">
          {t('dailyTask.stepComments.deleted', 'This comment was deleted')}
        </p>
      </div>
    );
  }

  return (
    <div className={depth > 0 ? 'ml-4 border-l border-border pl-2' : ''}>
      <div className="rounded-md border border-border/70 bg-white px-2.5 py-2">
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-gray-900">{comment.author_name ?? 'User'}</p>
            <p className="text-[10px] text-gray-500">{formatDateTime(comment.created_at)}</p>
          </div>
          {isAuthor && !editOpen && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-gray-500 hover:text-gray-900"
                  aria-label={t('dailyTask.stepComments.moreActions', 'More actions')}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[100] min-w-[7rem]">
                <DropdownMenuItem
                  className="text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditOpen(true);
                  }}
                >
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  {t('common.edit', 'Edit')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-xs text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onDelete(comment.id);
                  }}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  {t('common.delete', 'Delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {editOpen ? (
          <TaskStepCommentComposer
            employees={employees}
            initialValue={comment.body}
            disabled={!canWrite}
            isSubmitting={isMutating}
            submitLabel={t('common.save', 'Save')}
            onCancel={() => setEditOpen(false)}
            onSubmit={async (body) => {
              await onEdit(comment.id, body);
              setEditOpen(false);
            }}
          />
        ) : (
          <>
            <CommentBody body={comment.body} />
            {edited && (
              <p className="mt-0.5 text-[10px] text-gray-500">
                {t('dailyTask.stepComments.edited', 'Edited')}
              </p>
            )}
          </>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <TaskStepCommentReactions
            comment={comment}
            currentProfileId={currentProfileId}
            disabled={!canWrite || isMutating}
            onReact={(emoji) => void onReact(comment.id, emoji)}
            onRemoveReaction={() => void onRemoveReaction(comment.id)}
          />
          {canWrite && depth < 2 && (
            <button
              type="button"
              className="text-[10px] font-medium text-primary hover:text-primary/90"
              onClick={() => setReplyOpen((v) => !v)}
            >
              {t('dailyTask.stepComments.reply', 'Reply')}
            </button>
          )}
        </div>

        {replyOpen && (
          <div className="mt-2 border-t border-border pt-2">
            <TaskStepCommentComposer
              employees={employees}
              disabled={!canWrite}
              isSubmitting={isMutating}
              autoFocus
              submitLabel={t('dailyTask.stepComments.reply', 'Reply')}
              onCancel={() => setReplyOpen(false)}
              onSubmit={async (body) => {
                await onReply(comment.id, body);
                setReplyOpen(false);
              }}
            />
          </div>
        )}
      </div>

      {replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {replies.map((reply) => (
            <TaskStepCommentItem
              key={reply.id}
              comment={reply}
              replies={[]}
              currentProfileId={currentProfileId}
              employees={employees}
              canWrite={canWrite}
              isMutating={isMutating}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onReact={onReact}
              onRemoveReaction={onRemoveReaction}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
