import React from 'react';
import { Plus, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DesktopWarning } from '@/mobile/components/DesktopWarning';
import { SidebarProvider, SidebarTrigger } from '@/mobile/components/ui/sidebar';
import { AppSidebar } from '@/mobile/components/AppSidebar';
import { NavigationFooter } from '@/mobile/components/NavigationFooter';
import { useVisualViewport } from '@/mobile/hooks/useVisualViewport';
import { useStatusBarStyle } from '@/mobile/hooks/useStatusBarStyle';
import { HabitTrackerProvider } from '@/features/8-2-HabitTracker/context/HabitTrackerContext';
import { HabitFormModal } from '@/features/8-2-HabitTracker/components/HabitFormModal';
import { HabitTrackerMobileContent } from './section/HabitTrackerMobileContent';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
import { Button } from '@/features/ui/button';

const HabitTrackerMobilePage = () => {
  const navigate = useNavigate();
  useStatusBarStyle('light');
  const { mainFixedStyle } = useVisualViewport();
  const { t } = useAppTranslation();
  const [showAddModal, setShowAddModal] = React.useState(false);

  return (
    <DesktopWarning>
      <SidebarProvider>
        <HabitTrackerProvider>
          <div className="min-h-screen flex w-full bg-background">
            <AppSidebar />

              <main className="flex flex-col bg-background fixed inset-x-0 z-0" style={mainFixedStyle}>
              <header className="flex-shrink-0 sticky top-0 z-30 flex items-center justify-between p-3 bg-card border-b border-border safe-area-top">
                <div className="flex items-center gap-2 min-w-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 flex-shrink-0 md:hidden"
                    onClick={() => navigate('/')}
                    aria-label={t('common.backToHome', 'Kembali ke Home')}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <SidebarTrigger className="hidden md:flex" />
                  <div className="min-w-0">
                    <h1 className="text-base font-semibold text-foreground">{t('habitTracker.pageTitle', 'Habit Tracker')}</h1>
                    <p className="text-xs text-muted-foreground">{t('habitTracker.pageSubtitle', 'Kelola kebiasaan harian')}</p>
                  </div>
                </div>
              </header>

              <div className="flex-1 min-h-0 overflow-hidden flex flex-col relative">
                <HabitTrackerMobileContent />
                <div className="pointer-events-none fixed left-0 right-0 z-50 flex justify-end px-6 fixed-above-nav-safe">
                  <Button
                    aria-label={t('habitTracker.addHabit', 'Tambah habit')}
                    onClick={() => setShowAddModal(true)}
                    className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <Plus className="h-4 w-4" />
                    {t('habitTracker.addHabit', 'Tambah habit')}
                  </Button>
                </div>
              </div>

              <NavigationFooter className="safe-area-bottom-lower" />
            </main>
          </div>
          <HabitFormModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
        </HabitTrackerProvider>
      </SidebarProvider>
    </DesktopWarning>
  );
};

export default HabitTrackerMobilePage;
