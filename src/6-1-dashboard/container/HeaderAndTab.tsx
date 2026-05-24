import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { prefetchAppRoute } from '@/shared/routing/prefetchAppRoute';
import { LayoutDashboard, Calendar, BookOpen, Settings, FileText, Lock } from 'lucide-react';
import { useHeaderTabPageAccess } from '@/shared/auth/page-access/useHeaderTabPageAccess';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';

interface HeaderAndTabProps {
  activeMainTab: string;
  handleTabChange: (newTab: string) => void;
}

export const HeaderAndTab = ({ activeMainTab, handleTabChange }: HeaderAndTabProps) => {
  const { t } = useAppTranslation();
  const { isTabLocked } = useHeaderTabPageAccess();
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      description: 'Social media dashboard and metrics',
      route: '/digital-marketing/social-media/dashboard'
    },
    {
      id: 'content-calendar',
      label: 'Content Calendar',
      icon: Calendar,
      description: 'Manage content calendar',
      route: '/digital-marketing/social-media/content-calendar'
    },
    {
      id: 'product-knowledge',
      label: 'Creative',
      icon: BookOpen,
      description: 'Manage creative',
      route: '/digital-marketing/social-media/product-knowledge'
    },
    {
      id: 'script-generator',
      label: 'Customer Persona',
      icon: FileText,
      description: 'Generate marketing scripts',
      route: '/digital-marketing/social-media/script-generator'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      description: 'Social media settings',
      route: '/digital-marketing/social-media/settings'
    }
  ];

  const handleTabClick = (tab: any) => {
    handleTabChange(tab.id);
    if (tab.route) {
      navigate(tab.route);
    }
  };

  const getActiveTab = () => {
    if (location.pathname.includes('content-calendar')) {
      return 'content-calendar';
    }
    if (location.pathname.includes('product-knowledge')) {
      return 'product-knowledge';
    }
    if (location.pathname.includes('script-generator')) {
      return 'script-generator';
    }
    if (location.pathname.includes('settings')) {
      return 'settings';
    }
    return 'dashboard';
  };

  return (
    <div className="px-1 py-3">
      {/* Header Section */}
      <div className="mb-3">
        <h1 className="text-xl font-bold text-gray-900 mb-0.5">Social Media Management</h1>
        <p className="text-xs text-gray-600">Manage social media content and calendar</p>
      </div>

      {/* Tabs Section */}
      <div className="-mb-3">
        <nav className="flex space-x-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = getActiveTab() === tab.id;
            const locked = isTabLocked(tab.route);

            return (
              <div
                key={tab.id}
                onMouseEnter={() => prefetchAppRoute(tab.route)}
                onFocus={() => prefetchAppRoute(tab.route)}
                onClick={() => handleTabClick(tab)}
                title={
                  locked
                    ? t('accessDenied.message', 'You do not have permission to view this page.')
                    : tab.description
                }
                className={cn(
                  'flex cursor-pointer items-center space-x-1.5 border-b-2 px-1 py-1.5 text-sm font-medium transition-colors',
                  locked
                    ? 'border-transparent text-muted-foreground opacity-60'
                    : isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                )}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {locked ? <Lock className="ml-1 h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

HeaderAndTab.displayName = 'HeaderAndTab';
