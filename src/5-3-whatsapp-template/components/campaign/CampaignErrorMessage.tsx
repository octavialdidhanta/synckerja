import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";

type CampaignErrorMessageProps = {
  message: string;
  className?: string;
  /** Hide grey header bar (e.g. inside a table cell that already has a column label). */
  compact?: boolean;
};

/**
 * Full Meta / worker error text — wraps and scrolls instead of truncating.
 */
export function CampaignErrorMessage({ message, className, compact = false }: CampaignErrorMessageProps) {
  const { t } = useTranslation();
  const text = String(message ?? "").trim();
  if (!text) return null;

  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-md border border-red-200/90 bg-white",
        className,
      )}
    >
      {!compact ? (
        <div className="border-b border-red-100 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
          {t("whatsappTemplates.campaign.col.error")}
        </div>
      ) : null}
      <pre
        className={cn(
          "max-h-64 min-w-0 overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs leading-relaxed text-red-700",
          compact && "max-h-40 p-2",
        )}
      >
        {text}
      </pre>
    </div>
  );
}
