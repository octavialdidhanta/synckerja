import React, { memo } from 'react';
import { ReminderTab } from './ReminderTab';
import { SocialMediaErrorBoundary } from '../../hook/ErrorBoundary';

interface SidebarContainerProps {
  selectedMonth?: Date;
  serviceFilter?: string;
}

export const SidebarContainer = memo(function SidebarContainer({ selectedMonth, serviceFilter }: SidebarContainerProps) {
  return (
    <SocialMediaErrorBoundary>
      <ReminderTab selectedMonth={selectedMonth} serviceFilter={serviceFilter} />
    </SocialMediaErrorBoundary>
  );
});
