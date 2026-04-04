import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, BookOpen, Settings, FileText } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';

interface HeaderAndTabProps {
  activeMainTab: string;
  handleTabChange: (newTab: string) => void;
  /** Tanpa padding bawah / margin negatif tabs — konten route menyambung rapat di bawah tab */
  flushBottom?: boolean;
}

export const HeaderAndTab = ({ activeMainTab, handleTabChange, flushBottom }: HeaderAndTabProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useAppTranslation();

  const tabs = [
    {
      id: 'dashboard',
      label: t('productKnowledge.tabs.dashboard', 'Dashboard'),
      icon: LayoutDashboard,
      description: t('productKnowledge.tabs.dashboardDescription', 'Social media dashboard and metrics'),
      route: '/digital-marketing/social-media/dashboard'
    },
    {
      id: 'content-calendar',
      label: t('productKnowledge.tabs.contentCalendar', 'Content Calendar'),
      icon: Calendar,
      description: t('productKnowledge.tabs.contentCalendarDescription', 'Manage content calendar'),
      route: '/digital-marketing/social-media/content-calendar'
    },
    {
      id: 'product-knowledge',
      label: t('productKnowledge.tabs.productKnowledge', 'Product Knowledge'),
      icon: BookOpen,
      description: t('productKnowledge.tabs.productKnowledgeDescription', 'Manage product knowledge'),
      route: '/digital-marketing/social-media/product-knowledge'
    },
    {
      id: 'script-generator',
      label: t('productKnowledge.tabs.scriptGenerator', 'Customer Persona'),
      icon: FileText,
      description: t('productKnowledge.tabs.scriptGeneratorDescription', 'Generate marketing scripts'),
      route: '/digital-marketing/social-media/script-generator'
    },
    {
      id: 'settings',
      label: t('productKnowledge.tabs.settings', 'Settings'),
      icon: Settings,
      description: t('productKnowledge.tabs.settingsDescription', 'Social media settings'),
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
    <div className={cn('px-1', flushBottom ? 'pt-3 pb-0' : 'py-3')}>
      {/* Header Section */}
      <div className="mb-3">
        <h1 className="text-xl font-bold text-gray-900 mb-0.5">{t('productKnowledge.header.title', 'Social Media Management')}</h1>
        <p className="text-xs text-gray-600">{t('productKnowledge.header.subtitle', 'Manage social media content and calendar')}</p>
      </div>

      {/* Tabs Section */}
      <div className={flushBottom ? '' : '-mb-3'}>
        <nav className="flex space-x-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = getActiveTab() === tab.id;
            
            return (
              <div
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`flex items-center space-x-1.5 py-1.5 px-1 border-b-2 font-medium text-sm cursor-pointer transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

HeaderAndTab.displayName = 'HeaderAndTab';
