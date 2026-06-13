import { Calculator, GitCompare, History } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type PricingToolsView = "calculator" | "history" | "comparison";

const VIEWS: Array<{
  id: PricingToolsView;
  icon: typeof Calculator;
  labelKey: string;
  fallback: string;
}> = [
  { id: "calculator", icon: Calculator, labelKey: "pricingTools.views.calculator", fallback: "Kalkulator" },
  { id: "history", icon: History, labelKey: "pricingTools.views.history", fallback: "Riwayat" },
  { id: "comparison", icon: GitCompare, labelKey: "pricingTools.views.comparison", fallback: "Perbandingan" },
];

type PricingToolsViewNavProps = {
  value: PricingToolsView;
  onChange: (view: PricingToolsView) => void;
  className?: string;
};

export function PricingToolsViewNav({ value, onChange, className }: PricingToolsViewNavProps) {
  const { t } = useAppTranslation();

  return (
    <div
      role="tablist"
      aria-label={t("pricingTools.views.navAria", "Mode alat harga")}
      className={cn(
        "inline-flex w-full max-w-lg flex-wrap gap-1 rounded-lg border border-border/70 bg-muted/40 p-1",
        className,
      )}
    >
      {VIEWS.map(({ id, icon: Icon, labelKey, fallback }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:flex-none sm:px-4",
              active
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{t(labelKey, fallback)}</span>
          </button>
        );
      })}
    </div>
  );
}
