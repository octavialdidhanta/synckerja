import { X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type OutletTrialBannerProps = {
  onDismiss?: () => void;
};

export function OutletTrialBanner({ onDismiss }: OutletTrialBannerProps) {
  const { t } = useAppTranslation();

  return (
    <div className="flex items-start gap-3 rounded-md bg-destructive px-4 py-3 text-destructive-foreground">
      <X className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 text-sm">
        {t(
          "outlets.trialBanner",
          "Add Outlet is not available for trial accounts. Your account is currently in the trial period. To add more outlets, please upgrade to a paid subscription package.",
        )}
      </p>
      <Button
        asChild
        size="sm"
        className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <Link to="/subscription/plans">
          {t("outlets.subscribeNow", "Subscribe Now")}
        </Link>
      </Button>
      {onDismiss ? (
        <button
          type="button"
          className="shrink-0 text-destructive-foreground/80 hover:text-destructive-foreground"
          onClick={onDismiss}
          aria-label={t("common.close", "Close")}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
