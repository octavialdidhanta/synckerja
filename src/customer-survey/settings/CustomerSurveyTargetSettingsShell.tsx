import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { omnichannelSettingsPath } from "@/5-3-dashboard/omnichannel-settings/constants/omnichannelSettingsSections";
import {
  OMNICHANNEL_SETTINGS_CARD_HEADER_BASE,
  OMNICHANNEL_SETTINGS_CARD_SUBTITLE_CLASS,
  OMNICHANNEL_SETTINGS_CARD_TITLE_CLASS,
} from "@/5-3-dashboard/omnichannel-settings/constants/omnichannelSettingsCardHeader";
import { DEFAULT_ORG_PROMOTER_PCT_TARGET } from "@/features/customer-survey/core/surveyPromoterTarget";
import { useCustomerSurveyOrgTarget } from "@/features/customer-survey/hooks/useCustomerSurveyOrgTarget";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";

export function CustomerSurveyTargetSettingsShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { targetPct, isPending, saveMutation } = useCustomerSurveyOrgTarget(organizationId);
  const [draft, setDraft] = useState(String(DEFAULT_ORG_PROMOTER_PCT_TARGET));

  useEffect(() => {
    if (gatePending || !organizationId) return;
    if (!canManage) {
      toast.message(t("omnichannel.settings.customerSurveyTarget.adminOnlyToast"));
      navigate(omnichannelSettingsPath("user-management"), { replace: true });
    }
  }, [canManage, gatePending, navigate, organizationId, t]);

  useEffect(() => {
    if (!isPending) {
      setDraft(String(targetPct));
    }
  }, [targetPct, isPending]);

  const handleSave = async () => {
    const n = Number(draft);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      toast.error(t("crm.customerSurvey.targetInvalid", "Target must be between 0 and 100"));
      return;
    }
    try {
      await saveMutation.mutateAsync(n);
      toast.success(t("omnichannel.settings.customerSurveyTarget.saved"));
    } catch (e) {
      console.error(e);
      toast.error(t("omnichannel.settings.customerSurveyTarget.saveFailed"));
    }
  };

  if (gatePending) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className={OMNICHANNEL_SETTINGS_CARD_HEADER_BASE}>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-full max-w-md" />
        </div>
        <div className="scrollbar-hide flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 pt-4">
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!canManage) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={`${OMNICHANNEL_SETTINGS_CARD_HEADER_BASE} shrink-0`}>
        <h2 className={OMNICHANNEL_SETTINGS_CARD_TITLE_CLASS}>
          {t("omnichannel.settings.customerSurveyTarget.pageTitle")}
        </h2>
        <p className={OMNICHANNEL_SETTINGS_CARD_SUBTITLE_CLASS}>
          {t("omnichannel.settings.customerSurveyTarget.intro")}
        </p>
      </div>

      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-4 pt-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {isPending ? (
          <Skeleton className="h-24 w-full max-w-md" />
        ) : (
          <div className="max-w-md space-y-4 rounded-lg border border-border bg-muted/20 p-4">
            <div className="space-y-2">
              <Label htmlFor="org-promoter-target">
                {t("omnichannel.settings.customerSurveyTarget.fieldLabel")}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="org-promoter-target"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="max-w-[140px]"
                  disabled={saveMutation.isPending}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("omnichannel.settings.customerSurveyTarget.fieldHint")}
              </p>
            </div>
            <Button type="button" onClick={handleSave} disabled={saveMutation.isPending}>
              {t("omnichannel.settings.customerSurvey.save", "Save")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
