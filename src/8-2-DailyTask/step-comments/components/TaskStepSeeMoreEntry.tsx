import { useEffect, useState } from 'react';
import { FileText, Loader2, MessageSquare, PenLine, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { Button } from '@/shared/components/ui/button';
import { TaskStepDescriptionEditor } from '@/8-2-DailyTask/components/TaskStepDescriptionEditor';
import { TaskStepDescriptionView } from '@/8-2-DailyTask/components/TaskStepDescriptionView';
import { useDailyTask } from '@/8-2-DailyTask/context/DailyTaskContext';
import { finalizeDescriptionForSave } from '@/8-2-DailyTask/lib/taskStepDescription';
import type { ImageLoupeState } from '@/8-2-DailyTask/components/TaskStepDescriptionImageLoupePanel';
import { TaskStepDescriptionImageLoupeFloating } from '@/8-2-DailyTask/components/TaskStepDescriptionImageLoupeFloating';
import { plainTextPreview } from '@/8-2-DailyTask/lib/taskStepDescription';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useToast } from '@/shared/components/ui/use-toast';
import { useIsMobile } from '@/mobile/shared/hooks/use-mobile';
import { useVisualViewport } from '@/shared/hooks/useVisualViewport';
import { cn } from '@/shared/lib/utils';
import { TaskStepCommentPanel } from './TaskStepCommentPanel';
import { useTaskStepCommentUnread } from '../hooks/useTaskStepCommentUnread';
import { canWriteStepComment } from '../lib/commentAccess';
import type { StepCommentWriteContext } from '../types';

type SeeMoreTab = 'detail' | 'update' | 'discussion';

/** Match CreateDailyTemplateModal sheet sizing (full height, sm:max-w-xl). */
const SEE_MORE_SHEET_CLASS =
  'z-[51] flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl';

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
}: TaskStepSeeMoreEntryProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { updateTaskStep } = useDailyTask();
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();
  const { data: currentEmployee } = useCurrentEmployee();
  const isMobile = useIsMobile();
  const { height, offsetTop, isKeyboardShellOpen } = useVisualViewport();
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateDraft, setUpdateDraft] = useState('');
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [mobileTab, setMobileTab] = useState<SeeMoreTab>('detail');
  const { unreadCount } = useTaskStepCommentUnread(stepId);
  const canUpdate = canWriteStepComment({
    ...writeContext,
    hasCommented: false,
    currentUserId: user?.id,
    currentEmployeeId: currentEmployee?.id,
  });

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
      setUpdateOpen(false);
      setUpdateDraft('');
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
    setUpdateOpen(false);
    setDiscussionOpen(true);
    if (isMobile) setMobileTab('discussion');
  };

  const closeDiscussion = () => {
    setDiscussionOpen(false);
    if (isMobile) setMobileTab('detail');
  };

  const openUpdate = () => {
    onImageLoupeChange(null);
    setDiscussionOpen(false);
    if (!updateOpen && mobileTab !== 'update') {
      setUpdateDraft(description ?? '');
    }
    setUpdateOpen(true);
    if (isMobile) setMobileTab('update');
  };

  const closeUpdate = () => {
    setUpdateOpen(false);
    setUpdateDraft('');
    if (isMobile) setMobileTab('detail');
  };

  const saveUpdate = async () => {
    if (!organizationId) return;
    const nextDescription = finalizeDescriptionForSave(updateDraft);
    setSavingUpdate(true);
    const saved = await updateTaskStep(stepId, { description: nextDescription }, { skipRefresh: true });
    setSavingUpdate(false);
    if (!saved) return;
    setUpdateDraft('');
    setUpdateOpen(false);
    setMobileTab('detail');
    toast({
      title: t('dailyTask.stepUpdate.saved', 'Update added'),
    });
  };

  if (!showEntry) return null;

  const updateActive = updateOpen || mobileTab === 'update';
  const showDiscussionTab =
    !updateActive && (discussionOpen || mobileTab === 'discussion');
  const detailActive = !updateActive && !showDiscussionTab;

  const renderDiscussionPanel = () => (
    <TaskStepCommentPanel
      taskStepId={stepId}
      writeContext={writeContext}
      isActive={open && showDiscussionTab}
      className="min-h-0 h-full flex-1"
      showHeader={false}
    />
  );

  const renderUpdatePanel = () => (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <TaskStepDescriptionEditor
        value={updateDraft}
        onChange={setUpdateDraft}
        disabled={savingUpdate || !organizationId}
        stepId={stepId}
        organizationId={organizationId ?? ''}
        fill
        placeholder={t(
          'dailyTask.stepUpdate.placeholder',
          'Edit the notes, or add what you finished. You can paste images.',
        )}
        minHeight="min-h-[280px]"
      />
    </div>
  );

  const updateFooter = (
    <div className="flex w-full justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        disabled={savingUpdate}
        onClick={(e) => {
          e.stopPropagation();
          closeUpdate();
        }}
      >
        {t('dailyTask.stepUpdate.cancel', 'Cancel')}
      </Button>
      <Button
        type="button"
        size="sm"
        className="h-8 text-xs"
        disabled={savingUpdate || !organizationId}
        onClick={(e) => {
          e.stopPropagation();
          void saveUpdate();
        }}
      >
        {savingUpdate ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
        {t('dailyTask.stepUpdate.save', 'Save update')}
      </Button>
    </div>
  );

  const renderDetailBody = (withLoupe: boolean) =>
    hasDescription ? (
      <div
        className={cn(
          'scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          isMobile ? 'px-4 py-3' : 'px-6 py-4',
        )}
      >
        <TaskStepDescriptionView
          value={description}
          enableImageLoupe={withLoupe}
          onImageLoupeChange={withLoupe ? onImageLoupeChange : undefined}
        />
      </div>
    ) : (
      <div className={cn('min-h-0 flex-1', isMobile ? 'px-4 py-3' : 'px-6 py-4')}>
        <p className="text-sm text-muted-foreground">
          {t('dailyTask.stepUpdate.noNotes', 'No notes yet. Use Update to add what you finished.')}
        </p>
      </div>
    );

  const commentFooterButton = (
    <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
      <Button
        type="button"
        variant={detailActive ? 'secondary' : 'outline'}
        size="sm"
        className="h-8 flex-1 gap-1.5 text-xs sm:flex-none"
        onClick={(e) => {
          e.stopPropagation();
          closeDiscussion();
          setUpdateOpen(false);
        }}
      >
        <FileText className="h-3.5 w-3.5" />
        {t('dailyTask.stepComments.tabDetail', 'Detail')}
      </Button>
      {canUpdate ? (
        <Button
          type="button"
          variant={updateActive ? 'secondary' : 'outline'}
          size="sm"
          className="h-8 flex-1 gap-1.5 text-xs sm:flex-none"
          onClick={(e) => {
            e.stopPropagation();
            openUpdate();
          }}
        >
          <PenLine className="h-3.5 w-3.5" />
          {t('dailyTask.stepComments.footerUpdate', 'Update')}
        </Button>
      ) : null}
      <Button
        type="button"
        variant={showDiscussionTab ? 'secondary' : 'outline'}
        size="sm"
        className="h-8 flex-1 gap-1.5 text-xs sm:flex-none"
        onClick={(e) => {
          e.stopPropagation();
          openDiscussion();
        }}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {t('dailyTask.stepComments.footerComment', 'Comment')}
        <UnreadBadge count={unreadCount} />
      </Button>
    </div>
  );

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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
            fullscreenAnimation
            overlayClassName="z-[60]"
            className={cn(
              'fixed left-0 right-0 top-0 z-[60] m-0 flex w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-none p-0 shadow-xl',
              !isKeyboardShellOpen && 'modal-above-safe-area h-dvh min-h-0 max-h-none',
            )}
            style={
              isKeyboardShellOpen && height > 0
                ? {
                    top: offsetTop,
                    height,
                    maxHeight: height,
                    transform: 'none',
                  }
                : undefined
            }
            hideCloseButton
            aria-describedby={undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <DialogTitle className="sr-only">{stepTitle}</DialogTitle>
            {!isKeyboardShellOpen ? (
              <div className="safe-area-top flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
                <h4 className="min-w-0 flex-1 truncate text-sm font-semibold leading-tight text-gray-900">
                  {stepTitle}
                </h4>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenChange(false);
                    onImageLoupeChange(null);
                  }}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-80 transition-opacity hover:bg-muted hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  aria-label={t('layout.sheetClose', 'Close')}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : null}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {updateActive ? (
                renderUpdatePanel()
              ) : showDiscussionTab ? (
                renderDiscussionPanel()
              ) : (
                renderDetailBody(false)
              )}
            </div>
            {(hasDescription || canUpdate) && !isKeyboardShellOpen ? (
              <div className="flex shrink-0 items-center border-t border-border px-4 py-2">
                {updateActive ? updateFooter : commentFooterButton}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const showDescriptionBody = hasDescription && detailActive;

  return (
    <>
      {triggerButton}
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            closeAll(onOpenChange, onImageLoupeChange, setDiscussionOpen);
            return;
          }
          onOpenChange(true);
        }}
      >
        <SheetContent
          side="left"
          className={`${SEE_MORE_SHEET_CLASS} [&>button.absolute]:hidden`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b px-6 py-4">
            <SheetTitle className="min-w-0 flex-1 text-left text-lg font-semibold leading-snug">
              {stepTitle}
            </SheetTitle>
            <SheetClose
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-70 ring-offset-background transition-opacity hover:bg-muted hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <X className="h-4 w-4" aria-hidden />
              <span className="sr-only">{t('layout.sheetClose', 'Close')}</span>
            </SheetClose>
          </div>

          <div
            ref={popoverAnchorRef}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {updateActive ? (
              renderUpdatePanel()
            ) : showDiscussionTab ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-2">
                {renderDiscussionPanel()}
              </div>
            ) : (
              renderDetailBody(true)
            )}
          </div>

          {(hasDescription || canUpdate) && (
            <div className="flex shrink-0 border-t bg-background px-6 py-4">
              {updateActive ? updateFooter : commentFooterButton}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {showDescriptionBody && open && (
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
