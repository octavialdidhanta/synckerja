import { lazy, Suspense, type ReactNode } from "react";
import { WhatsAppLivechatPageSkeleton } from "@/5-3-whatsapp/skeletons/WhatsAppLivechatPageSkeleton";
import MobileConsultantLivechatPage from "@/mobile/4-livechat/LiveChatPage";
import { useToolsModuleMobileViewport } from "@/shared/hooks/useToolsModuleMobileViewport";

const DesktopConsultantLivechatPage = lazy(() =>
  import("@/5-3-whatsapp/pages/WhatsAppInboxPage").then((m) => ({ default: m.WhatsAppInboxPage })),
);

function ShellSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div
          className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted"
          aria-busy
          aria-label="Loading live chat"
        >
          <WhatsAppLivechatPageSkeleton />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

/**
 * `/operations/consultant/all/livechat`: viewport tools-mobile atau native → `android-mobile/4-livechat/LiveChatPage`.
 * Harus dipasangkan dengan `AdaptiveAppLayout` bypass untuk path ini agar tidak dobel `AppHeader`.
 */
export function ConsultantLivechatRouteElement() {
  const useMobileShell = useToolsModuleMobileViewport();
  if (!useMobileShell) {
    return (
      <ShellSuspense>
        <DesktopConsultantLivechatPage />
      </ShellSuspense>
    );
  }
  return <MobileConsultantLivechatPage />;
}
