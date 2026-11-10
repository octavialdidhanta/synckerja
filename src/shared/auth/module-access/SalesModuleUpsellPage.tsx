import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { salesModuleDefinition, type SalesModuleKey } from "@/shared/auth/module-access/moduleCatalog";
import { Card, CardContent } from "@/shared/components/ui/card";

type SalesModuleUpsellPageProps = {
  moduleKey: SalesModuleKey;
  className?: string;
};

const FLAG_ONLY_MODULE_LABEL_KEYS: Partial<Record<SalesModuleKey, string>> = {
  whatsappBusiness: "salesModule.whatsappBusiness.label",
  pos: "salesModule.pos.label",
  operations: "salesModule.operations.label",
};

export function SalesModuleUpsellPage({ moduleKey, className }: SalesModuleUpsellPageProps) {
  const { t } = useTranslation();
  const definition = salesModuleDefinition(moduleKey);
  const labelKey = FLAG_ONLY_MODULE_LABEL_KEYS[moduleKey] ?? definition?.labelKey;
  const moduleLabel = labelKey
    ? t(labelKey, labelKey === "salesModule.whatsappBusiness.label" ? "WhatsApp Business API" : labelKey)
    : moduleKey;

  return (
    <div className={className}>
      <Card className="mx-auto w-full max-w-lg border-border/80 shadow-sm">
        <CardContent className="flex flex-col items-center gap-5 px-5 py-8 text-center sm:px-8 sm:py-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <Lock className="h-7 w-7 text-amber-800" aria-hidden />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">
              {t("salesModule.upsell.title", "Module not activated")}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t(
                "salesModule.upsell.description",
                "Contact the Synckerja team to activate the {{module}} module for your organization.",
                { module: moduleLabel },
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
