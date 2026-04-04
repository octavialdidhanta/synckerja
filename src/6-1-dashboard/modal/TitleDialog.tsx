import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { Plus, Loader2, Lock } from 'lucide-react';
import { format } from 'date-fns';
import DailyTaskSelectorDialog from './DailyTaskSelectorDialog';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { devLog } from '@/shared/lib/logger';
import { useSyncPicProduction } from '../hook/useSyncPicProduction';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { setTitleModalOpenPlanId } from '../hook/briefModalOpenRef';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

interface TitleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string | null;
  onSave: (title: string) => void;
  socialMediaPlanId?: string;
  approved?: boolean; // Pass approved status directly to avoid delay
}

const TitleDialog: React.FC<TitleDialogProps> = ({
  isOpen,
  onClose,
  title,
  onSave,
  socialMediaPlanId,
  approved: approvedProp
}) => {
  const [titleText, setTitleText] = useState('');
  const [isDailyTaskDialogOpen, setIsDailyTaskDialogOpen] = useState(false);
  const { organizationId } = useCurrentOrg();
  const { syncPicProduction } = useSyncPicProduction();
  const { language } = useAppTranslation();

  useEffect(() => {
    if (isOpen && socialMediaPlanId) {
      setTitleModalOpenPlanId(socialMediaPlanId);
      return () => setTitleModalOpenPlanId(null);
    }
    setTitleModalOpenPlanId(null);
    return undefined;
  }, [isOpen, socialMediaPlanId]);

  // ===== OPTIMIZATION 1: Cache planData with React Query =====
  // Always fetch planData for service/content_type/post_date (needed for formattedTitle)
  // approved status can come from prop (no delay) or from planData (backward compatibility)
  const { data: planData, isLoading: isLoadingPlanData } = useQuery({
    queryKey: ['social-media-plan', socialMediaPlanId],
    queryFn: async () => {
      if (!socialMediaPlanId) return null;
      
      const { data, error } = await supabase
        .from('social_media_plans')
        .select(`
          post_date,
          approved,
          service:services(name),
          content_type:content_types(name)
        `)
        .eq('id', socialMediaPlanId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!socialMediaPlanId && isOpen,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false, // Disabled to prevent reload when switching windows
    refetchOnMount: false, // Don't refetch on mount if data is fresh
    // Disabled polling - rely on realtime updates or parent prop updates
    // If approved prop is provided, parent will handle real-time updates for approved status
    refetchInterval: false, // Disabled - no polling needed, realtime handles updates
  });

  // Use prop if available (no delay), otherwise use fetched data
  const isPlanApproved = approvedProp !== undefined ? approvedProp === true : (planData?.approved === true);
  const showApprovalRestriction = approvedProp !== undefined 
    ? !approvedProp 
    : (!!planData && !isPlanApproved);

  // Bilingual tooltip message - short and concise
  const approvedTooltipMessage = React.useMemo(() => {
    if (showApprovalRestriction) {
      return language === 'id'
        ? 'Konten belum di-approve'
        : 'Content not approved';
    }
    return undefined;
  }, [showApprovalRestriction, language]);

  // ===== OPTIMIZATION 2: Memoize formattedTitle calculation =====
  const formattedTitle = useMemo(() => {
    if (!planData || !titleText.trim()) return null;

    const serviceName = planData.service?.name || '';
    const contentTypeName = planData.content_type?.name || '';
    const postDate = planData.post_date 
      ? format(new Date(planData.post_date), 'yyyy-MM-dd')
      : '';
    
    let formatted = `Content ${serviceName} - ${contentTypeName}`.trim();
    if (postDate) {
      formatted += ` - (${postDate})`;
    }
    formatted += ` ${titleText.trim()}`;
    return formatted.trim();
  }, [planData, titleText]);

  // Memoize old format title for backward compatibility
  const oldFormatTitle = useMemo(() => {
    if (!planData || !titleText.trim()) return null;

    const serviceName = planData.service?.name || '';
    const postDate = planData.post_date 
      ? format(new Date(planData.post_date), 'yyyy-MM-dd')
      : '';
    
    if (serviceName && postDate) {
      return `Content ${serviceName} (${postDate}) ${titleText.trim()}`.trim();
    }
    return null;
  }, [planData, titleText]);

  // ===== OPTIMIZATION 3: Use React Query for duplicate check =====
  const { data: duplicateCheck, isLoading: isCheckingDuplicate, isFetching: isFetchingDuplicate } = useQuery({
    queryKey: ['task-step-duplicate-check', formattedTitle, oldFormatTitle, organizationId],
    queryFn: async () => {
      // Check if we have at least one format to check
      if (!organizationId || (!formattedTitle && !oldFormatTitle)) return null;

      // Query to check both formats
      // Use .or() with proper format: "column.eq.value,column.eq.value2"
      let query = supabase
        .from('task_steps')
        .select(`
          id,
          created_by,
          created_at,
          task_id,
          title,
          daily_tasks!inner(
            id,
            organization_id
          ),
          task_steps_assigned!left(
            employee:employees!employee_id(
              id,
              full_name
            )
          )
        `)
        .eq('daily_tasks.organization_id', organizationId);

      // Build OR condition for both formats
      // Supabase .or() syntax: "column.eq.value,column.eq.value2"
      // For string values, we can use .in() for multiple values which is simpler
      if (formattedTitle && oldFormatTitle) {
        // Both formats exist - use .in() for multiple title checks
        query = query.in('title', [formattedTitle, oldFormatTitle]);
      } else if (oldFormatTitle) {
        // Only old format exists
        query = query.eq('title', oldFormatTitle);
      } else if (formattedTitle) {
        // Only new format exists
        query = query.eq('title', formattedTitle);
      } else {
        return null;
      }

      devLog.debug('🔍 Checking duplicate with:', { formattedTitle, oldFormatTitle, organizationId });
      const { data: existingSteps, error } = await query;

      if (error) {
        devLog.error('❌ Error checking duplicate:', error);
        return null;
      }

      devLog.debug('📊 Duplicate check result:', { found: existingSteps?.length || 0, steps: existingSteps });

      // If no existing steps found, return null (no duplicate)
      if (!existingSteps || existingSteps.length === 0) {
        return null;
      }

      // Filter steps that actually match the title (exact match)
      // Because we used .or() with multiple formats, we need to verify exact match
      const matchingSteps = existingSteps.filter(step => {
        const stepTitle = step.title?.trim() || '';
        // Check against both formats if they exist
        const matchesNewFormat = formattedTitle && stepTitle === formattedTitle;
        const matchesOldFormat = oldFormatTitle && stepTitle === oldFormatTitle;
        return matchesNewFormat || matchesOldFormat;
      });

      if (matchingSteps.length === 0) {
        return null;
      }

      // Get the most recent existing step (sort by created_at)
      const existingStep = matchingSteps.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      // Get employee name from assignment or creator
      let employeeName: string | null = null;

      // Check assignment first
      if (existingStep.task_steps_assigned && existingStep.task_steps_assigned.length > 0) {
        const assignment = existingStep.task_steps_assigned[0];
        if (assignment.employee) {
          employeeName = assignment.employee.full_name;
        }
      }

      // Fallback to creator if no assignment
      if (!employeeName && existingStep.created_by) {
        const { data: creatorEmployee } = await supabase
          .from('employees')
          .select('full_name')
          .eq('user_id', existingStep.created_by)
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (creatorEmployee) {
          employeeName = creatorEmployee.full_name;
        }
      }

      return {
        exists: true,
        employeeName: employeeName || 'Unknown Employee'
      };
    },
    enabled: !!(formattedTitle || oldFormatTitle) && !!organizationId && isOpen && titleText.trim().length > 0 && !!planData,
    staleTime: 30 * 1000, // 30 seconds cache
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // FIXED: Reset state when dialog opens/closes or when socialMediaPlanId changes
  useEffect(() => {
    if (isOpen) {
      setTitleText(title || '');
    } else {
      // Clear all state when closing
      setTitleText('');
    }
  }, [isOpen, title]);

  const handleSave = () => {
    onSave(titleText.trim());
    onClose();
  };

  const handleAddAsDailyTask = async (
    dailyTaskId: string, 
    taskTitle: string, 
    employeeId?: string, 
    assignedAt?: string
  ) => {
    if (!titleText.trim()) {
      toast.error('Please enter a content title first');
      return;
    }

    if (!organizationId) {
      toast.error('Organization not found');
      return;
    }

    if (!socialMediaPlanId) {
      toast.error('Social media plan ID not found');
      return;
    }

    // Final check before insert - use cached duplicateCheck from React Query
    if (duplicateCheck?.exists) {
      toast.error(`Content title ini sudah ditambahkan sebagai daily task step oleh ${duplicateCheck.employeeName}`);
      return;
    }

    if (!formattedTitle) {
      toast.error('Failed to format title');
      return;
    }

    if (!isPlanApproved) {
      toast.error(
        language === 'id'
          ? 'Konten belum di-approve'
          : 'Content not approved'
      );
      return;
    }

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('User not authenticated');
        return;
      }

      // Get current employee (active profile) - for regular employees or as fallback
      const { data: currentEmployee, error: employeeError } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (employeeError || !currentEmployee) {
        toast.error('Failed to get current employee');
        return;
      }

      // Determine employee ID and assigned_at
      // If employeeId is provided (Owner/Admin assignment), use it
      // Otherwise, use currentEmployee.id (regular employee self-assignment)
      const targetEmployeeId = employeeId || currentEmployee.id;
      const targetAssignedAt = assignedAt || new Date().toISOString();
      
      // Validate assigned_at <= due_date (from post_date)
      if (planData?.post_date) {
        const assignedDate = new Date(targetAssignedAt);
        const dueDate = new Date(planData.post_date);
        dueDate.setHours(23, 59, 59, 999); // Set to end of day for due date
        
        if (assignedDate > dueDate) {
          toast.error('Assignment date cannot be after due date');
          return;
        }
      }
      
      // Validate employee status if employeeId is provided (Owner/Admin assignment)
      if (employeeId) {
        const { data: targetEmployee, error: targetEmployeeError } = await supabase
          .from('employees')
          .select('id, status')
          .eq('id', employeeId)
          .eq('organization_id', organizationId)
          .maybeSingle();
        
        if (targetEmployeeError || !targetEmployee) {
          toast.error('Selected employee not found');
          return;
        }
        
        if (targetEmployee.status !== 'active' && targetEmployee.status !== null) {
          toast.error('Selected employee is not active');
          return;
        }
      }

      // Get the maximum order for steps in this task
      const { data: existingSteps } = await supabase
        .from('task_steps')
        .select('order')
        .eq('task_id', dailyTaskId)
        .order('order', { ascending: false })
        .limit(1);

      const nextOrder = existingSteps && existingSteps.length > 0 
        ? (existingSteps[0].order || 0) + 1 
        : 1;

      // Final check before insert (race condition prevention)
      // Check both new and old formats
      let finalCheckQuery = supabase
        .from('task_steps')
        .select(`
          id,
          title,
          daily_tasks!inner(organization_id)
        `)
        .eq('daily_tasks.organization_id', organizationId);

      // Use .in() for multiple title checks (same as duplicate check)
      if (formattedTitle && oldFormatTitle) {
        finalCheckQuery = finalCheckQuery.in('title', [formattedTitle, oldFormatTitle]);
      } else if (oldFormatTitle) {
        finalCheckQuery = finalCheckQuery.eq('title', oldFormatTitle);
      } else if (formattedTitle) {
        finalCheckQuery = finalCheckQuery.eq('title', formattedTitle);
      }

      const { data: finalCheckData } = await finalCheckQuery;
      
      // Filter to exact match
      const finalCheck = finalCheckData?.find((step: any) => 
        step.title?.trim() === formattedTitle || (oldFormatTitle && step.title?.trim() === oldFormatTitle)
      );

      if (finalCheck) {
        // Get employee name for error message
        const { data: assignmentData } = await supabase
          .from('task_steps_assigned')
          .select(`
            employee:employees!employee_id(full_name)
          `)
          .eq('task_step_id', finalCheck.id)
          .maybeSingle();

        const employeeName = assignmentData?.employee?.full_name || 'employee lain';
        toast.error(`Content title ini sudah ditambahkan sebagai daily task step oleh ${employeeName}`);
        return;
      }

      // Insert into task_steps table with formatted title
      const { data: taskStep, error: stepError } = await supabase
        .from('task_steps')
        .insert({
          task_id: dailyTaskId,
          title: formattedTitle,
          is_completed: false,
          order: nextOrder,
          status: 'pending',
          priority: 'medium',
          created_by: user.id,
          social_media_plan_id: socialMediaPlanId || null,
          is_concept_step: false // This is a Content step
        })
        .select()
        .single();

      if (stepError) {
        devLog.error('Error creating task step:', stepError);
        toast.error('Failed to create task step');
        return;
      }

      // Get assigned_by employee ID (Owner/Admin who assigns, or currentEmployee for self-assignment)
      // If employeeId is provided, the current user (Owner/Admin) is the one who assigns
      // Otherwise, it's a self-assignment, so assigned_by = employee_id
      const assignedByEmployeeId = employeeId ? currentEmployee.id : currentEmployee.id;
      
      // Insert into task_steps_assigned table
      const { data: assignmentRecord, error: assignError } = await supabase
        .from('task_steps_assigned')
        .insert({
          organization_id: organizationId,
          task_step_id: taskStep.id,
          employee_id: targetEmployeeId,
          assigned_by: assignedByEmployeeId,
          assigned_at: targetAssignedAt
        })
        .select()
        .single();

      if (assignError) {
        devLog.error('Error assigning task step:', assignError);
        toast.error('Failed to assign task step');
        return;
      }

      // Insert deadline from post_date into task_steps_assigned_duedate table
      // IMPORTANT: Deadline is taken from Post Date column (post_date) in social_media_plans
      if (planData?.post_date && assignmentRecord?.id) {
        try {
          const postDate = new Date(planData.post_date);
          // Validate date
          if (isNaN(postDate.getTime())) {
            devLog.warn('⚠️ Invalid post_date format:', planData.post_date);
          } else {
            // Set time to end of day (23:59:59) for deadline
            postDate.setHours(23, 59, 59, 999);
            const dueDateISO = postDate.toISOString();

            const { error: dueDateError } = await supabase
              .from('task_steps_assigned_duedate')
              .insert({
                organization_id: organizationId,
                task_steps_assigned_id: assignmentRecord.id,
                due_date: dueDateISO,
                created_at: new Date().toISOString()
              });

            if (dueDateError) {
              devLog.error('Error saving deadline:', dueDateError);
              // Don't fail the whole operation if due date save fails
              devLog.warn('⚠️ Deadline could not be saved, but step assignment was successful');
            } else {
              devLog.debug('✅ Deadline saved from post_date:', planData.post_date, '→', dueDateISO);
            }
          }
        } catch (dateError) {
          devLog.error('Error processing post_date:', dateError);
          // Don't fail the whole operation if date processing fails
          devLog.warn('⚠️ Could not process post_date, but step assignment was successful');
        }
      } else if (assignmentRecord?.id) {
        // If post_date is not available, log warning but don't fail
        devLog.warn('⚠️ Post date not available, deadline not set for this step');
      }

      // Sync pic_production_id to social_media_plans after assignment is created
      if (assignmentRecord?.id && socialMediaPlanId) {
        try {
          // Get current plan data
          const { data: planData } = await supabase
            .from('social_media_plans')
            .select('pic_production_id, pic_production_source, google_drive_link')
            .eq('id', socialMediaPlanId)
            .maybeSingle();
          
          if (planData) {
            // Sync pic_production_id (priority: assignment > Google Drive Link)
            await syncPicProduction(
              socialMediaPlanId,
              planData.google_drive_link,
              planData.pic_production_id,
              planData.pic_production_source
            );
          }
        } catch (error) {
          devLog.error('Error syncing pic_production_id:', error);
          // Don't fail the whole operation if sync fails
        }
      }

      toast.success('Content title added as daily task step successfully');
      setIsDailyTaskDialogOpen(false);
    } catch (error) {
      devLog.error('Error adding as daily task:', error);
      toast.error('Failed to add as daily task');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto seamless-scroll">
        <DialogHeader>
          <DialogTitle>Content Title</DialogTitle>
          <DialogDescription className="sr-only">Edit content title and manage comments</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Textarea
              value={titleText}
              onChange={(e) => setTitleText(e.target.value)}
              placeholder="Enter content title here..."
              className="min-h-[100px] resize-none"
            />
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button
                      variant="outline"
                      onClick={() => setIsDailyTaskDialogOpen(true)}
                      className="flex items-center gap-2"
                      disabled={
                        showApprovalRestriction ||
                        isLoadingPlanData ||
                        isCheckingDuplicate || 
                        isFetchingDuplicate || 
                        !!duplicateCheck?.exists || 
                        !titleText.trim() ||
                        !formattedTitle ||
                        !planData
                      }
                    >
                      {isCheckingDuplicate || isFetchingDuplicate ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Checking...
                        </>
                      ) : duplicateCheck?.exists ? (
                        `Already taken by ${duplicateCheck.employeeName}`
                      ) : showApprovalRestriction ? (
                        <>
                          <Lock className="h-4 w-4" />
                          Add as Daily Task
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          Add as Daily Task
                        </>
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                {showApprovalRestriction && approvedTooltipMessage && (
                  <TooltipContent>
                    <p>{approvedTooltipMessage}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      <DailyTaskSelectorDialog
        isOpen={isDailyTaskDialogOpen}
        onClose={() => setIsDailyTaskDialogOpen(false)}
        onSelect={handleAddAsDailyTask}
        dueDate={planData?.post_date || null}
        assignDisabledReason={approvedTooltipMessage}
        serviceName={planData?.service?.name || ''}
      />
    </Dialog>
  );
};

export default TitleDialog;
