import React from 'react';
import { Shield, Calendar, Sparkles, Image, Scan } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';

interface SettingsSidebarProps {
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
}

const settingsSections = [
  {
    id: 'approval-access',
    title: 'Approval Access Configuration',
    description: 'Configure who can perform approvals in different columns',
    icon: Shield,
    status: 'active'
  },
  {
    id: 'scheduling',
    title: 'Content Scheduling',
    description: 'Set up posting schedules and automation',
    icon: Calendar,
    status: 'active'
  },
  {
    id: 'script-ai',
    title: 'Script AI Generator',
    description: 'Google Gemini API & rate limit',
    icon: Sparkles,
    status: 'active'
  },
  {
    id: 'asset-digital',
    title: 'Digital Assets',
    description: 'Manage digital assets and media library',
    icon: Image,
    status: 'active'
  },
  {
    id: 'detect-from-image',
    titleKey: 'detectFromImage.sidebarTitle',
    descriptionKey: 'detectFromImage.sidebarDescription',
    icon: Scan,
    status: 'active'
  }
];

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeSection,
  onSectionChange
}) => {
  const { t } = useAppTranslation();
  return (
    <div className="space-y-2">
      {settingsSections.map((section) => {
        const IconComponent = section.icon;
        const isActive = activeSection === section.id;
        const title = 'titleKey' in section && section.titleKey ? t(section.titleKey, 'Detect from Image') : (section as { title?: string }).title ?? '';
        const description = 'descriptionKey' in section && section.descriptionKey ? t(section.descriptionKey, 'Analyze image: scene or character') : (section as { description?: string }).description ?? '';
        
        return (
          <button
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            type="button"
            className={cn(
              'group w-full rounded-[5px] p-3 text-left transition-all duration-200 ease-out',
              isActive
                ? 'border-2 border-primary/50 bg-accent shadow-sm'
                : 'border border-border bg-card hover:border-primary/30 hover:bg-muted/60'
            )}
          >
            <div className="flex items-start space-x-3">
              <div
                className={cn(
                  'flex-shrink-0 rounded-[5px] p-2 transition-colors duration-200',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                )}
              >
                <IconComponent className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="truncate text-sm font-medium text-foreground">{title}</h3>
                  <span
                    className={cn(
                      'ml-1 inline-flex flex-shrink-0 items-center rounded-full px-2 py-1 text-xs font-medium',
                      section.status === 'active'
                        ? 'bg-success-muted text-success-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {section.status}
                  </span>
                </div>
                <p
                  className={cn(
                    'text-xs leading-tight',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground/80'
                  )}
                >
                  {description}
                </p>
              </div>
            </div>
          </button>
        );
      })}

      {/* Real-time indicator */}
      <div className="mt-4 rounded-[5px] border border-primary/30 bg-primary/10 p-3">
        <div className="flex items-center space-x-2">
          <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary" aria-hidden />
          <span className="text-xs font-medium text-primary">Real-time Active</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Data otomatis terupdate saat ada perubahan
        </p>
      </div>
    </div>
  );
};
