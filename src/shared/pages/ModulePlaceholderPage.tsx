import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { StandardLayout } from "@/shared/layouts";
import { Button } from "@/shared/components/ui/button";

type ModulePlaceholderPageProps = {
  titleKey: string;
  descriptionKey?: string;
};

export function ModulePlaceholderPage({
  titleKey,
  descriptionKey = "layout.placeholder.comingSoon",
}: ModulePlaceholderPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <StandardLayout>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30 font-sans">
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden">
            <div className="mx-auto max-w-md text-center">
              <div className="rounded-lg border bg-card p-8 shadow-sm">
                <h1 className="mb-4 text-2xl font-bold text-foreground">{t(titleKey)}</h1>
                <p className="mb-6 text-muted-foreground">{t(descriptionKey)}</p>
                <Button
                  type="button"
                  variant="default"
                  className="bg-brand-blue text-white hover:bg-brand-blue/90"
                  onClick={() => navigate(-1)}
                >
                  {t("layout.placeholder.back")}
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{t("layout.placeholder.contactAdmin")}</p>
            </div>
          </div>
        </div>
      </div>
    </StandardLayout>
  );
}
