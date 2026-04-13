import { WhatsAppLivechatPageSkeleton } from "@/5-3-whatsapp/skeletons/WhatsAppLivechatPageSkeleton";
import { MobileConsultantLivechatShellSkeleton } from "@/mobile/4-livechat/pages/MobileConsultantLivechatViewportSkeleton";
import { useToolsModuleMobileViewport } from "@/shared/hooks/useToolsModuleMobileViewport";

/** `PageAccessGuard` loadingShell: desktop inbox skeleton vs mobile livechat chrome skeleton. */
export function ConsultantLivechatRouteLoadingShell() {
  const useMobileShell = useToolsModuleMobileViewport();
  if (!useMobileShell) {
    return <WhatsAppLivechatPageSkeleton />;
  }
  return <MobileConsultantLivechatShellSkeleton />;
}
