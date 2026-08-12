import { ArrowLeft } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/mobile-app/components/ui/drawer";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MobileContentPlanBriefEditor } from "@/mobile/6-1-content-calendar/components/MobileContentPlanBriefEditor";

type PlanLike = {
  id: string;
  title?: string | null;
  brief?: string | null;
  service?: { name?: string | null } | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PlanLike | null;
  /** When true, back returns to plan picker instead of closing everything. */
  showBackToPicker?: boolean;
  onBackToPicker?: () => void;
};

/**
 * Step 2: Storyline / Storyboard editor only (SSoT brief + images).
 */
export function MobilePlanBriefSheet({
  open,
  onOpenChange,
  plan,
  showBackToPicker = false,
  onBackToPicker,
}: Props) {
  const { t } = useAppTranslation();

  const subtitle = [
    plan?.service?.name,
    plan?.title?.trim() || t("contentCalendar.mobile.untitled", "Untitled"),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex max-h-[92vh] flex-col px-0 pb-3">
        <DrawerHeader className="shrink-0 px-3 pb-2 text-left">
          <div className="flex items-start gap-1">
            {showBackToPicker && onBackToPicker ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 h-8 w-8 shrink-0"
                onClick={onBackToPicker}
                aria-label={t("common.back", "Back")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : null}
            <div className="min-w-0 flex-1">
              <DrawerTitle className="truncate text-base">
                {t("contentCalendar.mobile.storyboardTitle", "Storyboard")}
              </DrawerTitle>
              {subtitle ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
          </div>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-2">
          {plan?.id ? (
            <MobileContentPlanBriefEditor planId={plan.id} brief={plan.brief} />
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
