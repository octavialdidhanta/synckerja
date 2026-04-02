import React from 'react';
import {
  MeetingFilters,
  MeetingPointsTable,
  MeetingSummaryCards,
  MeetingNotesInput,
  MeetingTableFooter,
  MeetingSidebarFooter
} from '../section';
import { MeetingNotesProvider, useMeetingNotes } from '../context/MeetingNotesContext';
import { matchesTimeFilter } from '../utils/meetingNotesFilters';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { MeetingNotesModuleShell } from '../layout/MeetingNotesModuleShell';

const MeetingNotesContent = () => {
  const { meetingPoints, filters, initialLoading } = useMeetingNotes();
  const showContent = useDebouncedReady(!initialLoading, 250);

  // Filter meeting points based on filters
  const filteredPoints = meetingPoints.filter(point => {
    if (filters.search && !(point.discussion_point ?? '').toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.status && point.status !== filters.status) {
      return false;
    }
    if (filters.requestBy && point.request_by !== filters.requestBy) {
      return false;
    }
    if (!matchesTimeFilter(point.meeting_date, filters.timeFilter)) {
      return false;
    }
    return true;
  });

  // Calculate statistics
  const thisMonthPoints = meetingPoints.filter(point => {
    const pointDate = new Date(point.meeting_date);
    const now = new Date();
    return pointDate.getMonth() === now.getMonth() && pointDate.getFullYear() === now.getFullYear();
  }).length;

  const completedPoints = meetingPoints.filter(point => point.status === 'Completed').length;
  const completionRate = meetingPoints.length > 0 ? Math.round((completedPoints / meetingPoints.length) * 100) : 0;

  return (
    <MeetingNotesModuleShell showContent={showContent}>
      {/* Main Content - 9 columns */}
      <div className="col-span-9 flex flex-col min-h-0">
        <div className="flex-1 min-h-0">
          <div className="h-full rounded-lg border border-brand-blue/20 bg-white shadow-sm ring-1 ring-brand-blue/10 flex flex-col">
            {/* Filters Section */}
            <div className="flex-shrink-0 px-4 py-2 border-b border-brand-blue/15 bg-brand-blue/5 flex items-center">
              <MeetingFilters />
            </div>

            {/* Input Section */}
            <div className="flex-shrink-0 p-3 border-b border-brand-blue/15 bg-gradient-to-r from-brand-blue/[0.04] to-transparent">
              <MeetingNotesInput />
            </div>

            {/* Single scroll container: inside MeetingPointsTable */}
            <div className="flex-1 min-h-0 p-4">
              <MeetingPointsTable />
            </div>

            {/* Table Footer */}
            <MeetingTableFooter
              totalMeetingPoints={meetingPoints.length}
              filteredPoints={filteredPoints.length}
            />
          </div>
        </div>
      </div>

      {/* Sidebar - 3 columns */}
      <div className="col-span-3 h-full flex flex-col min-h-0">
        <div className="bg-white border border-brand-blue/20 ring-1 ring-brand-blue/10 rounded-lg h-full flex flex-col min-h-0">
          {/* Sidebar Header */}
          <div className="px-4 py-1.5 border-b border-brand-blue/15 bg-brand-blue/5 flex-shrink-0">
            <h3 className="text-sm font-semibold text-brand-blue">Meeting Summary</h3>
            <p className="text-xs text-gray-600 mt-1">Overview of meeting points</p>
          </div>

          {/* Scrollable Sidebar Content */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain p-4">
            <MeetingSummaryCards />
          </div>

          {/* Sidebar Footer */}
          <MeetingSidebarFooter
            totalMeetings={meetingPoints.length}
            thisMonth={thisMonthPoints}
            completionRate={completionRate}
          />
        </div>
      </div>
    </MeetingNotesModuleShell>
  );
};

const MeetingNotesPage = () => {
  return (
    <MeetingNotesProvider>
      <MeetingNotesContent />
    </MeetingNotesProvider>
  );
};

export default MeetingNotesPage;




