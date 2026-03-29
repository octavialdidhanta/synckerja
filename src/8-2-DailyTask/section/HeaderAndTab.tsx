import React from 'react';
import { CheckSquare, FileText, Lock, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDepartmentAccess } from '@/shared/layouts/sidebar/useDepartmentAccess';

interface HeaderAndTabProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const HeaderAndTab = ({ activeTab, onTabChange }: HeaderAndTabProps) => {
  const navigate = useNavigate();
  const { canAccessPage } = useDepartmentAccess();
  
  const tabs = [
    { 
      id: 'daily-task', 
      label: 'Daily Task', 
      icon: CheckSquare,
      description: 'Manage your daily tasks and to-do lists',
      path: '/tools/daily-task'
    },
    {
      id: 'daily-task-report',
      label: 'Daily Task Report',
      icon: FileText,
      description: 'Analyze completed tasks, on-time performance, and delays',
      path: '/tools/daily-task-report'
    },
    {
      id: 'habits-tracker',
      label: 'Habits Tracker',
      icon: Target,
      description: 'Track your habits and build better routines',
      path: '/tools/habits-tracker'
    },
    { 
      id: 'meeting-notes', 
      label: 'Meeting Notes', 
      icon: FileText,
      description: 'Track and manage meeting discussions and action items',
      path: '/tools/meeting-notes'
    }
  ];

  const handleTabClick = (tab: any) => {
    onTabChange(tab.id);
    if (tab.path) {
      navigate(tab.path);
    }
  };

  return (
    <div className="px-1 py-3">
      {/* Header Section */}
      <div className="mb-3">
        <h1 className="text-xl font-bold text-gray-900 mb-0.5">Tools</h1>
        <p className="text-xs text-gray-600">Manage your daily tasks and productivity tools</p>
      </div>

      {/* Tabs Section */}
      <div className="-mb-3">
        <nav className="flex space-x-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isLocked = tab.path ? !canAccessPage(tab.path) : false;
            
            return (
              <div
                key={tab.id}
                onClick={() => {
                  if (!isLocked) {
                    handleTabClick(tab);
                  }
                }}
                className={`flex items-center space-x-1.5 py-1.5 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isLocked
                    ? 'border-transparent text-gray-400 cursor-not-allowed opacity-60'
                    : isActive
                    ? 'border-blue-500 text-blue-600 cursor-pointer'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 cursor-pointer'
                }`}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
                title={isLocked ? 'You do not have permission to access this tab' : tab.description}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {isLocked && (
                  <Lock className="w-3.5 h-3.5 ml-1" />
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

HeaderAndTab.displayName = 'HeaderAndTab';





