import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, BookOpen, Settings, FileText } from 'lucide-react';

interface HeaderAndTabProps {
  activeMainTab: string;
  handleTabChange: (newTab: string) => void;
}

export const HeaderAndTab = ({ activeMainTab, handleTabChange }: HeaderAndTabProps) => {
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
      label: 'Product Knowledge',
      icon: BookOpen,
      description: 'Manage product knowledge',
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
