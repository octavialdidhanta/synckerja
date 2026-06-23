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
import {
  MEETING_NOTES_MAIN_GRID,
  MEETING_NOTES_SIDEBAR_CARD,
  MEETING_NOTES_TABLE_CARD,
  MEETING_NOTES_TABLE_SECTION,
} from '../layout/meetingNotesLayout';

const MeetingNotesContent = () => {
  const { meetingPoints, filters, initialLoading } = useMeetingNotes();
  const showContent = useDebouncedReady(!initialLoading, 250);

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

  const thisMonthPoints = meetingPoints.filter(point => {
    const pointDate = new Date(point.meeting_date);
    const now = new Date();
    return pointDate.getMonth() === now.getMonth() && pointDate.getFullYear() === now.getFullYear();
  }).length;

  const completedPoints = meetingPoints.filter(point => point.status === 'Completed').length;
  const completionRate = meetingPoints.length > 0 ? Math.round((completedPoints / meetingPoints.length) * 100) : 0;

  return (
    <MeetingNotesModuleShell showContent={showContent}>
      <div className={MEETING_NOTES_MAIN_GRID}>
        <div className="col-span-9 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            <div className="mb-2 flex-shrink-0">
              <div className="flex shrink-0 items-center rounded-md border border-brand-blue/20 bg-white px-4 py-2 ring-1 ring-brand-blue/10">
                <MeetingFilters />
              </div>
            </div>

            <div className="mb-2 flex-shrink-0">
              <div className="shrink-0 rounded-md border border-brand-blue/20 bg-white p-3 ring-1 ring-brand-blue/10">
                <MeetingNotesInput />
              </div>
            </div>

            <div className={MEETING_NOTES_TABLE_SECTION}>
              <div className={MEETING_NOTES_TABLE_CARD}>
                <MeetingPointsTable />
                <MeetingTableFooter
                  totalMeetingPoints={meetingPoints.length}
                  filteredPoints={filteredPoints.length}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-3 flex h-full min-h-0 min-w-0 flex-col self-stretch">
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            <div className={MEETING_NOTES_SIDEBAR_CARD}>
              <div className="flex-shrink-0 border-b border-brand-blue/15 bg-brand-blue/5 px-4 py-1.5">
                <h3 className="text-sm font-semibold text-brand-blue">Meeting Summary</h3>
                <p className="mt-1 text-xs text-gray-600">Overview of meeting points</p>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden">
                <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden p-4 seamless-scroll nested-scroll-touch-chain">
                  <MeetingSummaryCards />
                </div>
              </div>

              <MeetingSidebarFooter
                totalMeetings={meetingPoints.length}
                thisMonth={thisMonthPoints}
                completionRate={completionRate}
              />
            </div>
          </div>
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
