import { useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NavigationFooter } from "@/mobile-app/components/NavigationFooter";
import { DesktopWarning } from "@/mobile-app/components/DesktopWarning";
import { AppSidebar } from "@/mobile-app/components/AppSidebar";
import { SidebarProvider } from "@/mobile-app/components/ui/sidebar";
import { Button } from "@/mobile-app/components/ui/button";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";

export default function MobileSettingsShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useStatusBarStyle("light");
  const { mainFixedStyle } = useVisualViewport();

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/profile", { replace: true });
  }, [navigate]);

  return (
    <DesktopWarning>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />
          <main className="fixed inset-x-0 z-0 flex flex-col bg-background" style={mainFixedStyle}>
            <header className="sticky top-0 z-30 flex flex-shrink-0 items-center gap-2 border-b border-border bg-card p-3 safe-area-top">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={handleBack}
                aria-label={t("settings.mobile.backToProfile")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="text-base font-semibold text-foreground">{t("settings.mobile.securityTitle")}</h1>
                <p className="text-xs text-muted-foreground">{t("settings.mobile.securitySubtitle")}</p>
              </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="scrollbar-hide seamless-scroll flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="content-padding-above-nav-default mx-auto w-full max-w-md space-y-1 px-2 pt-2">
                  <Outlet />
                </div>
              </div>
            </div>

            <NavigationFooter className="safe-area-bottom-lower" />
          </main>
        </div>
      </SidebarProvider>
    </DesktopWarning>
  );
}
