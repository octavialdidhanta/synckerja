import { useNavigate, useLocation } from 'react-router-dom';
import { prefetchAppRoute } from '@/shared/routing/prefetchAppRoute';
import { BarChart3, Receipt, CircleDollarSign, Lock } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useHeaderTabPageAccess } from '@/shared/auth/page-access/useHeaderTabPageAccess';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface HeaderAndTabProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const HeaderAndTab = ({ onTabChange }: HeaderAndTabProps) => {
  const { t } = useAppTranslation();
  const { isTabLocked } = useHeaderTabPageAccess();
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    {
      id: 'dashboard',
      label: 'Income Dashboard',
      icon: BarChart3,
      description: 'View income analytics, metrics, and trends',
      route: '/incomes/dashboard',
    },
    {
      id: 'transaction',
      label: 'Income Transaction',
      icon: Receipt,
      description: 'Manage income transactions and records',
      route: '/incomes/transaction',
    },
    {
      id: 'piutang',
      label: 'Piutang',
      icon: CircleDollarSign,
      description: 'Piutang dari aktivitas penjualan',
      route: '/incomes/piutang',
    },
  ];

  const handleTabClick = (tab: (typeof tabs)[number]) => {
    if (tab.route) {
      navigate(tab.route);
    } else {
      onTabChange?.(tab.id);
    }
  };

  const getActiveTab = () => {
    if (location.pathname === '/incomes/transaction' || location.pathname.startsWith('/incomes/transaction/')) {
      return 'transaction';
    }
    if (location.pathname === '/incomes/piutang') {
      return 'piutang';
    }
    if (location.pathname === '/incomes/dashboard') {
      return 'dashboard';
    }
    return 'dashboard';
  };

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-foreground">Income Management</h1>
        <p className="text-xs text-muted-foreground">
          Manage income transactions, analytics, and financial records
        </p>
      </div>

      <div className="-mb-3">
        <nav className="flex flex-wrap gap-x-6 gap-y-1" aria-label="Income sections">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = getActiveTab() === tab.id;
            const locked = isTabLocked(tab.route);

            return (
              <button
                key={tab.id}
                type="button"
                onMouseEnter={() => tab.route && prefetchAppRoute(tab.route)}
                onFocus={() => tab.route && prefetchAppRoute(tab.route)}
                onClick={() => handleTabClick(tab)}
                title={
                  locked
                    ? t('accessDenied.message', 'You do not have permission to view this page.')
                    : undefined
                }
                className={cn(
                  'flex cursor-pointer items-center space-x-1.5 border-b-2 px-1 py-1.5 text-sm font-medium transition-colors',
                  locked
                    ? 'border-transparent text-muted-foreground opacity-60'
                    : isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {locked ? <Lock className="ml-1 h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

HeaderAndTab.displayName = 'HeaderAndTab';
