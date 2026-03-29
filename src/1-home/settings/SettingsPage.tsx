import { useCallback, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Shield, User } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const TAB_CONFIG = [
  { value: "profile" as const, labelKey: "settings.tabs.profile", path: "/settings" },
  { value: "security" as const, labelKey: "settings.tabs.security", path: "/settings/security" },
];

export default function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const currentTab = useMemo(() => {
    return location.pathname.includes("/security") ? "security" : "profile";
  }, [location.pathname]);

  const handleTabClick = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate],
  );

  return (
    <main className="mx-auto w-full max-w-6xl p-6 pb-8">
      <header className="mb-6 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("settings.page.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("settings.page.subtitle")}</p>

        <nav className="mt-6 flex gap-1 border-b border-border" aria-label={t("settings.page.navAria")}>
          {TAB_CONFIG.map((tab) => {
            const isActive = currentTab === tab.value;
            const Icon = tab.value === "profile" ? User : Shield;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleTabClick(tab.path)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {t(tab.labelKey)}
              </button>
            );
          })}
        </nav>
      </header>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <Outlet />
      </section>
    </main>
  );
}
