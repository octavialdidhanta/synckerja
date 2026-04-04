import { useCallback } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { devLog } from '@/shared/lib/logger';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Sync pic_production_id to database based on assignment priority
 * Priority: task_steps_assigned > google_drive_link
 */
export const useSyncPicProduction = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  
  const syncPicProduction = useCallback(async (
    socialMediaPlanId: string,
    googleDriveLink: string | null,
    currentPicProductionId: string | null,
    currentPicProductionSource: string | null
  ) => {
    if (!organizationId) {
      devLog.error('⚠️ Cannot sync pic_production: Organization ID not found');
      return;
    }
    
    try {
      // Get latest assignment for this plan
      // IMPORTANT: Only sync from Content steps (is_concept_step = false), not Concept steps
      // PIC Production should only come from Content step assignments, not Concept step assignments
      const { data: assignmentData } = await supabase
        .from('task_steps_assigned')
        .select(`
          id,
          employee_id,
          assigned_at,
          task_steps!inner(
            id,
            social_media_plan_id,
            is_concept_step
          )
        `)
        .eq('task_steps.social_media_plan_id', socialMediaPlanId)
        .eq('task_steps.is_concept_step', false) // Only Content steps, not Concept steps
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const assignedEmployeeId = assignmentData?.employee_id || null;
      
      // Determine new pic_production_id and source
      let newPicProductionId: string | null = null;
      let newPicProductionSource: string | null = null;
      
      if (assignedEmployeeId) {
        // Priority: task_steps_assigned > google_drive_link
        newPicProductionId = assignedEmployeeId;
        newPicProductionSource = 'task_steps_assigned';
      } else if (googleDriveLink) {
        // Fallback to Google Drive Link if no assignment
        // If current pic_production_id exists and source is 'google_drive_link', keep it
        // Otherwise, we can't auto-assign without knowing who added the link
        if (currentPicProductionSource === 'google_drive_link' && currentPicProductionId) {
          newPicProductionId = currentPicProductionId;
          newPicProductionSource = 'google_drive_link';
        } else {
          // If no current pic_production_id from Google Drive Link, we can't auto-assign
          // This should be handled by the Google Drive Link change handler
          newPicProductionId = null;
          newPicProductionSource = null;
        }
      } else {
        // No assignment and no Google Drive Link
        newPicProductionId = null;
        newPicProductionSource = null;
      }
      
      // Update database only if changed
      if (newPicProductionId !== currentPicProductionId || newPicProductionSource !== currentPicProductionSource) {
        const { error } = await supabase
          .from('social_media_plans')
          .update({
            pic_production_id: newPicProductionId,
            pic_production_source: newPicProductionSource
          })
          .eq('id', socialMediaPlanId);
        
        if (error) {
          devLog.error('❌ Error syncing pic_production_id:', error);
          throw error;
        }
        
        devLog.debug('✅ Synced pic_production_id:', {
          planId: socialMediaPlanId,
          employeeId: newPicProductionId,
          source: newPicProductionSource
        });
      }
    } catch (error) {
      console.error('Error in syncPicProduction:', error);
      throw error;
    }
  }, [organizationId]);
  
  /**
   * Sync all existing social_media_plans that need pic_production_id update
   * This is used to sync existing data that was created before the sync logic was implemented
   */
  const syncAllExistingPlans = useCallback(async () => {
    if (!organizationId) {
      devLog.error('⚠️ Cannot sync existing plans: Organization ID not found');
      return;
    }
    
    try {
      devLog.debug('🔄 Starting sync for all existing plans...');
      
      // Get all social_media_plans for this organization
      // We need to check all plans, not just those with null values
      // because some plans might have assignments that override current pic_production_id
      const { data: allPlans, error: plansError } = await supabase
        .from('social_media_plans')
        .select('id, pic_production_id, pic_production_source, google_drive_link')
        .eq('organization_id', organizationId)
        .limit(1000); // Limit to prevent overwhelming the database
      
      if (plansError) {
        devLog.error('❌ Error fetching plans:', plansError);
        throw plansError;
      }
      
      if (!allPlans || allPlans.length === 0) {
        devLog.debug('✅ No plans to sync');
        return;
      }
      
      devLog.debug(`🔄 Found ${allPlans.length} plans to check`);
      
      // Get all plans that have task_steps linked
      const planIds = allPlans.map(p => p.id);
      
      // Get latest assignment for each plan in batch
      // Use a more efficient query: get all assignments for plans that have task_steps
      // IMPORTANT: Only sync from Content steps (is_concept_step = false), not Concept steps
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('task_steps_assigned')
        .select(`
          id,
          employee_id,
          assigned_at,
          task_steps!inner(
            id,
            social_media_plan_id,
            is_concept_step
          )
        `)
        .in('task_steps.social_media_plan_id', planIds)
        .eq('task_steps.is_concept_step', false) // Only Content steps, not Concept steps
        .order('assigned_at', { ascending: false });
      
      if (assignmentsError) {
        devLog.error('❌ Error fetching assignments:', assignmentsError);
        throw assignmentsError;
      }
      
      // Group assignments by plan_id and get latest for each
      const latestAssignments = new Map<string, { employee_id: string; assigned_at: string }>();
      (assignmentsData || []).forEach((assignment: any) => {
        const planId = assignment.task_steps?.social_media_plan_id;
        if (planId) {
          const existing = latestAssignments.get(planId);
          if (!existing || new Date(assignment.assigned_at) > new Date(existing.assigned_at)) {
            latestAssignments.set(planId, {
              employee_id: assignment.employee_id,
              assigned_at: assignment.assigned_at
            });
          }
        }
      });
      
      devLog.debug(`🔄 Found ${latestAssignments.size} plans with assignments`);
      
      // Prepare updates
      const updates: Array<{ id: string; pic_production_id: string | null; pic_production_source: string | null }> = [];
      
      allPlans.forEach(plan => {
        const latestAssignment = latestAssignments.get(plan.id);

        // RULE: Jangan auto-populate dari assignment via batch sync.
        // Auto-populate PIC Production hanya boleh terjadi dari flow TITLE (memanggil syncPicProduction eksplisit).
        // Jadi: Abaikan latestAssignment di sini, kecuali kita sedang menyamakan source 'google_drive_link'.

        // Jika ada Google Drive Link dan sudah ada pic_production_id, pastikan sumbernya 'google_drive_link'.
        if (plan.google_drive_link && plan.pic_production_id && plan.pic_production_source !== 'google_drive_link') {
          updates.push({
            id: plan.id,
            pic_production_id: plan.pic_production_id,
            pic_production_source: 'google_drive_link'
          });
          return;
        }

        // Jika tidak ada GDrive dan tidak ada assignment yang ingin kita proses di batch,
        // jangan sentuh nilai yang ada agar tidak menimpa hasil flow TITLE.
      });
      
      if (updates.length === 0) {
        devLog.debug('✅ No plans need update');
        return;
      }
      
      devLog.debug(`🔄 Updating ${updates.length} plans...`);
      
      // Batch update plans (update in chunks of 50 to avoid overwhelming the database)
      const chunkSize = 50;
      for (let i = 0; i < updates.length; i += chunkSize) {
        const chunk = updates.slice(i, i + chunkSize);
        
        // Use Promise.all for parallel updates within chunk
        const updatePromises = chunk.map(update => 
          supabase
            .from('social_media_plans')
            .update({
              pic_production_id: update.pic_production_id,
              pic_production_source: update.pic_production_source
            })
            .eq('id', update.id)
        );
        
        await Promise.all(updatePromises);
      }
      
      devLog.debug(`✅ Successfully synced ${updates.length} plans`);
      
      // Invalidate queries to refresh UI after sync
      if (organizationId && updates.length > 0) {
        queryClient.invalidateQueries({ 
          queryKey: ['social-media-plans', organizationId],
          refetchType: 'active' // Force refetch for active queries
        });
      }
    } catch (error) {
      console.error('Error in syncAllExistingPlans:', error);
      // Don't throw error, just log it - we don't want to break the UI
      devLog.error('❌ Error syncing existing plans:', error);
    }
  }, [organizationId, queryClient]);
  
  return { syncPicProduction, syncAllExistingPlans };
};

