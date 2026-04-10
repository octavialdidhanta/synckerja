import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/features/ui/dialog';
import { Button } from '@/features/ui/button';
import { CheckSquare, Target, FileText, Info } from 'lucide-react';
import { useToast } from '@/features/1-login/hooks/use-toast';
import { useCurrentOrg } from '@/features/1-login/hooks/useCurrentOrg';
import { useOkrCycles } from '@/features/1_home/components/HomeOKRDashboard/hooks/useOkrCycles';
import { supabase } from '@/integrations/supabase/client';
import { ObjectiveHierarchyDialog } from '@/mobile/pages/daily task/section/ObjectiveHierarchyDialog';
import { Skeleton } from '@/mobile/components/ui/skeleton';
import { Badge } from '@/features/ui/badge';
import { useIsMobile } from '@/mobile/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { logger } from '@/config/logger';

interface AddSolutionAsDailyTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  solution: {
    id: string;
    solution_description: string;
  };
  meetingPointId: string;
  discussionPoint: string;
}

export const AddSolutionAsDailyTaskModal: React.FC<AddSolutionAsDailyTaskModalProps> = ({
  isOpen,
  onClose,
  solution,
  meetingPointId,
  discussionPoint
}) => {
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const { data: cycles = [] } = useOkrCycles(organizationId);
  const isMobile = useIsMobile();
  
  // Get active cycle IDs
  const activeCycleIds = cycles
    .filter(cycle => (cycle as any).is_active === true)
    .map(cycle => cycle.id);

  // State management
  const [isObjectiveDialogOpen, setIsObjectiveDialogOpen] = useState(false);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [objectiveContext, setObjectiveContext] = useState<{
    companyTitle?: string;
    departmentTitle?: string;
    individualTitle: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [meetingPoint, setMeetingPoint] = useState<any>(null);
  const [isLoadingMeetingPoint, setIsLoadingMeetingPoint] = useState(false);
  const [isAutoSelected, setIsAutoSelected] = useState(false);
  const [isCheckingExistingTask, setIsCheckingExistingTask] = useState(false);

  // Fetch meeting point data when modal opens
  useEffect(() => {
    if (isOpen && meetingPointId) {
      fetchMeetingPoint();
    } else if (!isOpen) {
      // Reset states when modal closes
      setSelectedObjectiveId(null);
      setObjectiveContext(null);
      setMeetingPoint(null);
      setIsObjectiveDialogOpen(false);
      setIsAutoSelected(false);
    }
  }, [isOpen, meetingPointId]);

  // Check for existing task and auto-select objective when meeting point is loaded
  useEffect(() => {
    if (!isOpen || !meetingPoint?.discussion_point || !organizationId || selectedObjectiveId) {
      return;
    }

    const checkAndAutoSelect = async () => {
      setIsCheckingExistingTask(true);
      try {
        // Check if there's an existing task with the same discussion point
        const taskTitle = `${meetingPoint.discussion_point} - From Meeting Notes`;
        
        const { data: existingTask, error: taskError } = await supabase
          .from('daily_tasks')
          .select('objective_id')
          .eq('organization_id', organizationId)
          .eq('title', taskTitle)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (taskError || !existingTask?.objective_id) {
          return; // No existing task found
        }

        const existingObjectiveId = existingTask.objective_id;

        // Fetch objective details with hierarchy
        const { data: individualObjective, error: indivError } = await supabase
          .from('individual_objectives')
          .select(`
            id,
            title,
            department_objective_id,
            department_objectives (
              id,
              title,
              company_objective_id,
              company_objectives (
                id,
                title
              )
            )
          `)
          .eq('id', existingObjectiveId)
          .single();

        if (indivError || !individualObjective) {
          return; // Objective not found or error
        }

        const context: {
          companyTitle?: string;
          departmentTitle?: string;
          individualTitle: string;
        } = {
          individualTitle: individualObjective.title
        };

        // Get department title if exists
        if (individualObjective.department_objective_id && individualObjective.department_objectives) {
          const dept = Array.isArray(individualObjective.department_objectives) 
            ? individualObjective.department_objectives[0] 
            : individualObjective.department_objectives;
          
          if (dept) {
            context.departmentTitle = dept.title;

            // Get company title if exists
            if (dept.company_objective_id && dept.company_objectives) {
              const company = Array.isArray(dept.company_objectives)
                ? dept.company_objectives[0]
                : dept.company_objectives;
              
              if (company) {
                context.companyTitle = company.title;
              }
            }
          }
        }

        // Auto-select the objective
        setSelectedObjectiveId(existingObjectiveId);
        setObjectiveContext(context);
        setIsAutoSelected(true);
      } catch (error) {
        logger.error('Error checking existing task:', error);
        // Silent fail - user can still select manually
      } finally {
        setIsCheckingExistingTask(false);
      }
    };

    checkAndAutoSelect();
  }, [isOpen, meetingPoint?.discussion_point, organizationId, selectedObjectiveId]);

  const fetchMeetingPoint = async () => {
    setIsLoadingMeetingPoint(true);
    try {
      const { data, error } = await supabase
        .from('meeting_points')
        .select('discussion_point')
        .eq('id', meetingPointId)
        .single();

      if (error) throw error;
      setMeetingPoint(data);
    } catch (error) {
      logger.error('Error fetching meeting point:', error);
      toast({
        title: 'Error',
        description: 'Failed to load meeting point data',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingMeetingPoint(false);
    }
  };

  const handleObjectiveSelect = (objectiveId: string, context: {
    companyTitle?: string;
    departmentTitle?: string;
    individualTitle: string;
  }) => {
    setSelectedObjectiveId(objectiveId);
    setObjectiveContext(context);
    setIsAutoSelected(false); // User manually selected, so it's not auto-selected anymore
    setIsObjectiveDialogOpen(false);
  };

  const handleCreateTask = async () => {
    if (!organizationId || !selectedObjectiveId) {
      toast({
        title: 'Error',
        description: 'Please select an Individual Objective first',
        variant: 'destructive'
      });
      return;
    }

    if (!meetingPoint) {
      toast({
        title: 'Error',
        description: 'Meeting point data not loaded',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Task title format: {discussion_point} - From Meeting Notes
      const taskTitle = `${meetingPoint.discussion_point} - From Meeting Notes`;
      
      // Check if task with same title already exists
      const { data: existingTask, error: checkTaskError } = await supabase
        .from('daily_tasks')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('title', taskTitle)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (checkTaskError) {
        logger.error('Error checking existing task:', checkTaskError);
        throw checkTaskError;
      }

      let taskId: string;
      let isNewTask = false;

      if (existingTask?.id) {
        // Task exists - use existing task_id
        taskId = existingTask.id;

        // Check if step with same description already exists (prevent duplicate steps)
        const { data: existingStep, error: checkStepError } = await supabase
          .from('task_steps')
          .select('id')
          .eq('task_id', taskId)
          .eq('title', solution.solution_description)
          .maybeSingle();

        if (checkStepError) {
          logger.error('Error checking existing step:', checkStepError);
          throw checkStepError;
        }

        if (existingStep?.id) {
          // Step already exists - inform user and close
          toast({
            title: 'Info',
            description: 'This solution already exists as a step in the task',
            variant: 'default'
          });
          onClose();
          return;
        }
      } else {
        // Task doesn't exist - create new task
        const { data: newTask, error: taskError } = await supabase
          .from('daily_tasks')
          .insert({
            organization_id: organizationId,
            title: taskTitle,
            description: `Solution from meeting point: ${meetingPoint.discussion_point}`,
            priority: 'medium',
            status: 'pending',
            objective_id: selectedObjectiveId,
            created_by: user?.id || null
          })
          .select()
          .single();

        if (taskError) throw taskError;
        taskId = newTask.id;
        isNewTask = true;
      }

      // Get current max order for steps in this task to determine next order
      const { data: existingSteps, error: stepsQueryError } = await supabase
        .from('task_steps')
        .select('order')
        .eq('task_id', taskId)
        .order('order', { ascending: false })
        .limit(1);

      if (stepsQueryError) {
        logger.error('Error fetching existing steps:', stepsQueryError);
        throw stepsQueryError;
      }

      const nextOrder = existingSteps && existingSteps.length > 0 
        ? ((existingSteps as any)[0].order as number) + 1 
        : 1;

      // Create task step from solution (to existing or new task)
      const { error: stepError } = await supabase
        .from('task_steps')
        .insert({
          task_id: taskId,
          title: solution.solution_description,
          is_completed: false,
          order: nextOrder,
          created_by: user?.id || null
        });

      if (stepError) throw stepError;

      // Different toast messages based on whether task was new or existing
      toast({
        title: 'Success',
        description: isNewTask 
          ? 'Solution added as daily task successfully'
          : 'Solution added as step to existing task'
      });

      // Close modal
      onClose();
    } catch (error) {
      logger.error('Error adding solution as daily task:', error);
      toast({
        title: 'Error',
        description: 'Failed to add solution as daily task',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className={cn(
            'w-full max-w-none m-0 rounded-none translate-x-0 translate-y-0 flex flex-col p-0 gap-0 border-none bg-card shadow-xl focus:outline-none overflow-hidden',
            isMobile
              ? 'fixed left-0 right-0 top-0 modal-above-safe-area h-screen'
              : 'md:max-w-2xl md:max-h-[85vh] md:rounded-lg md:translate-x-[-50%] md:translate-y-[-50%] md:left-[50%] md:top-[50%] fixed inset-0 md:h-auto md:max-h-[90vh]'
          )}
          fullscreenAnimation={isMobile}
          hideCloseButton={isMobile}
        >
          <DialogHeader className={cn(
            'flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left',
            isMobile ? 'safe-area-top px-4 pt-4 pb-3' : 'md:px-6 md:pt-6 md:pb-4'
          )}>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              <span className="lowercase truncate">Add Solution as Daily Task</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-6 pt-4 pb-6 md:px-4 md:pb-4">
            {/* Solution Information Card */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-gray-600" />
                <h4 className="font-semibold text-gray-900 text-sm">Solution Information</h4>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {solution.solution_description}
              </p>
            </div>

            {/* Individual Objective Section */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" />
                Individual Objective <span className="text-red-500">*</span>
              </label>
              {isCheckingExistingTask ? (
                <div className="w-full border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsObjectiveDialogOpen(true)}
                    disabled={isSubmitting}
                    className="w-full justify-start border border-gray-200 rounded-lg hover:bg-gray-50 h-10"
                  >
                    {selectedObjectiveId && objectiveContext ? (
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Target className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <div className="flex flex-col min-w-0 flex-1 text-left">
                          <span className="text-sm truncate font-medium text-gray-900">
                            {objectiveContext.individualTitle}
                          </span>
                          {(objectiveContext.companyTitle || objectiveContext.departmentTitle) && (
                            <span className="text-xs text-gray-500 truncate">
                              {objectiveContext.companyTitle && objectiveContext.departmentTitle
                                ? `${objectiveContext.companyTitle} → ${objectiveContext.departmentTitle}`
                                : objectiveContext.companyTitle || objectiveContext.departmentTitle}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-gray-500 text-sm">Select Individual Objective</span>
                      </div>
                    )}
                  </Button>
                  {isAutoSelected && selectedObjectiveId && (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 text-xs">
                        <Info className="w-3 h-3 mr-1" />
                        Using objective from existing task
                      </Badge>
                    </div>
                  )}
                  {!selectedObjectiveId && !isCheckingExistingTask && (
                    <p className="text-xs text-red-500 mt-1">
                      ⚠️ Please select an Individual Objective first
                    </p>
                  )}
                  {selectedObjectiveId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsObjectiveDialogOpen(true)}
                      disabled={isSubmitting}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-700"
                    >
                      Change Objective
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Task Preview Section */}
            {selectedObjectiveId && meetingPoint && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <h4 className="font-semibold text-gray-900 text-sm">Task Preview</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Title:</span>
                    <p className="text-gray-900 mt-1">
                      {meetingPoint.discussion_point} - From Meeting Notes
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Description:</span>
                    <p className="text-gray-900 mt-1">
                      Solution from meeting point: {meetingPoint.discussion_point}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Step 1:</span>
                    <p className="text-gray-900 mt-1">
                      {solution.solution_description}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isSubmitting && (
              <div className="py-6 space-y-2">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-[80%] rounded" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            )}
          </div>

          {/* Footer - rules: px-4 pt-3 pb-3, no safe-area-padding-bottom, two-layer, size="sm", primary default, loading spinner */}
          <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleCreateTask}
                disabled={!selectedObjectiveId || isSubmitting || !meetingPoint}
                className="min-w-[120px] flex items-center justify-center gap-1.5 w-full sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4" />
                    Create Task
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Objective Hierarchy Dialog */}
      {organizationId && activeCycleIds.length > 0 && (
        <ObjectiveHierarchyDialog
          open={isObjectiveDialogOpen}
          onOpenChange={setIsObjectiveDialogOpen}
          onSelect={handleObjectiveSelect}
          selectedObjectiveId={selectedObjectiveId || undefined}
          organizationId={organizationId}
          cycleIds={activeCycleIds}
        />
      )}
    </>
  );
};

