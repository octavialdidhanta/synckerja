import React from 'react';
import { useMeetingNotes } from '@/8-1-meeting-notes/context/MeetingNotesContext';
import MeetingFilters from './MeetingFilters';
import MeetingNotesInput from './MeetingNotesInput';
import MeetingPointsTable from './MeetingPointsTable';
import MeetingSummaryCards from './MeetingSummaryCards';
import { MeetingTableFooter } from './MeetingTableFooter';

/** Returns true if meeting_date (YYYY-MM-DD) falls within the given timeFilter. */
function matchesTimeFilter(meetingDateStr: string, timeFilter: string): boolean {
  if (!timeFilter) return true;
  const d = new Date(meetingDateStr);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const meetingTime = dateOnly.getTime();

  switch (timeFilter) {
    case 'Today':
      return meetingTime === todayStart;
    case 'Yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      return meetingTime === yesterday.getTime();
    }
    case 'This Week': {
      const dayOfWeek = today.getDay();
      const sunday = new Date(today);
      sunday.setDate(today.getDate() - dayOfWeek);
      sunday.setHours(0, 0, 0, 0);
      const saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);
      saturday.setHours(23, 59, 59, 999);
      return meetingTime >= sunday.getTime() && meetingTime <= saturday.getTime();
    }
    case 'This Month':
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    case 'Last Month': {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      return meetingTime >= lastMonth.getTime() && meetingTime <= lastMonthEnd.getTime() + 86400000 - 1;
    }
    default:
      return true;
  }
}

export const MeetingNotesContent = () => {
  const { meetingPoints, filters } = useMeetingNotes();

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
    if (filters.timeFilter && !matchesTimeFilter(point.meeting_date, filters.timeFilter)) {
      return false;
    }
    return true;
  });

  return (
    <div className="mx-auto w-full max-w-md shrink-0 space-y-1 px-2 pt-2 content-padding-above-nav-meeting-notes">
      {/* Filters Section */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-2.5 py-1.5 border-b border-border">
          <MeetingFilters />
        </div>

        {/* Input Section */}
        <div className="px-2.5 py-1.5 border-b border-border">
          <MeetingNotesInput />
        </div>

        {/* Table — satu scroll halaman (§1.1 mobile-tools-layout-android): tidak nested overflow-y dengan area scroll utama */}
        <div className="px-2 py-2">
          <MeetingPointsTable points={filteredPoints} />
        </div>

        {/* Table Footer */}
        <div className="border-t border-border">
          <MeetingTableFooter 
            totalMeetingPoints={meetingPoints.length} 
            filteredPoints={filteredPoints.length} 
          />
        </div>
      </div>

      {/* Summary Cards Section */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="px-2.5 py-2.5">
          <MeetingSummaryCards />
        </div>
      </div>
    </div>
  );
};

