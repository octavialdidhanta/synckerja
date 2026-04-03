import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SidebarProvider } from "@/shared/components/ui/sidebar";
import { AppHeader } from "@/shared/layouts/header/AppHeader";
import { AppSidebar } from "@/shared/layouts/sidebar/AppSidebar";
import { useHeaderUserProfile } from "@/shared/hooks/useHeaderUserProfile";
import { usePreferredLocaleSync } from "@/shared/hooks/usePreferredLocaleSync";

type StandardLayoutProps = {
  children: ReactNode;
};

/**
 * Full app chrome (header + main sidebar + scrollable main) for pages rendered outside `AppShellLayout`’s `<Outlet />`.
 * Matches `AppShellLayout` structure so behavior stays consistent.
 */
export function StandardLayout({ children }: StandardLayoutProps) {
  const { t } = useTranslation();
  const { user } = useHeaderUserProfile();
  usePreferredLocaleSync(user?.id);

  return (
    <SidebarProvider
      className="flex h-full min-h-0 w-full flex-col"
      defaultOpen={false}
      sidebarToggleLabel={t("layout.header.toggleSidebar")}
      mobileNavSheetTitle={t("layout.a11y.mobileNavTitle")}
      mobileNavSheetDescription={t("layout.a11y.mobileNavDescription")}
    >
      <AppHeader />
      <div className="mt-16 flex min-h-0 min-w-0 flex-1">
        <AppSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="seamless-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
              <div className="flex min-h-full flex-col">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
