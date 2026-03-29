import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

export function AccessDeniedView() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 py-12">
      <AlertTriangle className="mb-4 h-12 w-12 text-destructive" aria-hidden />
      <h1 className="mb-2 text-center text-2xl font-bold text-foreground">{t("transferOwnership.accessDenied.title")}</h1>
      <p className="max-w-md text-center text-muted-foreground">{t("transferOwnership.accessDenied.description")}</p>
    </div>
  );
}
