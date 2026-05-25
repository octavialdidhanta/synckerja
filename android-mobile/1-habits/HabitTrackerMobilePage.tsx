import { useState, useEffect, useMemo } from 'react';
import { Plus, Bell } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DesktopWarning } from '@/mobile-app/components/DesktopWarning';
import { SidebarProvider, SidebarTrigger } from '@/mobile-app/components/ui/sidebar';
import { AppSidebar } from '@/mobile-app/components/AppSidebar';
import { NavigationFooter } from '@/mobile-app/components/NavigationFooter';
import { useVisualViewport } from '@/shared/hooks/useVisualViewport';
import { useStatusBarStyle } from '@/shared/hooks/useStatusBarStyle';
import { HabitTrackerProvider } from '@/features/8-2-HabitTracker/context/HabitTrackerContext';
import { HabitFormModal } from '@/features/8-2-HabitTracker/components/HabitFormModal';
import { HabitTrackerMobileContent } from './section/HabitTrackerMobileContent';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Button } from '@/shared/components/ui/button';
import { RealtimeStatusIndicator } from '@/mobile-app/components/RealtimeStatusIndicator';
import { useRealtimePresence } from '@/mobile-app/hooks/useRealtimePresence';
import { useProfile } from '@/mobile-app/hooks/useProfile';
import { useNotificationBadgeCount } from '@/shared/hooks/useNotificationBadgeCount';
import { NotificationsModal } from '@/mobile-app/components/NotificationsModal';
import { useAuth } from '@/shared/auth/contexts/AuthContext';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { MOBILE_PAGE_PATH } from '@/shared/auth/page-access/mobileRoutePagePaths';

function getGreetingKey(hour: number): 'morning' | 'noon' | 'afternoon' | 'night' {
  if (hour >= 18) return 'night';
  if (hour >= 15) return 'afternoon';
  if (hour >= 11) return 'noon';
  return 'morning';
}

const HabitTrackerMobilePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  useStatusBarStyle('light');
  const { mainFixedStyle } = useVisualViewport();
  const { t } = useAppTranslation();
  const { user } = useAuth();
  const { organizationId } = useCurrentOrg();
  const { profile, loading: profileLoading } = useProfile();
  const { totalCount: notificationBadgeCount } = useNotificationBadgeCount();

  const [showAddModal, setShowAddModal] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [initialNotificationsTab, setInitialNotificationsTab] = useState<
    'comments' | 'tasks' | 'updates' | undefined
  >(undefined);
  const [initialPostedLinksPlanId, setInitialPostedLinksPlanId] = useState<string | undefined>(
    undefined
  );
  const [initialPostedLinksPlanTitle, setInitialPostedLinksPlanTitle] = useState<string | undefined>(
    undefined
  );
  const [initialPostedLinksForceOpen, setInitialPostedLinksForceOpen] = useState(false);

  useEffect(() => {
    const state = location.state as {
      reopenNotifications?: boolean;
      openNotificationsTab?: 'comments' | 'tasks' | 'updates';
      openPostedLinksModal?: boolean;
      openPostedLinksForceOpen?: boolean;
      openPostedLinksPlanId?: string;
      openPostedLinksPlanTitle?: string;
    } | null;
    if (state?.reopenNotifications) {
      setNotificationsOpen(true);
      setInitialNotificationsTab(state.openNotificationsTab);
      if (state.openPostedLinksPlanId) {
        setInitialPostedLinksPlanId(state.openPostedLinksPlanId);
        setInitialPostedLinksPlanTitle(state.openPostedLinksPlanTitle || undefined);
        setInitialPostedLinksForceOpen(
          !!state.openPostedLinksForceOpen || !!state.openPostedLinksModal
        );
      } else {
        setInitialPostedLinksPlanId(undefined);
        setInitialPostedLinksPlanTitle(undefined);
        setInitialPostedLinksForceOpen(false);
      }
      navigate('.', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const userForPresence = useMemo(
    () =>
      user?.id
        ? { id: user.id, name: profile?.full_name ?? user.email ?? 'User' }
        : undefined,
    [user?.id, user?.email, profile?.full_name]
  );

  const { isConnected: presenceConnected, totalOnline } = useRealtimePresence(
    organizationId ?? '',
    userForPresence
  );

  const currentHour = new Date().getHours();
  const greetingKey = getGreetingKey(currentHour);
  const greeting = t(`home.greeting.${greetingKey}`, 'Hello');
  const displayName = profileLoading ? '...' : (profile?.full_name ?? t('mobileHome.user', 'User'));

  return (
    <DesktopWarning>
      <SidebarProvider>
        <HabitTrackerProvider>
          <div className="relative min-h-[100dvh] min-w-0 w-full bg-background">
            <AppSidebar />

            <main
              className="fixed inset-x-0 z-0 flex min-h-0 w-full max-w-none min-w-0 flex-col bg-background"
              style={mainFixedStyle}
            >
              <div className="flex min-h-0 flex-1 flex-col">
                <header className="flex-shrink-0 sticky top-0 z-30 flex items-center justify-between p-3 bg-card border-b border-border safe-area-top min-h-[3.25rem]">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <SidebarTrigger className="md:hidden shrink-0" />
                    <div className="min-w-0">
                      <p className="text-base font-bold text-foreground truncate leading-tight">
                        {greeting}
                      </p>
                      <p className="text-base font-light text-foreground truncate leading-tight">
                        {displayName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <RealtimeStatusIndicator
                      isConnected={presenceConnected}
                      onlineUsers={totalOnline}
                      className="text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen(true)}
                      className="relative p-2 hover:bg-muted rounded-lg transition-colors"
                      aria-label={t('mobileHome.notificationsTitle', 'Notifikasi')}
                    >
                      <Bell className="h-5 w-5 text-muted-foreground" />
                      {notificationBadgeCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-semibold">
                          {notificationBadgeCount > 99 ? '99+' : notificationBadgeCount}
                        </span>
                      )}
                    </button>
                  </div>
                </header>

                <ModuleShellContentGate
                  pagePath={MOBILE_PAGE_PATH.toolsHabitsTracker}
                  className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                  <HabitTrackerMobileContent />
                  <div className="pointer-events-none fixed right-4 z-40 flex justify-end bottom-[calc(3.25rem+env(safe-area-inset-bottom,0px)+0.75rem)] max-[380px]:right-3">
                    <Button
                      aria-label={t('habitTracker.addHabit', 'Tambah habit')}
                      onClick={() => setShowAddModal(true)}
                      className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      <Plus className="h-4 w-4" />
                      {t('habitTracker.addHabit', 'Tambah habit')}
                    </Button>
                  </div>
                </ModuleShellContentGate>

                <NavigationFooter className="safe-area-bottom-lower" />
              </div>
            </main>
          </div>
          <HabitFormModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
          <NotificationsModal
            open={notificationsOpen}
            onOpenChange={(open) => {
              if (!open) {
                setInitialNotificationsTab(undefined);
                setInitialPostedLinksPlanId(undefined);
                setInitialPostedLinksPlanTitle(undefined);
                setInitialPostedLinksForceOpen(false);
              }
              setNotificationsOpen(open);
            }}
            initialTab={initialNotificationsTab}
            initialPostedLinksPlanId={initialPostedLinksPlanId}
            initialPostedLinksPlanTitle={initialPostedLinksPlanTitle}
            initialPostedLinksForceOpen={initialPostedLinksForceOpen}
          />
        </HabitTrackerProvider>
      </SidebarProvider>
    </DesktopWarning>
  );
};

export default HabitTrackerMobilePage;
