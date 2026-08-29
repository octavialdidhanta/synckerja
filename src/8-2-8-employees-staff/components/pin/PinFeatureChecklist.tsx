import { Checkbox } from "@/shared/components/ui/checkbox";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_PIN_CHECKLIST_FEATURES } from "../../lib/pinFeatureCatalog";

type Props = {
  selected: Set<string>;
  onToggle: (key: string, checked: boolean) => void;
};

export function PinFeatureChecklist({ selected, onToggle }: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex-shrink-0 border-b px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("employeesStaff.pinAccess.featuresTitle", "List of Features")}
        </h3>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ul className="divide-y">
          {POS_PIN_CHECKLIST_FEATURES.map((feature) => {
            const checked = selected.has(feature.key);
            return (
              <li key={feature.key}>
                <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-muted/40">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => onToggle(feature.key, v === true)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-sm text-foreground">
                      {t(feature.labelKey, feature.labelFallback)}
                    </span>
                    {feature.descriptionKey ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {t(feature.descriptionKey, feature.descriptionFallback ?? "")}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
