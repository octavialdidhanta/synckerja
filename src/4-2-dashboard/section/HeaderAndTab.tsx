import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BarChart3, FileCheck, CreditCard, Bell, Receipt } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { prefetchAppRoute } from '@/shared/routing/prefetchAppRoute';

interface HeaderAndTabProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const HeaderAndTab = ({ activeTab, onTabChange }: HeaderAndTabProps) => {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    {
      id: 'dashboard',
      labelKey: 'expenses.tabs.dashboard',
      labelFallback: 'Dashboard',
      icon: BarChart3,
      route: '/expenses/dashboard',
    },
    {
      id: 'debt',
      labelKey: 'expenses.tabs.debt',
      labelFallback: 'Debt',
      icon: Receipt,
      route: '/expenses/debt',
    },
    {
      id: 'approvals',
      labelKey: 'expenses.tabs.approvals',
      labelFallback: 'Approvals',
      icon: FileCheck,
      route: '/expenses/approvals',
    },
    {
      id: 'payment-process',
      labelKey: 'expenses.tabs.paymentProcess',
      labelFallback: 'Payment Process',
      icon: CreditCard,
      route: '/expenses/payment-process',
    },
    {
      id: 'reminder-bills',
      labelKey: 'expenses.tabs.reminderBills',
      labelFallback: 'Reminder Bills',
      icon: Bell,
      route: '/expenses/reminder-bills',
    },
  ];

  const handleTabClick = (tab: any) => {
    if (tab.route) {
      navigate(tab.route);
    } else {
      onTabChange(tab.id);
    }
  };

  const getActiveTab = () => {
    if (location.pathname === '/expenses/reminder-bills') {
      return 'reminder-bills';
    }
    if (location.pathname === '/expenses/payment-process') {
      return 'payment-process';
    }
    if (location.pathname === '/expenses/approvals') {
      return 'approvals';
    }
    if (location.pathname === '/expenses/debt') {
      return 'debt';
    }
    if (location.pathname === '/expenses/dashboard') {
      return 'dashboard';
    }
    return 'dashboard';
  };

  return (
    <div className="px-1 py-3 min-w-0">
      <div className="mb-3 min-w-0">
        <h1 className="mb-0.5 truncate text-lg font-bold text-foreground sm:text-xl">
          {t('expenses.header.title', 'Expense Management')}
        </h1>
        <p className="truncate text-xs text-muted-foreground">
          {t(
            'expenses.header.subtitle',
            'Manage expense transactions, analytics, and financial records',
          )}
        </p>
      </div>

      <div className="-mb-3 min-w-0">
        <div className="sticky top-0 z-20 min-w-0 bg-muted/40">
        <nav className="flex min-w-0 space-x-2 overflow-x-auto seamless-scroll sm:space-x-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = getActiveTab() === tab.id;

            return (
              <div
                key={tab.id}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleTabClick(tab);
                  }
                }}
                onMouseEnter={() => prefetchAppRoute(tab.route)}
                onFocus={() => prefetchAppRoute(tab.route)}
                onClick={() => handleTabClick(tab)}
                className={`flex min-w-0 flex-shrink-0 cursor-pointer items-center space-x-1 whitespace-nowrap border-b-2 px-1 py-1.5 text-xs font-medium transition-colors sm:space-x-1.5 sm:px-2 sm:text-sm ${
                  isActive
                    ? 'border-brand-blue text-brand-blue'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                }`}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
              >
                <Icon className="h-3 w-3 flex-shrink-0 sm:h-4 sm:w-4" />
                <span className="truncate">{t(tab.labelKey, tab.labelFallback)}</span>
              </div>
            );
          })}
        </nav>
        </div>
      </div>
    </div>
  );
};

HeaderAndTab.displayName = 'HeaderAndTab';
