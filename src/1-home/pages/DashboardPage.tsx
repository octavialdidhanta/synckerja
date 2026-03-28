import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { supabase } from "@/shared/lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col seamless-scroll max-h-[calc(100vh-120px)] overflow-y-auto">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Synckerja</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/settings">{t("dashboard.settingsLink")}</Link>
          </Button>
          <Button variant="ghost" onClick={signOut}>
            {t("dashboard.signOut")}
          </Button>
        </div>
      </header>
      <main className="flex-1 p-6">
        <h2 className="text-2xl font-bold">{t("dashboard.title")}</h2>
        <p className="text-muted-foreground mt-2">{t("dashboard.subtitle")}</p>
      </main>
    </div>
  );
}
