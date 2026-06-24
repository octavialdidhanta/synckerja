import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { deletePlanPlatformPublish } from '../lib/deletePlanPlatformPublish';
import {
  invalidatePlanPublishQueries,
  patchPlanPublishCaches,
} from '../lib/invalidatePlanPublishQueries';
import { syncPlanCompletionStateClient } from '../lib/syncPlanCompletionStateClient';

export function useDeletePublishedPost() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePlanPlatformPublish,
    onSuccess: async (data, vars) => {
      const platform = vars.platform.trim();
      if (platform === 'YouTube' || platform === 'TikTok') {
        patchPlanPublishCaches(queryClient, {
          organizationId: vars.organizationId,
          planId: vars.planId,
          platform,
          accountId: vars.accountId,
        });
      }

      await invalidatePlanPublishQueries(queryClient, {
        organizationId: vars.organizationId,
        planId: vars.planId,
      });
      await syncPlanCompletionStateClient(vars.planId);

      if (data.platform_only_db_cleanup) {
        toast.success(t('digitalMarketing.scheduledPosts.deleteFromPlatformTikTokSuccess'));
      } else if (data.already_deleted || data.nothing_to_delete_on_platform) {
        toast.success(t('digitalMarketing.scheduledPosts.deleteFromPlatformAlreadyRemoved'));
      } else {
        toast.success(t('digitalMarketing.scheduledPosts.deleteFromPlatformSuccess'));
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('delete_scopes_not_granted')) {
        toast.error(t('digitalMarketing.scheduledPosts.deleteScopesMissing'));
        return;
      }
      toast.error(t('digitalMarketing.scheduledPosts.deleteFromPlatformFailed'));
    },
  });
}
