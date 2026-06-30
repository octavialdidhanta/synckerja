import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { devLog } from '@/shared/lib/logger';
import { ContentPlan } from '../types/social-media';

interface UseApprovalTaskStepCreationProps {
  onStatusUpdate: (planId: string, status: string) => Promise<void>;
  onUpdate?: (planId: string, fields: { status?: string | null; approved?: boolean; completion_date?: string | null }) => Promise<void>;
  onRollback?: (planId: string, fields: { status?: string | null; approved?: boolean; completion_date?: string | null }) => Promise<void>;
}

/**
 * Custom hook untuk handle approval dengan task step creation
 * Menangani flow: status change ke "Approved" → pilih daily task → create task step → update status
 */
export const useApprovalTaskStepCreation = ({
  onStatusUpdate,
  onUpdate,
  onRollback
}: UseApprovalTaskStepCreationProps) => {
  const [isTaskSelectorOpen, setIsTaskSelectorOpen] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<{
    planId: string;
    plan: ContentPlan;
    oldStatus?: string | null;
    oldApproved?: boolean;
    oldCompletionDate?: string | null;
    completionDate?: string; // Completion date yang akan digunakan untuk completed_at di task step
  } | null>(null);
  const { data: currentEmployee } = useCurrentEmployee();
  const rollbackInProgressRef = useRef(false);

  // Format date to dd-mm-yyyy
  const formatDateDDMMYYYY = useCallback((dateString: string | null): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        devLog.warn('Invalid date for formatting', dateString);
        return '';
      }
      return format(date, 'dd-MM-yyyy');
    } catch (error) {
      devLog.error('Error formatting date', error);
      return '';
    }
  }, []);

  // created_by FK → auth.users.id (bukan employees.id). RLS insert sudah cek akses org via daily_tasks.
  const getUserId = useCallback(async (_organizationId: string): Promise<string | null> => {
    if (currentEmployee?.user_id) {
      return currentEmployee.user_id;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user?.id ?? null;
    } catch (error) {
      devLog.error('Error getting user ID', error);
      return null;
    }
  }, [currentEmployee?.user_id]);

  // Create task step dari plan
  const createTaskStep = useCallback(async (
    taskId: string,
    plan: ContentPlan,
    completionDate?: string // Completion date untuk completed_at di task step
  ): Promise<{ success: boolean; errorAlreadyShown?: boolean }> => {
    let userId: string | null = null;
    let stepTitle = '';
    let completedAt = '';
    
    try {
      // 1. Existing Concept step — idempotent (retry setelah insert sukses tapi onUpdate gagal)
      const { data: existingConceptSteps, error: existingConceptError } = await supabase
        .from('task_steps')
        .select('id, task_id')
        .eq('social_media_plan_id', plan.id)
        .eq('is_concept_step', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existingConceptError) {
        devLog.error('Error checking existing concept step:', existingConceptError);
      }

      const existingConceptStep = existingConceptSteps?.[0];
      let taskStepId: string | undefined;
      let skipInsert = false;

      completedAt =
        completionDate || plan.completion_date || new Date().toISOString();

      if (existingConceptStep) {
        if (existingConceptStep.task_id === taskId) {
          taskStepId = existingConceptStep.id;
          skipInsert = true;
        } else {
          const { error: moveError } = await supabase
            .from('task_steps')
            .update({ task_id: taskId })
            .eq('id', existingConceptStep.id);

          if (moveError) {
            devLog.error('Error moving concept step to selected daily task:', moveError);
            toast.error(
              'Concept step already exists on another daily task. Unapprove first or pick that task.',
            );
            return { success: false, errorAlreadyShown: true };
          }

          taskStepId = existingConceptStep.id;
          skipInsert = true;
        }
      }

      if (!skipInsert) {
      // 2. Get service and content type names (with fallback)
      let serviceName = plan.service?.name || '';
      let contentTypeName = plan.content_type?.name || '';
      
      // Fallback: Fetch names if not loaded
      if (!serviceName && plan.service_id) {
        const { data: serviceData } = await supabase
          .from('services')
          .select('name')
          .eq('id', plan.service_id)
          .maybeSingle();
        serviceName = serviceData?.name || plan.service_id.substring(0, 8);
      }
      
      if (!contentTypeName && plan.content_type_id) {
        const { data: contentTypeData } = await supabase
          .from('content_types')
          .select('name')
          .eq('id', plan.content_type_id)
          .maybeSingle();
        contentTypeName = contentTypeData?.name || plan.content_type_id.substring(0, 8);
      }

      const postDateFormatted = formatDateDDMMYYYY(plan.post_date);
      const planTitle = plan.title || '';

      // 3. Build title dengan validation
      // Format: "Concept [service_name] - [content_type_name] - (dd-mm-yyyy) [title]"
      stepTitle = `Concept ${serviceName} - ${contentTypeName} - (${postDateFormatted}) ${planTitle}`
        .trim()
        .replace(/\s+/g, ' '); // Clean multiple spaces

      // 4. Get user ID untuk created_by (harus merujuk ke users.id, bukan employees.id)
      userId = await getUserId(plan.organization_id);
      if (!userId) {
        toast.error('Cannot create task step: User not authenticated');
        return { success: false, errorAlreadyShown: true };
      }

      // 5. Get max order (with single query, efficient)
      const { data: orderRows } = await supabase
        .from('task_steps')
        .select('order')
        .eq('task_id', taskId)
        .order('order', { ascending: false })
        .limit(1);

      const nextOrder =
        orderRows && orderRows.length > 0 ? (orderRows[0].order || 0) + 1 : 1;

      // 6. Insert task step (atomic operation)
      // completed_at harus ambil dari completion_date di social_media_plans
      // Gunakan completionDate parameter (yang di-set saat toggle Approved)
      // Jika tidak ada, gunakan plan.completion_date atau timestamp saat ini sebagai fallback
      const { error: insertError } = await supabase.from('task_steps').insert({
        task_id: taskId,
        title: stepTitle,
        is_completed: true, // Task step auto-completed karena content sudah approved
        order: nextOrder,
        completed_at: completedAt, // Ambil dari completion_date di social_media_plans
        created_by: userId, // Harus merujuk ke users.id (bukan employees.id)
        social_media_plan_id: plan.id, // Tidak boleh NULL
        is_concept_step: true, // This is a Concept step
      });

      if (insertError) {
        // Race: step mungkin sudah dibuat oleh request paralel
        if (insertError.code === '23505' || insertError.message?.includes('duplicate')) {
          const { data: racedSteps } = await supabase
            .from('task_steps')
            .select('id, task_id')
            .eq('social_media_plan_id', plan.id)
            .eq('is_concept_step', true)
            .limit(1);

          if (racedSteps?.[0]) {
            taskStepId = racedSteps[0].id;
          } else {
            toast.error('Task step already exists (created by another process)');
            return { success: false, errorAlreadyShown: true };
          }
        } else if (
          insertError.code === '23503' ||
          insertError.message?.includes('foreign key constraint')
        ) {
          devLog.error('Foreign key constraint violation:', {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            userId,
            taskId,
            planId: plan.id,
          });

          if (insertError.message?.includes('created_by')) {
            toast.error('Cannot create task step: Invalid user ID. Please try logging out and back in.');
          } else if (insertError.message?.includes('task_id')) {
            toast.error('Cannot create task step: Invalid task ID. Please select a different task.');
          } else if (insertError.message?.includes('social_media_plan_id')) {
            toast.error('Cannot create task step: Invalid social media plan ID.');
          } else {
            toast.error(
              `Cannot create task step: ${insertError.message || 'Database constraint violation'}`,
            );
          }
          return { success: false, errorAlreadyShown: true };
        } else {
          devLog.error('Task step insert error:', {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            userId,
            taskId,
            planId: plan.id,
            stepTitle,
            completedAt,
            nextOrder,
          });

          throw insertError;
        }
      } else {
        const { data: insertedSteps } = await supabase
          .from('task_steps')
          .select('id')
          .eq('social_media_plan_id', plan.id)
          .eq('is_concept_step', true)
          .eq('task_id', taskId)
          .order('created_at', { ascending: false })
          .limit(1);

        taskStepId = insertedSteps?.[0]?.id;
      }
      } // end if (!skipInsert)

      // 6b. Auto create assignment & due date jika PIC tersedia
      // Mengikuti pola di TitleDialog.tsx untuk menjaga konsistensi
      if (taskStepId && plan.pic_id) {
        // Cegah duplikasi assignment untuk step ini
        const { data: existingAssignment } = await supabase
          .from('task_steps_assigned')
          .select('id')
          .eq('task_step_id', taskStepId)
          .maybeSingle();

        if (!existingAssignment) {
          // Employee yang di-assign = PIC dari social_media_plans
          const assignedEmployeeId = plan.pic_id;

          // assigned_by diambil dari kolom PIC (sesuai requirement)
          const assignedById = plan.pic_id || currentEmployee?.id || assignedEmployeeId;

          // Waktu assign disamakan dengan completedAt untuk konsistensi
          const assignedAt = completedAt;

          const {
            data: assignmentRecord,
            error: assignError
          } = await supabase
            .from('task_steps_assigned')
            .insert({
              organization_id: plan.organization_id,
              task_step_id: taskStepId,
              employee_id: assignedEmployeeId,
              assigned_by: assignedById,
              assigned_at: assignedAt
            })
            .select('id')
            .single();

          if (assignError) {
            devLog.error('Error auto-assigning task step from approval:', assignError);
            // Jangan batalkan approval; task step sudah berhasil dibuat
          } else if (assignmentRecord?.id && plan.post_date) {
            // Simpan due_date dari post_date ke task_steps_assigned_duedate
            try {
              const postDate = new Date(plan.post_date);
              if (!isNaN(postDate.getTime())) {
                // Set ke akhir hari (23:59:59) sebagai deadline
                postDate.setHours(23, 59, 59, 999);
                const dueDateISO = postDate.toISOString();

                const { error: dueDateError } = await supabase
                  .from('task_steps_assigned_duedate')
                  .insert({
                    organization_id: plan.organization_id,
                    task_steps_assigned_id: assignmentRecord.id,
                    due_date: dueDateISO,
                    created_at: new Date().toISOString()
                  });

                if (dueDateError) {
                  devLog.error('Error saving auto due date from post_date:', dueDateError);
                }
              } else {
                devLog.warn('Invalid post_date format for due date:', plan.post_date);
              }
            } catch (dateError) {
              devLog.error('Error processing post_date for due date:', dateError);
            }

            // IMPORTANT: Jangan auto-populate PIC Production dari flow approval
            // Hanya TITLE flow yang boleh auto-populate (sesuai requirement)
            // Revert nilai pic_production_id & source ke nilai existing pada plan (non-blocking)
            try {
              await supabase
                .from('social_media_plans')
                .update({
                  pic_production_id: plan.pic_production_id || null,
                  pic_production_source: plan.pic_production_source || null
                })
                .eq('id', plan.id);
            } catch (revertError) {
              devLog.warn('Non-blocking: failed to revert pic_production after approval assignment:', revertError);
            }
          }
        }
      }

      // 7. Task step created successfully
      return { success: true };
    } catch (error: any) {
      devLog.error('Error creating task step:', {
        error,
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        taskId,
        planId: plan?.id,
        userId,
        stepTitle,
      });

      // Show more specific error message
      let errorMessage = 'Failed to create task step';
      if (error?.message) {
        if (error.message.includes('foreign key constraint')) {
          errorMessage = 'Cannot create task step: Invalid reference. Please try again.';
        } else if (error.message.includes('permission') || error.message.includes('row-level security')) {
          errorMessage = 'Cannot create task step: Permission denied. Please check your access.';
        } else {
          errorMessage = `Failed to create task step: ${error.message}`;
        }
      }

      toast.error(errorMessage);
      return { success: false, errorAlreadyShown: true };
    }
  }, [formatDateDDMMYYYY, getUserId, currentEmployee?.id]);

  // Check if should show modal untuk approval
  const shouldShowModal = useCallback((plan: ContentPlan, oldStatus: string | null): boolean => {
    // Check jika status berubah dari "Need Review" atau NULL/empty ke "Approved"
    const isStatusChangingToApproved = 
      oldStatus === 'Need Review' || 
      oldStatus === null || 
      oldStatus === '' || 
      oldStatus === 'none';
    
    // Conditions: status changing from "Need Review" (atau NULL) to "Approved" 
    // AND all required fields are NOT NULL
    return (
      isStatusChangingToApproved &&
      plan.post_date != null &&
      plan.content_type_id != null &&
      plan.service_id != null &&
      plan.title != null
    );
  }, []);

  // Handle task selected dari modal
  const handleTaskSelected = useCallback(async (
    taskId: string,
    taskTitle: string,
    employeeId?: string,
    assignedAt?: string
  ) => {
    if (!pendingApproval) return;

    const { planId, plan, completionDate } = pendingApproval;

    // Refetch plan so service/content_type/title are fresh (BriefDialog may have updated brief only in UI)
    let planForStep = plan;
    const { data: freshPlan } = await supabase
      .from('social_media_plans')
      .select(
        `
        *,
        service:services(id, name),
        content_type:content_types(id, name)
      `,
      )
      .eq('id', planId)
      .maybeSingle();

    if (freshPlan) {
      planForStep = {
        ...plan,
        ...freshPlan,
        service: freshPlan.service ?? plan.service,
        content_type: freshPlan.content_type ?? plan.content_type,
      } as ContentPlan;
    }

    const { success, errorAlreadyShown } = await createTaskStep(taskId, planForStep, completionDate);

    if (success) {
      // Update all fields AFTER task step created successfully
      // Gunakan completionDate dari pendingApproval (yang sama dengan completed_at di task step)
      const completionDateToUse = completionDate || new Date().toISOString();
      
      // Update status, approved, dan completion_date
      // completion_date harus sama dengan completed_at di task step (yang sudah dibuat)
      if (onUpdate) {
        await onUpdate(planId, {
          status: 'Approved',
          approved: true,
          completion_date: completionDateToUse // Gunakan timestamp yang sama dengan completed_at di task step
        });
      } else {
        // Fallback: hanya update status
        await onStatusUpdate(planId, 'Approved');
      }
      
      // Close modal
      setIsTaskSelectorOpen(false);
      setPendingApproval(null);
      
      toast.success('Content plan approved and task step created successfully');
    } else if (!errorAlreadyShown) {
      // Task step creation failed - status tetap tidak berubah
      // Modal tetap terbuka agar user bisa retry
      toast.error('Failed to create task step. Please try again or cancel.');
    }
  }, [pendingApproval, createTaskStep, onStatusUpdate, onUpdate]);

  // Handle modal close (cancellation)
  const handleModalClose = useCallback(async () => {
    if (rollbackInProgressRef.current) return; // Prevent multiple rollbacks
    
    // Only rollback if pendingApproval exists (modal was cancelled, not completed)
    if (pendingApproval) {
      rollbackInProgressRef.current = true;
      
      const { planId, plan, oldApproved, oldCompletionDate } = pendingApproval;
      
      // Rollback semua field yang sudah diupdate: status, approved, completion_date
      if (onRollback) {
        const { oldStatus } = pendingApproval;
        await onRollback(planId, {
          status: oldStatus !== undefined ? oldStatus : (plan.status || null), // Rollback ke status lama
          approved: oldApproved !== undefined ? oldApproved : false, // Rollback approved
          completion_date: oldCompletionDate !== undefined ? oldCompletionDate : null // Rollback completion_date
        });
      }
      
      // Clear state
      setIsTaskSelectorOpen(false);
      setPendingApproval(null);
      
      // Only show cancellation toast if user actually cancelled (not if task step was successfully created)
      toast.info('Approval cancelled');
      
      // Reset rollback flag setelah delay
      setTimeout(() => {
        rollbackInProgressRef.current = false;
      }, 500);
    } else {
      // No pending approval - just close modal (task step already created successfully)
      setIsTaskSelectorOpen(false);
    }
  }, [pendingApproval, onRollback]);

  // Request approval (dipanggil dari handleFieldChange atau handleStatusChange)
  const requestApproval = useCallback((plan: ContentPlan, oldStatus: string | null, oldApproved?: boolean, oldCompletionDate?: string | null): boolean => {
    // Check conditions
    if (shouldShowModal(plan, oldStatus)) {
      // Generate completion_date timestamp saat ini (yang akan digunakan untuk completed_at di task step)
      // Karena content sudah approved, completion_date = timestamp sekarang
      const completionDateTimestamp = new Date().toISOString();
      
      // Store pending state termasuk old status, approved, completion_date untuk rollback
      // Dan completionDate untuk digunakan di completed_at task step
      setPendingApproval({ 
        planId: plan.id, 
        plan,
        oldStatus: oldStatus !== null && oldStatus !== undefined ? oldStatus : (plan.status || null),
        oldApproved: oldApproved !== undefined ? oldApproved : (plan.approved || false),
        oldCompletionDate: oldCompletionDate !== undefined ? oldCompletionDate : (plan.completion_date || null),
        completionDate: completionDateTimestamp // Timestamp untuk completed_at di task step
      });
      
      // Open modal - status akan diupdate setelah task dipilih
      setIsTaskSelectorOpen(true);
      
      // Return true untuk prevent default update
      return true;
    }
    
    // Return false untuk allow normal update
    return false;
  }, [shouldShowModal]);

  // Delete task_steps when status changes from "Approved" to "Need Review"
  // Only delete "Concept" steps, not "Content" steps
  const deleteTaskStepForPlan = useCallback(async (planId: string): Promise<boolean> => {
    try {
      // Check if Concept task_steps exists for this social_media_plan_id
      // Only delete steps with is_concept_step = true
      const { data: existingSteps } = await supabase
        .from('task_steps')
        .select('id, task_id')
        .eq('social_media_plan_id', planId)
        .eq('is_concept_step', true);

      if (!existingSteps || existingSteps.length === 0) {
        // No Concept step exists - nothing to delete
        return true;
      }

      // Delete only Concept steps (is_concept_step = true)
      const conceptStepIds = existingSteps.map(step => step.id);

      if (conceptStepIds.length > 0) {
        // Hapus assignment dulu agar trigger unassign tidak insert push_queue dengan
        // task_step_id saat parent step ikut CASCADE-delete (FK violation).
        const { error: assignDeleteError } = await supabase
          .from('task_steps_assigned')
          .delete()
          .in('task_step_id', conceptStepIds);

        if (assignDeleteError) {
          devLog.error('Error deleting Concept task step assignments:', {
            error: assignDeleteError,
            code: assignDeleteError.code,
            message: assignDeleteError.message,
            planId,
            conceptStepIds,
          });
          toast.error(
            'Failed to delete Concept task step: ' + (assignDeleteError.message || 'Unknown error'),
          );
          return false;
        }

        const { error: deleteError } = await supabase
          .from('task_steps')
          .delete()
          .in('id', conceptStepIds);

        if (deleteError) {
          devLog.error('Error deleting Concept task steps:', {
            error: deleteError,
            code: deleteError.code,
            message: deleteError.message,
            details: deleteError.details,
            hint: deleteError.hint,
            planId,
            deletedStepIds: conceptStepIds
          });
          toast.error('Failed to delete Concept task step: ' + (deleteError.message || 'Unknown error'));
          return false;
        }
      }

      // Successfully deleted Concept steps
      return true;
    } catch (error: any) {
      devLog.error('Error deleting Concept task steps:', {
        error,
        message: error?.message,
        code: error?.code,
        planId
      });
      toast.error('Failed to delete Concept task step: ' + (error?.message || 'Unknown error'));
      return false;
    }
  }, []);

  // Handle status change from "Approved" to "Need Review" (un-approval)
  const handleUnapproval = useCallback(async (planId: string): Promise<void> => {
    // Delete task_steps when un-approving
    await deleteTaskStepForPlan(planId);
  }, [deleteTaskStepForPlan]);

  return {
    requestApproval,
    isTaskSelectorOpen,
    pendingApproval,
    handleTaskSelected,
    handleModalClose,
    deleteTaskStepForPlan,
    handleUnapproval
  };
};

