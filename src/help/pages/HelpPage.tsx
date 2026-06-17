import { useTranslation } from "react-i18next";
import { HelpContactCard } from "@/help/components/HelpContactCard";
import { HelpFaqList } from "@/help/components/HelpFaqList";

export default function HelpPage() {
  const { t } = useTranslation();

  return (
    <main className="mx-auto w-full max-w-3xl p-6 pb-8">
      <header className="mb-6 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("help.page.title", "Help & Support")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("help.page.subtitle", "Get assistance from the Synckerja team.")}
        </p>
      </header>

      <div className="space-y-6">
        <HelpContactCard />
        <HelpFaqList />
        <p className="text-center text-xs text-muted-foreground">
          {t(
            "help.legalNote",
            "For privacy or legal inquiries, see our policy pages or contact business@vialdi.id.",
          )}
        </p>
      </div>
    </main>
  );
}
