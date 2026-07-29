import type { ShareableSocialMediaPlan } from "../lib/buildSharePlanQuery";
import { SharePublishPlanDateStripPicker } from "./SharePublishPlanDateStripPicker";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type Props = {
  plans: ShareableSocialMediaPlan[];
  loading: boolean;
  selectedPlanId: string | null;
  uploadedPlanIds?: string[];
  onSelect: (plan: ShareableSocialMediaPlan) => void;
  onCreatePlan?: (postDate: string) => void;
  createDisabled?: boolean;
};

export function SharePublishPlanPickerStep({
  plans,
  loading,
  selectedPlanId,
  uploadedPlanIds,
  onSelect,
  onCreatePlan,
  createDisabled,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="rounded-xl border border-border/70 bg-white p-2.5">
      <p className="text-xs font-medium text-muted-foreground">
        {t("share.publish.picker.sectionTitle", "Content plan")}
      </p>
      <div className="mt-2 space-y-2">
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 animate-pulse rounded-lg bg-muted" />
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="h-8 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 14 }).map((_, index) => (
                <div key={index} className="min-h-[92px] animate-pulse rounded-lg bg-muted/80" />
              ))}
            </div>
          </div>
        ) : (
          <SharePublishPlanDateStripPicker
            plans={plans}
            selectedPlanId={selectedPlanId}
            uploadedPlanIds={uploadedPlanIds}
            onSelect={onSelect}
            onCreatePlan={onCreatePlan}
            createDisabled={createDisabled}
          />
        )}
      </div>
    </div>
  );
}
