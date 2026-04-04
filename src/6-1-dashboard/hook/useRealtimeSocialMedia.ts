import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/shared/lib/supabaseClient';
import { devLog } from '@/shared/lib/logger';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useSyncPicProduction } from './useSyncPicProduction';
import { shouldDeferSocialMediaPlansRefetch } from './briefModalOpenRef';

export const useRealtimeSocialMedia = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const channelRef = useRef<any>(null);
  const { syncPicProduction } = useSyncPicProduction();

  useEffect(() => {
    if (!organizationId) return;

    // Prevent duplicate subscriptions
    if (channelRef.current) {
      return;
    }

    // Enhanced realtime channel with immediate updates for ALL social media data
    const channel = supabase
      .channel(`social-media-enhanced-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_media_plans',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          // Refetch so STATUS/APPROVED (Concept + Production) stay in sync when changed from
          // modal Preview, /review/ page, or another tab/device.
          // Skip full-table refetch while Brief / Preview (Drive) / Title modal is open.
          if (shouldDeferSocialMediaPlansRefetch()) return;
          if (organizationId) {
            queryClient.refetchQueries({
              queryKey: ['social-media-plans', organizationId],
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_media_links',
          filter: `social_media_plan_id=in.(select id from social_media_plans where organization_id='${organizationId}')`
        },
        (payload) => {
          devLog.debug('Social media links changed:', payload.eventType);
          
          // Smart cache update - invalidate social media plans and all-social-media-links
          queryClient.invalidateQueries({ 
            queryKey: ['social-media-plans', organizationId],
            refetchType: 'none'
          });
          // Invalidate all-social-media-links to refresh ContentPostTab immediately
          queryClient.invalidateQueries({ 
            queryKey: ['all-social-media-links'],
            refetchType: 'active' // Force refetch for active queries
          });
          // Invalidate batch-social-media-links for calendar view
          queryClient.invalidateQueries({ 
            queryKey: ['batch-social-media-links'],
            refetchType: 'active' // Force refetch for active calendar queries
          });
          
          devLog.debug('Links cache invalidated');
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'approval_access_configurations',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          devLog.debug('Approval configurations changed:', payload.eventType);
          
          // Invalidate approval configurations and related data
          queryClient.invalidateQueries({ 
            queryKey: ['approval-access-configurations', organizationId],
            refetchType: 'none'
          });
          queryClient.invalidateQueries({ 
            queryKey: ['social-media-plans', organizationId],
            refetchType: 'none'
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employees'
        },
        (payload) => {
          devLog.debug('Employees changed:', payload.eventType);
          
          // Invalidate employee data and related social media data
          queryClient.invalidateQueries({ 
            queryKey: ['employees'],
            refetchType: 'none'
          });
          queryClient.invalidateQueries({ 
            queryKey: ['social-media-plans', organizationId],
            refetchType: 'none'
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content_pillars',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          devLog.debug('Content pillars update:', payload.eventType);
          
          // Invalidate master data and pillar data
          queryClient.invalidateQueries({ 
            queryKey: ['social-media-master', organizationId],
            refetchType: 'none'
          });
          queryClient.invalidateQueries({ 
            queryKey: ['contentPillarData', organizationId],
            refetchType: 'none'
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_points',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          devLog.debug('Meeting points update:', payload.eventType);
          
          // Smart invalidation for meeting points
          queryClient.invalidateQueries({ 
            queryKey: ['meeting-points', organizationId],
            refetchType: 'none'
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_point_updates',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          devLog.debug('Meeting point updates update:', payload.eventType);
          
          // Smart invalidation for meeting point updates
          queryClient.invalidateQueries({ 
            queryKey: ['meeting-point-updates', organizationId],
            refetchType: 'none'
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'motivations',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          devLog.debug('Motivations update:', payload.eventType);
          
          // Smart invalidation for motivations
          queryClient.invalidateQueries({ 
            queryKey: ['motivations', organizationId],
            refetchType: 'none'
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'motivation_likes',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          // Smart invalidation for motivations (since likes affect motivation data)
          queryClient.invalidateQueries({ 
            queryKey: ['motivations', organizationId],
            refetchType: 'none'
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_steps_assigned'
        },
        async (payload) => {
          devLog.debug('Task step assignment changed:', payload.eventType);
          
          // IMPORTANT: Jangan auto-sync PIC saat INSERT (flow APPROVED)
          // Flow TITLE akan memanggil syncPicProduction secara eksplisit.
          if (payload.eventType === 'INSERT') {
            // Invalidate without forcing refetch to avoid loading flicker
            queryClient.invalidateQueries({ 
              queryKey: ['task-steps-assignments'],
              refetchType: 'none'
            });
            queryClient.invalidateQueries({ 
              queryKey: ['social-media-plans', organizationId],
              refetchType: 'none'
            });
            return;
          }
          
          // Get social_media_plan_id from the changed assignment
          if (payload.new || payload.old) {
            const assignmentData = payload.new || payload.old;
            try {
              // IMPORTANT: Only sync PIC Production from Content steps (is_concept_step = false), not Concept steps
              const { data: stepData } = await supabase
                .from('task_steps')
                .select('social_media_plan_id, is_concept_step')
                .eq('id', assignmentData.task_step_id)
                .maybeSingle();
              
              // Skip sync if this is a Concept step (PIC Production should only come from Content steps)
              if (stepData?.social_media_plan_id && stepData.is_concept_step === false) {
                // Get plan data to sync pic_production_id
                const { data: planData } = await supabase
                  .from('social_media_plans')
                  .select('pic_production_id, pic_production_source, google_drive_link')
                  .eq('id', stepData.social_media_plan_id)
                  .maybeSingle();
                
                if (planData) {
                  // Sync pic_production_id based on assignment priority
                  try {
                    await syncPicProduction(
                      stepData.social_media_plan_id,
                      planData.google_drive_link,
                      planData.pic_production_id,
                      planData.pic_production_source
                    );
                  } catch (error) {
                    devLog.error('Error syncing pic_production_id in realtime:', error);
                  }
                }
              }
            } catch (error) {
              devLog.error('Error processing task_steps_assigned change:', error);
            }
          }
          
          // Invalidate without forcing refetch
          queryClient.invalidateQueries({ 
            queryKey: ['task-steps-assignments'],
            refetchType: 'none'
          });
          queryClient.invalidateQueries({ 
            queryKey: ['social-media-plans', organizationId],
            refetchType: 'none'
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'task_steps'
        },
        async (payload) => {
          devLog.debug('Task step deleted:', payload.eventType);
          
          // When task_step is deleted, check if we need to update pic_production_id
          if (payload.old?.social_media_plan_id) {
            const planId = payload.old.social_media_plan_id;
            
            try {
              // Get plan data to sync pic_production_id
              const { data: planData } = await supabase
                .from('social_media_plans')
                .select('pic_production_id, pic_production_source, google_drive_link')
                .eq('id', planId)
                .maybeSingle();
              
              if (planData) {
                // Sync pic_production_id (will check if any assignments remain)
                try {
                  await syncPicProduction(
                    planId,
                    planData.google_drive_link,
                    planData.pic_production_id,
                    planData.pic_production_source
                  );
                } catch (error) {
                  devLog.error('Error syncing pic_production_id after step deletion:', error);
                }
              }
            } catch (error) {
              devLog.error('Error processing task_steps deletion:', error);
            }
          }
          
          // Invalidate without forcing refetch
          queryClient.invalidateQueries({ 
            queryKey: ['task-steps-assignments'],
            refetchType: 'none'
          });
          queryClient.invalidateQueries({ 
            queryKey: ['social-media-plans', organizationId],
            refetchType: 'none'
          });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          devLog.error('Realtime connection error - attempting to reconnect...');
          toast.warning('Connection lost. Refresh the page to reconnect.');
          setTimeout(() => {
            if (channelRef.current) {
              supabase.removeChannel(channelRef.current);
              channelRef.current = null;
            }
          }, 2000);
        }
      });

    channelRef.current = channel;

    // Cleanup subscription on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [organizationId, queryClient, syncPicProduction]);

};
