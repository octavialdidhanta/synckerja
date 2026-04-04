import React from 'react';
import { ReminderTab } from './ReminderTab';
import { SocialMediaErrorBoundary } from '../../hook/ErrorBoundary';

interface SidebarContainerProps {
  selectedMonth?: Date;
  serviceFilter?: string;
}

export const SidebarContainer: React.FC<SidebarContainerProps> = ({ selectedMonth, serviceFilter }) => {
  return (
    <SocialMediaErrorBoundary>
      <ReminderTab selectedMonth={selectedMonth} serviceFilter={serviceFilter} />
    </SocialMediaErrorBoundary>
  );
};
