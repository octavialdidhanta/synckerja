import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Separator } from '@/shared/components/ui/separator';
import { ListChecks, X } from 'lucide-react';
import { useDailyTask } from '../context/DailyTaskContext';
import { useToast } from '@/shared/components/ui/use-toast';
import { useIsMobile } from '@/mobile/shared/hooks/use-mobile';
import { cn } from '@/shared/lib/utils';
// import { useTranslation } from 'react-i18next';

export interface ModalAddTaskStepProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskTitle: string;
  editingStep?: {
    id: string;
    title: string;
    description?: string | null;
  } | null;
  onSuccess?: () => void;
}

export const ModalAddTaskStep = ({
  open,
  onOpenChange,
  taskId,
  taskTitle,
  editingStep,
  onSuccess
}: ModalAddTaskStepProps) => {
  // const { t } = useTranslation();
  const [stepTitle, setStepTitle] = useState('');
  const [stepDescription, setStepDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addTaskStep, updateTaskStep } = useDailyTask();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const isEditMode = !!editingStep;

  // Populate form when editing or reset when modal opens/closes
  useEffect(() => {
    if (open) {
      if (editingStep) {
        // Edit mode: populate with existing data
        const titleValue = editingStep.title || '';
        // Handle description: if null/undefined, use empty string; otherwise use the value
        const descValue = editingStep.description != null ? editingStep.description : '';
        
        setStepTitle(titleValue);
        setStepDescription(descValue);
      } else {
        // Add mode: reset form
        setStepTitle('');
        setStepDescription('');
      }
    } else {
      // Reset when modal closes
      setStepTitle('');
      setStepDescription('');
    }
  }, [open, editingStep?.id, editingStep?.title, editingStep?.description]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if (!stepTitle.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a step title',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (isEditMode && editingStep) {
        // Edit mode: update existing step
        await updateTaskStep(editingStep.id, {
          title: stepTitle.trim(),
          description: stepDescription.trim() || null,
        });

        toast({
          title: 'Success',
          description: 'Step updated successfully',
        });
      } else {
        // Add mode: create new step
        await addTaskStep(taskId, stepTitle.trim(), stepDescription.trim() || undefined);

        toast({
          title: 'Success',
          description: 'Step added successfully',
        });
      }

      // Reset form
      setStepTitle('');
      setStepDescription('');

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'adding'} step:`, error);
      toast({
        title: 'Error',
        description: `Failed to ${isEditMode ? 'update' : 'add'} step`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Reset form
    setStepTitle('');
    setStepDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'p-0 flex flex-col gap-0',
          isMobile
            ? 'fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none rounded-none modal-above-safe-area'
            : 'w-[600px] h-[600px] max-w-[90vw] max-h-[90vh]'
        )}
        hideCloseButton={isMobile}
        fullscreenAnimation={isMobile}
      >
        <DialogHeader
          className={cn(
            'flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left',
            isMobile
              ? 'safe-area-top flex flex-row flex-nowrap items-stretch gap-0 space-y-0 px-0 py-0'
              : 'px-6 pt-6 pb-4'
          )}
        >
          <div className={cn('flex items-center gap-3', isMobile ? 'w-full min-w-0 gap-1.5 px-3 py-2' : '')}>
            <div className={cn('flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 flex-shrink-0', isMobile ? 'h-9 w-9 rounded-md' : 'w-10 h-10 rounded-lg')}>
              <ListChecks className={cn('text-blue-600 dark:text-blue-400', isMobile ? 'h-4 w-4' : 'h-5 w-5')} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className={cn(isMobile ? 'm-0 truncate py-0 pr-1 text-base font-semibold leading-tight' : 'text-lg font-semibold md:text-xl')}>
                {isEditMode ? 'Edit Step' : 'Add New Step'}
              </DialogTitle>
            </div>
            {isMobile ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="inline-flex h-9 w-9 shrink-0 rounded-full p-0"
                onClick={handleCancel}
                disabled={isSubmitting}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </DialogHeader>

        <div
          className={cn(
            'scrollbar-hide seamless-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            isMobile ? 'px-6 pt-4 pb-6' : 'px-6 py-6'
          )}
          style={
            !isMobile
              ? {
                  scrollbarWidth: 'thin',
                  scrollBehavior: 'smooth',
                  scrollbarColor: '#d1d5db transparent',
                }
              : undefined
          }
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Task Information Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="task_info" className="text-sm font-medium text-foreground">
                  Task
                </label>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-300 font-semibold">{taskTitle}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Step Information Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="step_title" className="text-sm font-medium text-foreground">
                  Step Title <span className="text-red-500">*</span>
                </label>
                <Input
                  id="step_title"
                  placeholder="e.g., Review document, Send email, etc."
                  value={stepTitle}
                  onChange={(e) => setStepTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  disabled={isSubmitting}
                  className="text-sm"
                  autoFocus
                />
              </div>
            </div>

            <Separator />

            {/* Description Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="step_description" className="text-sm font-medium text-foreground">
                  Description <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                </label>
                <Textarea
                  id="step_description"
                  placeholder="Add more details about this step..."
                  value={stepDescription}
                  onChange={(e) => setStepDescription(e.target.value)}
                  disabled={isSubmitting}
                  className="text-sm min-h-[100px] resize-none"
                />
              </div>
            </div>
          </form>
        </div>

        <div className={cn('px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30', !isMobile && 'px-6 pt-4 pb-4')}>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={!stepTitle.trim() || isSubmitting}
              className="min-w-[120px] flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{isEditMode ? 'Saving...' : 'Adding...'}</span>
                </>
              ) : (
                isEditMode ? 'Save Changes' : 'Add Step'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

