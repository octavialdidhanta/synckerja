import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import { useTranslation } from "react-i18next";

type FlowTemplateCardProps = {
  titleKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  gradientClass: string;
  disabled?: boolean;
  onClick?: () => void;
};

export function FlowTemplateCard({
  titleKey,
  descriptionKey,
  icon: Icon,
  gradientClass,
  disabled,
  onClick,
}: FlowTemplateCardProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      )}
    >
      <div className={cn("flex h-28 items-center justify-center", gradientClass)}>
        <Icon className="h-12 w-12 text-white/90 drop-shadow-sm" aria-hidden />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">{t(titleKey)}</h3>
          {disabled ? (
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {t("omnichannel.automationFlow.create.comingSoon")}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{t(descriptionKey)}</p>
      </div>
    </button>
  );
}
