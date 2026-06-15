import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { TaskStepDescriptionView } from '@/8-2-DailyTask/components/TaskStepDescriptionView';
import type { ImageLoupeState } from '@/8-2-DailyTask/components/TaskStepDescriptionImageLoupePanel';
import { TaskStepDescriptionImageLoupeFloating } from '@/8-2-DailyTask/components/TaskStepDescriptionImageLoupeFloating';
import { plainTextPreview } from '@/8-2-DailyTask/lib/taskStepDescription';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useIsMobile } from '@/mobile/shared/hooks/use-mobile';
import { TaskStepCommentPanel } from './TaskStepCommentPanel';
import { COMMENT_FLOAT_WIDTH } from './TaskStepCommentFloating';
import { useTaskStepCommentUnread } from '../hooks/useTaskStepCommentUnread';
import type { StepCommentWriteContext } from '../types';

type SeeMoreTab = 'detail' | 'discussion';

/** Desktop description shell — fixed size (matches original See more popover). */
const DESKTOP_DESC_WIDTH = '36rem';
const DESKTOP_SHELL_HEIGHT = 'min(520px,70vh)';
const DESKTOP_CONTENT_MAX_H = 'min(480px,65vh)';
const DESKTOP_SHELL_LEFT = 'pl-14 sm:pl-20 md:pl-24';
const DESKTOP_COMMENT_WIDTH = `${COMMENT_FLOAT_WIDTH}px`;

interface TaskStepSeeMoreEntryProps {
  stepId: string;
  stepTitle: string;
  description: string;
  writeContext: StepCommentWriteContext;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: SeeMoreTab;
  popoverAnchorRef: React.RefObject<HTMLDivElement | null>;
  descriptionImageLoupe: ImageLoupeState | null;
  onImageLoupeChange: (state: ImageLoupeState | null) => void;
  /** Mobile task card: expand description inline instead of opening a dialog */
  inlineDescriptionExpand?: boolean;
  onInlineDescriptionExpand?: () => void;
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-1.5 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 py-0.5 text-[9px] font-semibold leading-none text-primary-foreground">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function closeAll(
  onOpenChange: (open: boolean) => void,
  onImageLoupeChange: (state: ImageLoupeState | null) => void,
  setDiscussionOpen: (open: boolean) => void,
) {
  onOpenChange(false);
  onImageLoupeChange(null);
  setDiscussionOpen(false);
}

export function TaskStepSeeMoreEntry({
  stepId,
  stepTitle,
  description,
  writeContext,
  open,
  onOpenChange,
  initialTab = 'detail',
  popoverAnchorRef,
  descriptionImageLoupe,
  onImageLoupeChange,
  inlineDescriptionExpand = false,
  onInlineDescriptionExpand,
}: TaskStepSeeMoreEntryProps) {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<SeeMoreTab>('detail');
  const { unreadCount } = useTaskStepCommentUnread(stepId);

  const hasDescription = Boolean(description?.trim());
  const hasLongDescription =
    plainTextPreview(description, 200).length > 50 || /<img\b/i.test(description);
  const showEntry = hasLongDescription || unreadCount > 0;
  const buttonLabel = hasLongDescription
    ? t('dailyTask.stepComments.seeMore', 'See more')
    : t('dailyTask.stepComments.open', 'Discussion');

  useEffect(() => {
    if (!open) {
      setDiscussionOpen(false);
      setMobileTab('detail');
      return;
    }
    if (initialTab === 'discussion' || !hasDescription) {
      setDiscussionOpen(true);
      setMobileTab('discussion');
    } else {
      setDiscussionOpen(false);
      setMobileTab('detail');
    }
  }, [open, initialTab, hasDescription]);

  const openDiscussion = () => {
    onImageLoupeChange(null);
    setDiscussionOpen(true);
    if (isMobile) setMobileTab('discussion');
  };

  const closeDiscussion = () => {
    setDiscussionOpen(false);
    if (isMobile) setMobileTab('detail');
  };

  const toggleDiscussion = () => {
    if (discussionOpen || mobileTab === 'discussion') {
      closeDiscussion();
    } else {
      openDiscussion();
    }
  };

  if (!showEntry) return null;

  const renderDiscussionPanel = (withHeader: boolean) => (
    <TaskStepCommentPanel
      taskStepId={stepId}
      writeContext={writeContext}
      isActive={open && (discussionOpen || mobileTab === 'discussion' || !hasDescription)}
      className="min-h-0 h-full flex-1"
      showHeader={withHeader}
    />
  );

  const commentFooterButton = (
    <Button
      type="button"
      variant={discussionOpen || mobileTab === 'discussion' ? 'secondary' : 'outline'}
      size="sm"
      className="h-8 gap-1.5 text-xs"
      onClick={(e) => {
        e.stopPropagation();
        toggleDiscussion();
      }}
    >
      <MessageSquare className="h-3.5 w-3.5" />
      {t('dailyTask.stepComments.footerComment', 'Comment')}
      <UnreadBadge count={unreadCount} />
    </Button>
  );

  const useInlineDescription = inlineDescriptionExpand && hasLongDescription;

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (useInlineDescription && onInlineDescriptionExpand) {
      onInlineDescriptionExpand();
      return;
    }
    onOpenChange(true);
  };

  const triggerButton = (
    <button
      type="button"
      className="inline-flex flex-shrink-0 cursor-pointer items-center text-xs font-medium text-primary hover:text-primary/90"
      onClick={handleTriggerClick}
    >
      {buttonLabel}
      <UnreadBadge count={unreadCount} />
    </button>
  );

  if (isMobile) {
    const showDiscussionDialog =
      open &&
      (!useInlineDescription ||
        !hasDescription ||
        mobileTab === 'discussion' ||
        discussionOpen ||
        initialTab === 'discussion');

    if (!showDiscussionDialog) {
      return triggerButton;
    }

    return (
      <>
        {triggerButton}
        <Dialog
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            if (!next) onImageLoupeChange(null);
          }}
        >
          <DialogContent
            className="flex max-h-[85vh] w-[min(100vw-2rem,36rem)] flex-col gap-0 overflow-hidden p-0"
            hideCloseButton={false}
            aria-describedby={undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <DialogTitle className="sr-only">{stepTitle}</DialogTitle>
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 pr-12 py-3">
              <h4 className="min-w-0 truncate text-sm font-semibold text-gray-900">{stepTitle}</h4>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {mobileTab === 'detail' && hasDescription && !useInlineDescription ? (
                <div className="scrollbar-hide seamless-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">
                  <TaskStepDescriptionView value={description} />
                </div>
              ) : (
                renderDiscussionPanel(true)
              )}
            </div>
            {hasDescription && !useInlineDescription && (
              <div className="flex shrink-0 items-center justify-end border-t border-border px-4 py-2">
                {commentFooterButton}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      {triggerButton}
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/55 animate-in fade-in-0 duration-200"
            aria-label="Close description"
            onClick={(e) => {
              e.stopPropagation();
              closeAll(onOpenChange, onImageLoupeChange, setDiscussionOpen);
            }}
          />,
          document.body,
        )}
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`pointer-events-none fixed inset-0 z-50 flex items-center justify-start py-4 pr-4 ${DESKTOP_SHELL_LEFT}`}
          >
            <div
              className="pointer-events-auto flex items-stretch gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                ref={popoverAnchorRef}
                className="flex shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-white shadow-xl"
                style={{
                  width: DESKTOP_DESC_WIDTH,
                  maxWidth: 'calc(100vw - 2rem)',
                  height: DESKTOP_SHELL_HEIGHT,
                  maxHeight: DESKTOP_SHELL_HEIGHT,
                }}
              >
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
                  <h4 className="min-w-0 flex-1 truncate pr-2 text-sm font-semibold text-gray-900">
                    {stepTitle}
                  </h4>
                  <button
                    type="button"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                    aria-label="Close description"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeAll(onOpenChange, onImageLoupeChange, setDiscussionOpen);
                    }}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                {hasDescription ? (
                  <>
                    <div
                      className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      style={{ maxHeight: DESKTOP_CONTENT_MAX_H }}
                    >
                      <TaskStepDescriptionView
                        value={description}
                        enableImageLoupe={!discussionOpen}
                        onImageLoupeChange={onImageLoupeChange}
                      />
                    </div>
                    <div className="flex shrink-0 items-center justify-end border-t border-border px-4 py-2">
                      {commentFooterButton}
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[min(320px,50vh)] flex-col">{renderDiscussionPanel(true)}</div>
                )}
              </div>

              {discussionOpen && hasDescription && (
                <div
                  className="flex shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-white shadow-xl"
                  style={{
                    width: DESKTOP_COMMENT_WIDTH,
                    maxWidth: DESKTOP_COMMENT_WIDTH,
                    height: DESKTOP_SHELL_HEIGHT,
                    maxHeight: DESKTOP_SHELL_HEIGHT,
                  }}
                >
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
                    <h5 className="min-w-0 truncate text-xs font-semibold text-gray-900">
                      {t('dailyTask.stepComments.title', 'Discussion')}
                    </h5>
                    <button
                      type="button"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                      aria-label="Close discussion"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeDiscussion();
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    {renderDiscussionPanel(false)}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
      {!discussionOpen && open && (
        <TaskStepDescriptionImageLoupeFloating
          anchorRef={popoverAnchorRef}
          state={descriptionImageLoupe}
        />
      )}
    </>
  );
}

interface UseTaskStepSeeMoreOptions {
  stepId: string;
  taskId: string;
  pendingFocus: { taskId: string; stepId: string } | null;
  onClearPendingFocus: () => void;
}

export function useTaskStepSeeMoreFocus({
  stepId,
  taskId,
  pendingFocus,
  onClearPendingFocus,
}: UseTaskStepSeeMoreOptions) {
  const [open, setOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<SeeMoreTab>('detail');

  useEffect(() => {
    if (!pendingFocus) return;
    if (pendingFocus.stepId !== stepId) return;
    if (pendingFocus.taskId !== taskId) return;
    setInitialTab('discussion');
    setOpen(true);
    onClearPendingFocus();
  }, [pendingFocus, stepId, taskId, onClearPendingFocus]);

  return { open, setOpen, initialTab };
}
