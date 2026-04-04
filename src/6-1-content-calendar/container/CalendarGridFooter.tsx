import React from 'react';
import { MasterDataToolbar } from '@/6-1-dashboard/container/master-data/MasterDataToolbar';
import { SocialMediaErrorBoundary } from '@/6-1-dashboard/hook/ErrorBoundary';

interface CalendarGridFooterProps {
  totalDays: number;
  activeDays: number;
  totalPosts: number;
  onContentTypeDataChange?: () => void;
  onServiceDataChange?: () => void;
  onContentPillarDataChange?: () => void;
  onSocialMediaNameDataChange?: () => void;
  services?: any[];
}

export const CalendarGridFooter = ({ 
  totalDays, 
  activeDays, 
  totalPosts,
  onContentTypeDataChange = () => {},
  onServiceDataChange = () => {},
  onContentPillarDataChange = () => {},
  onSocialMediaNameDataChange = () => {},
  services = []
}: CalendarGridFooterProps) => {
  return (
    <div className="flex-shrink-0 px-2 py-1 border-t border-gray-200 bg-gray-50">
      <SocialMediaErrorBoundary>
        <MasterDataToolbar 
          onContentTypeDataChange={onContentTypeDataChange} 
          onServiceDataChange={onServiceDataChange} 
          onContentPillarDataChange={onContentPillarDataChange} 
          onSocialMediaNameDataChange={onSocialMediaNameDataChange} 
          services={services} 
        />
      </SocialMediaErrorBoundary>
    </div>
  );
};

