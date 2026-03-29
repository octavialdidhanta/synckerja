import { useTranslation } from "react-i18next";

export function LoadingView() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 py-12">
      <div
        className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent"
        aria-hidden
      />
      <p className="text-muted-foreground">{t("transferOwnership.loading")}</p>
    </div>
  );
}
