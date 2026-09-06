import { SidebarTrigger } from '@/mobile-app/components/ui/sidebar';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { SubscriptionExpiryBannerSlot } from '@/10-subscription/shared/SubscriptionExpiryBannerSlot';

/**
 * Shown when page access is denied so chrome matches the livechat list route.
 */
export function LiveChatMobileShellHeader() {
  const { t } = useAppTranslation();

  return (
    <>
      {/* White status-bar chrome (edge-to-edge Android). */}
      <div
        className="shrink-0 bg-white"
        style={{
          height: 'max(var(--safe-area-inset-top, 0px), env(safe-area-inset-top, 0px))',
        }}
        aria-hidden
      />
      <header className="sticky top-0 z-30 flex flex-shrink-0 flex-col gap-2 border-b border-primary/20 bg-primary p-2">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground md:hidden" />
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold text-primary-foreground">
              {t('sidebar.operations.livechat.title', 'Live Chat')}
            </h1>
            <p className="truncate text-xs text-primary-foreground/85">
              {t('sidebar.operations.livechat.description', 'Inbox dan percakapan WhatsApp')}
            </p>
          </div>
        </div>
      </header>
      <SubscriptionExpiryBannerSlot />
    </>
  );
}
