import { XCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

export type AccessDeniedContentPanelProps = {
  className?: string;
  /** Department-scoped restriction only (role is shown in the header, not repeated here). */
  restrictionMessage?: string | null;
};

/**
 * Inline access denied UI for the main content column (sidebar / HeaderAndTab stay visible).
 */
export function AccessDeniedContentPanel({
  className,
  restrictionMessage,
}: AccessDeniedContentPanelProps) {
  const { t } = useAppTranslation();

  return (
    <div
      className={cn(
        "flex min-h-[min(24rem,50vh)] flex-1 flex-col items-center justify-center rounded-lg border border-border bg-card p-6",
        className,
      )}
      role="alert"
    >
      <div className="mx-auto max-w-md text-center">
        <div className="bg-destructive/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full">
          <XCircle className="text-destructive h-10 w-10" />
        </div>
        <h2 className="text-foreground mb-3 text-lg font-semibold">
          {t("accessDenied.title", "Access denied")}
        </h2>
        <p className="text-muted-foreground mb-6 text-sm">
          {t("accessDenied.message", "You do not have permission to view this page.")}
        </p>
        {restrictionMessage ? (
          <div className="bg-muted/50 mb-6 rounded-lg p-4 text-left text-sm">
            <p>
              <span className="font-medium">
                {t("accessDenied.restriction", "Restriction")}:
              </span>{" "}
              {restrictionMessage}
            </p>
          </div>
        ) : null}
        <Button className="w-full" type="button" onClick={() => (window.location.href = "/")}>
          {t("accessDenied.backToHome", "Back to home")}
        </Button>
      </div>
    </div>
  );
}
