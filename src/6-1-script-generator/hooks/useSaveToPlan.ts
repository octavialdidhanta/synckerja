import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { parseAIScriptOutput } from '../utils/parseAIScriptOutput';
import { getCaptionFallback } from '../utils/parseScriptSections';
import { stripBreakdownScriptLabel, stripScriptKontenDigitalMarketing } from '@/shared/utils/briefUtils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { toast } from 'sonner';

export interface NewPlanData {
  title: string;
  pic_id: string;
  content_type_id: string;
  service_id: string;
  sub_service_id: string;
  content_pillar_id: string;
}

export interface SaveToPlanParams {
  script: string;
  planId: string | 'new';
  postDate: string;
  saveBrief: boolean;
  saveCaption: boolean;
  saveConcept?: boolean;
  newPlanData?: NewPlanData;
}

function isNewPlanDataComplete(data: NewPlanData | undefined): data is NewPlanData {
  if (!data) return false;
  return !!(
    data.title?.trim() &&
    data.pic_id &&
    data.content_type_id &&
    data.service_id &&
    data.sub_service_id &&
    data.content_pillar_id
  );
}

export function useSaveToPlan() {
  const queryClient = useQueryClient();
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const { data: currentEmployee } = useCurrentEmployee();
  const [isSaving, setIsSaving] = useState(false);

  const saveToPlan = useCallback(
    async (params: SaveToPlanParams): Promise<boolean> => {
      const { script, planId, postDate, saveBrief, saveCaption, saveConcept = false, newPlanData } = params;

      if (!organizationId) {
        toast.error(t('scriptGenerator.saveToPlanModal.errorOrgNotFound', 'Organization not found'));
        return false;
      }

      if (!saveBrief && !saveCaption && !saveConcept) {
        toast.error(t('scriptGenerator.saveToPlanModal.errorSelectBriefOrCaption', 'Select at least one: Brief, Caption, or Concept'));
        return false;
      }

      const { brief: rawBrief, caption: parsedCaption, concept } = parseAIScriptOutput(script);
      let brief = saveBrief
        ? stripScriptKontenDigitalMarketing(stripBreakdownScriptLabel(rawBrief))
        : rawBrief;

      // Fallback: jika parser mengembalikan brief kosong (mis. format AI tidak standar), pakai seluruh script sebagai brief
      if (saveBrief && !brief.trim() && script.trim()) {
        brief = stripScriptKontenDigitalMarketing(stripBreakdownScriptLabel(script.trim()));
      }

      // Use caption from parseAIScriptOutput, fallback to getCaptionFallback when format differs
      const caption = parsedCaption.trim() || getCaptionFallback(script);

      if (saveBrief && !brief.trim()) {
        toast.error(t('scriptGenerator.saveToPlanModal.errorNoBrief', 'No Brief content to save'));
        return false;
      }

      if (saveCaption && !caption.trim()) {
        toast.error(t('scriptGenerator.saveToPlanModal.errorNoCaption', 'No Caption content to save'));
        return false;
      }

      if (saveConcept && !concept.trim()) {
        toast.error(t('scriptGenerator.saveToPlanModal.errorNoConcept', 'No Concept content to save'));
        return false;
      }

      if (planId === 'new' && !isNewPlanDataComplete(newPlanData)) {
        toast.error(t('scriptGenerator.saveToPlanModal.errorNewPlanRequired', 'Complete all fields to create new plan'));
        return false;
      }

      setIsSaving(true);
      try {
        let targetPlanId: string;

        if (planId === 'new') {
          if (!newPlanData) {
            toast.error(t('scriptGenerator.saveToPlanModal.errorNewPlanRequired', 'Complete all fields to create new plan'));
            return false;
          }
          // Create new plan
          const picId = newPlanData.pic_id;
          const newPlanDataInsert = {
            organization_id: organizationId,
            post_date: postDate,
            content_type_id: newPlanData.content_type_id,
            pic_id: picId,
            service_id: newPlanData.service_id,
            sub_service_id: newPlanData.sub_service_id,
            title: newPlanData.title.trim(),
            content_pillar_id: newPlanData.content_pillar_id,
            brief: saveBrief ? brief.trim() : null,
            status: '',
            revision_count: 0,
            approved: false,
            completion_date: saveBrief ? new Date().toISOString() : null,
            pic_production_id: null,
            google_drive_link: null,
            production_status: '',
            production_revision_count: 0,
            production_completion_date: null,
            production_approved: false,
            production_approved_date: null,
            post_link: null,
            done: false,
            actual_post_date: null,
            on_time_status: '',
            status_content: '',
          };

          const { data: newPlan, error: insertError } = await supabase
            .from('social_media_plans')
            .insert(newPlanDataInsert)
            .select('id')
            .single();

          if (insertError) throw insertError;
          const planRow = newPlan as unknown as { id: string } | null;
          if (!planRow?.id) {
            toast.error(t('scriptGenerator.saveToPlanModal.errorCreateFailed', 'Failed to create new plan'));
            return false;
          }
          targetPlanId = planRow.id;
        } else {
          targetPlanId = planId;

          if (saveBrief) {
            const { error: updateError } = await supabase
              .from('social_media_plans')
              .update({
                brief: brief.trim(),
                completion_date: new Date().toISOString(),
                status: 'Need Review',
              })
              .eq('id', targetPlanId);

            if (updateError) throw updateError;
          }
        }

        if (saveCaption) {
          const { error: captionError } = await supabase.from('brief_captions').upsert(
            {
              social_media_plan_id: targetPlanId,
              content: caption.trim() || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'social_media_plan_id' }
          );

          if (captionError) throw captionError;
        }

        if (saveConcept) {
          const { error: conceptError } = await supabase.from('brief_target_audiences').upsert(
            {
              social_media_plan_id: targetPlanId,
              description: concept.trim() || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'social_media_plan_id' }
          );

          if (conceptError) throw conceptError;
        }

        queryClient.invalidateQueries({ queryKey: ['social-media-plans', organizationId] });
        queryClient.invalidateQueries({ queryKey: ['social-media-plans-by-date'] });
        toast.success(t('scriptGenerator.saveToPlanSuccess', 'Successfully saved to plan'));
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : t('scriptGenerator.saveToPlanModal.errorSaveFailed', 'Failed to save to plan');
        toast.error(message);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [organizationId, queryClient, t]
  );

  return { saveToPlan, isSaving };
}
