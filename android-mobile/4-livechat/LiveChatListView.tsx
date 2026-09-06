import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DesktopWarning } from '@/mobile-app/components/DesktopWarning';
import { SidebarProvider, SidebarTrigger } from '@/mobile-app/components/ui/sidebar';
import { AppSidebar } from '@/mobile-app/components/AppSidebar';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useVisualViewport } from '@/shared/hooks/useVisualViewport';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from '@/mobile-app/components/ui/drawer';
import { Search, ChevronDown, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { LiveChatConversation } from '@/5-3-whatsapp/types';
import type { WhatsAppAccount } from '@/5-3-whatsapp/types';
import { MobileConversationList } from './components/MobileConversationList';
import { MobileSearchConversationPopup } from './components/MobileSearchConversationPopup';
import { ConsultantCrmNavigationFooter } from '@/mobile/4-leads-management/components/ConsultantCrmNavigationFooter';
import { SubscriptionExpiryBannerSlot } from '@/10-subscription/shared/SubscriptionExpiryBannerSlot';

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;
/** Snap transition (same as TaskCard / ConversationList) for pull indicator snap-back. */
const SNAP_TRANSITION = '0.25s cubic-bezier(0.33, 1, 0.68, 1)';

type AccountFilterValue = '' | `wa:${string}` | `ig:${string}` | `fb:${string}` | `email:${string}`;

interface LiveChatListViewProps {
  conversations: LiveChatConversation[];
  isLoading: boolean;
  error: Error | null;
  waAccounts: WhatsAppAccount[];
  accountOptions: { value: string; label: string }[];
  accountFilter: AccountFilterValue;
  setAccountFilter: (v: AccountFilterValue) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  statusOptions: { value: string; label: string }[];
  initialTicketId: string | null;
  onSelectConversation: (conv: LiveChatConversation) => void;
  /** When user selects from search popup: open conversation and optionally highlight text or scroll to message. */
  onSelectFromSearch?: (conv: LiveChatConversation, opts?: { textQuery?: string; messageId?: string }) => void;
  /** When true, show banner that the ticket_id in URL was not found. */
  invalidTicketId?: boolean;
  /** Called on pull-to-refresh to refetch conversations. */
  onRefetch?: () => Promise<void>;
}

export function LiveChatListView({
  conversations,
  isLoading,
  error,
  waAccounts,
  accountOptions,
  accountFilter,
  setAccountFilter,
  statusFilter,
  setStatusFilter,
  statusOptions,
  initialTicketId,
  onSelectConversation,
  onSelectFromSearch,
  invalidTicketId = false,
  onRefetch,
}: LiveChatListViewProps) {
  const { t } = useAppTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPopupOpen, setSearchPopupOpen] = useState(false);
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  const [statusDrawerOpen, setStatusDrawerOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);
  const pullDistanceRef = useRef(0);
  const swipeGestureActiveRef = useRef(false);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const { height: viewportHeight, offsetTop: viewportOffsetTop, mainFixedStyle } =
    useVisualViewport();
  const isMobile = useIsMobile();

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  const handlePullRefresh = useCallback(async () => {
    if (!onRefetch || isRefreshing) return;
    setIsRefreshing(true);
    setPullDistance(0);
    pullDistanceRef.current = 0;
    try {
      await onRefetch();
    } catch {
      // Refetch failed; keep isRefreshing false so user can try again
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefetch, isRefreshing]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    const el = listScrollRef.current;
    if (el?.scrollTop <= 2) setIsPulling(true);
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (swipeGestureActiveRef.current) return;
      const el = listScrollRef.current;
      if (!el || isRefreshing) return;
      if (el.scrollTop > 2) {
        setIsPulling(false);
        setPullDistance(0);
        pullDistanceRef.current = 0;
        return;
      }
      const y = e.touches[0].clientY;
      const delta = y - touchStartY.current;
      if (delta > 0) {
        const d = Math.min(delta * PULL_RESISTANCE, MAX_PULL);
        setPullDistance(d);
        pullDistanceRef.current = d;
      } else {
        setPullDistance(0);
        pullDistanceRef.current = 0;
      }
    },
    [isRefreshing]
  );

  const onTouchEnd = useCallback(() => {
    setIsPulling(false);
    const d = pullDistanceRef.current;
    setPullDistance(0);
    pullDistanceRef.current = 0;
    if (d >= PULL_THRESHOLD) handlePullRefresh();
  }, [handlePullRefresh]);

  const onSwipeLockChange = useCallback((locked: boolean) => {
    swipeGestureActiveRef.current = locked;
    if (locked) {
      setIsPulling(false);
      setPullDistance(0);
      pullDistanceRef.current = 0;
    }
  }, []);

  const accountLabel = accountFilter
    ? accountOptions.find((o) => o.value === accountFilter)?.label ?? t('whatsappInbox.filterAllAccounts', 'All accounts')
    : t('whatsappInbox.filterAllAccounts', 'All accounts');
  const statusLabel = statusOptions.find((o) => o.value === statusFilter)?.label ?? t('whatsappInbox.allStatus', 'All Status');
  const isKeyboardLikelyOpen = typeof window !== 'undefined' && viewportHeight > 0 && viewportHeight < window.innerHeight * 0.85;

  const waAccountsForHint = waAccounts.map((a) => ({
    display_phone_number: a.display_phone_number,
    phone_number_id: a.phone_number_id,
  }));

  return (
    <DesktopWarning>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />

          {/* Same structure as LiveChatChatView: fixed viewport container, header first (sticky + safe-area-top), then scrollable content */}
          <main className="fixed inset-x-0 z-0 flex flex-col bg-background" style={mainFixedStyle}>
            {/* White status-bar chrome (edge-to-edge Android) — icons stay dark via useStatusBarStyle('livechat'). */}
            <div
              className="shrink-0 bg-white"
              style={{
                height:
                  "max(var(--safe-area-inset-top, 0px), env(safe-area-inset-top, 0px))",
              }}
              aria-hidden
            />
            <header className="sticky top-0 z-30 flex flex-shrink-0 flex-col gap-2 border-b border-primary/20 bg-primary p-2">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground md:hidden" />
                <div className="flex-1 min-w-0">
                  <h1 className="text-base font-semibold text-primary-foreground">{t('sidebar.operations.livechat.title', 'Live Chat')}</h1>
                  <p className="truncate text-xs text-primary-foreground/85">{t('sidebar.operations.livechat.description', 'Inbox dan percakapan WhatsApp')}</p>
                </div>
              </div>

              <div className="flex w-full items-center gap-1.5 min-w-0">
                <Drawer open={accountDrawerOpen} onOpenChange={setAccountDrawerOpen}>
                  <DrawerTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-8 flex-1 min-w-0 justify-between gap-1.5 text-left px-2 text-sm font-medium border border-input bg-background text-foreground hover:bg-muted/50"
                      aria-label={t('whatsappInbox.filterByAccount', 'Filter menurut akun')}
                    >
                      <span className="truncate min-w-0">{accountLabel}</span>
                      <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent className="max-h-[85dvh] flex flex-col bg-background">
                    <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                      <DrawerTitle className="text-lg font-semibold text-foreground">
                        {t('whatsappInbox.filterAllAccounts', 'All accounts')}
                      </DrawerTitle>
                    </DrawerHeader>
                    <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4">
                      <div className="flex flex-col gap-2 w-full max-h-[50vh] overflow-y-auto overflow-x-hidden">
                        {accountOptions.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setAccountFilter((opt.value === 'all' ? '' : opt.value) as AccountFilterValue);
                              setAccountDrawerOpen(false);
                            }}
                            className={cn(
                              'w-full px-3 py-2.5 rounded-md text-sm border text-left transition-colors break-words whitespace-normal',
                              (opt.value === 'all' ? !accountFilter : accountFilter === opt.value)
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background border-input hover:bg-muted'
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3">
                      <DrawerClose asChild>
                        <Button className="w-full" size="sm">{t('dailyTaskReport.filters.done', 'Done')}</Button>
                      </DrawerClose>
                    </div>
                  </DrawerContent>
                </Drawer>
                <Drawer open={statusDrawerOpen} onOpenChange={setStatusDrawerOpen}>
                  <DrawerTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-8 flex-1 min-w-0 justify-between gap-1.5 text-left px-2 text-sm font-medium border border-input bg-background text-foreground hover:bg-muted/50"
                      aria-label={t('whatsappInbox.filterByStatus', 'Filter menurut status')}
                    >
                      <span className="truncate min-w-0">{statusLabel}</span>
                      <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent className="max-h-[85dvh] flex flex-col bg-background">
                    <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                      <DrawerTitle className="text-lg font-semibold text-foreground">
                        {t('whatsappInbox.status', 'Status')}
                      </DrawerTitle>
                    </DrawerHeader>
                    <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4">
                      <div className="flex flex-col gap-2 w-full max-h-[50vh] overflow-y-auto overflow-x-hidden">
                        {statusOptions.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setStatusFilter(opt.value);
                              setStatusDrawerOpen(false);
                            }}
                            className={cn(
                              'w-full px-3 py-2.5 rounded-md text-sm border text-left transition-colors break-words whitespace-normal',
                              statusFilter === opt.value
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background border-input hover:bg-muted'
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3">
                      <DrawerClose asChild>
                        <Button className="w-full" size="sm">{t('dailyTaskReport.filters.done', 'Done')}</Button>
                      </DrawerClose>
                    </div>
                  </DrawerContent>
                </Drawer>
                <button
                  type="button"
                  onClick={() => setSearchPopupOpen(true)}
                  className="h-8 w-8 shrink-0 flex items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title={t('whatsappInbox.searchConversations', 'Cari percakapan atau orang')}
                  aria-label={t('whatsappInbox.searchConversations', 'Cari percakapan atau orang')}
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>

              <Dialog open={searchPopupOpen} onOpenChange={(open) => { setSearchPopupOpen(open); if (!open) setSearchQuery(''); }}>
                <DialogContent
                  className={cn(
                    'overflow-hidden flex flex-col',
                    isMobile
                      ? 'fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none rounded-none modal-above-safe-area p-0 gap-0'
                      : 'dialog-search-instant sm:max-w-md p-4'
                  )}
                  overlayClassName="dialog-search-overlay-instant"
                  fullscreenAnimation={isMobile}
                  style={
                    !isMobile && viewportHeight > 0
                      ? isKeyboardLikelyOpen
                        ? {
                            top: viewportOffsetTop + 8,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            maxHeight: viewportHeight - 16,
                          }
                        : { maxHeight: viewportHeight - 48 }
                      : undefined
                  }
                >
                  <DialogHeader
                    className={cn(
                      'flex-shrink-0',
                      isMobile
                        ? 'safe-area-top border-b bg-gradient-to-r from-blue-50 to-indigo-50 px-4 pt-4 pb-3 text-left dark:from-blue-950/20 dark:to-indigo-950/20'
                        : ''
                    )}
                  >
                    <DialogTitle className={cn(isMobile && 'text-lg font-semibold')}>
                      {t('whatsappInbox.searchConversations', 'Cari percakapan atau orang')}
                    </DialogTitle>
                  </DialogHeader>
                  <div className={cn('min-h-0 flex flex-col overflow-hidden flex-1 overflow-y-auto seamless-scroll', isMobile && 'px-4 pb-4')}>
                    <MobileSearchConversationPopup
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      conversations={conversations}
                      onSelectConversation={(conv) => {
                        if (onSelectFromSearch) {
                          onSelectFromSearch(conv, { textQuery: searchQuery.trim() || undefined });
                        } else {
                          onSelectConversation(conv);
                        }
                        setSearchPopupOpen(false);
                      }}
                      onSelectMessageResult={
                        onSelectFromSearch
                          ? (conv, messageId) => {
                              onSelectFromSearch(conv, { messageId });
                              setSearchPopupOpen(false);
                            }
                          : undefined
                      }
                      selectedId={null}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </header>

            <SubscriptionExpiryBannerSlot />

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {invalidTicketId && (
                <div className="mx-3 mt-2 flex-shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">
                  {t('whatsappInbox.conversationNotFound', 'Obrolan tidak ditemukan.')}
                </div>
              )}

              <div
                ref={listScrollRef}
                className="scrollbar-hide nested-scroll-touch-chain flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto seamless-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                {onRefetch && (
                  <div
                    className="flex shrink-0 items-center justify-center overflow-hidden bg-primary text-sm text-primary-foreground/80"
                    style={{
                      height: pullDistance > 0 ? Math.min(pullDistance, MAX_PULL) : isRefreshing ? INDICATOR_HEIGHT : 0,
                      minHeight: 0,
                      transition: isPulling ? 'none' : `height ${SNAP_TRANSITION}, min-height ${SNAP_TRANSITION}`,
                    }}
                  >
                    {isRefreshing ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" aria-hidden />
                    ) : pullDistance >= PULL_THRESHOLD ? (
                      <span className="whitespace-nowrap text-xs font-medium text-white">
                        {t('common.pullToRefresh.release', 'Lepas untuk refresh')}
                      </span>
                    ) : (
                      <RefreshCw
                        className="h-5 w-5 shrink-0 text-primary-foreground/80 opacity-80"
                        style={{
                          transform: `rotate(${Math.min((pullDistance / PULL_THRESHOLD) * 180, 180)}deg)`,
                          transition: isPulling ? 'none' : `transform ${SNAP_TRANSITION}`,
                        }}
                        aria-hidden
                      />
                    )}
                  </div>
                )}
                <div className="content-padding-above-nav-livechat mx-auto w-full max-w-md">
                  <MobileConversationList
                    conversations={conversations}
                    isLoading={isLoading}
                    error={error}
                    selectedId={null}
                    onSelect={onSelectConversation}
                    initialConversationId={null}
                    initialTicketId={initialTicketId}
                    searchQuery={searchQuery}
                    accountFilter={accountFilter || undefined}
                    waAccountsForHint={waAccountsForHint}
                    onSwipeLockChange={onSwipeLockChange}
                  />
                </div>
              </div>
            </div>

            <ConsultantCrmNavigationFooter className="safe-area-bottom-lower" />
          </main>
        </div>
      </SidebarProvider>
    </DesktopWarning>
  );
}
