import { useTranslation } from "react-i18next";

export default function DashboardPage() {
  const { t } = useTranslation();

  return (
    <main className="p-6">
      <h2 className="text-2xl font-bold">{t("dashboard.title")}</h2>
      <p className="mt-2 text-muted-foreground">{t("dashboard.subtitle")}</p>
    </main>
  );
}
