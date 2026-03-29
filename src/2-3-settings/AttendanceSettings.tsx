
import React from 'react';
import { AttendanceSettingsLayout } from './AttendanceSettingsLayout';
import { AttendanceErrorBoundary } from './AttendanceErrorBoundary';

const AttendanceSettings = () => {
  return (
    <AttendanceErrorBoundary>
      <AttendanceSettingsLayout />
    </AttendanceErrorBoundary>
  );
};

export default AttendanceSettings;
