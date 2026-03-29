import { useState, useEffect } from 'react';

interface WeekPeriod {
  start: string; // Format: "2025-10-24"
  end: string;   // Format: "2025-10-30"
  display: string; // Format: "24 Okt 2025 - 30 Okt 2025"
}

export const useWeekPeriod = (initialDate?: Date) => {
  const [weekPeriod, setWeekPeriod] = useState<WeekPeriod | null>(null);

  const getWeekPeriod = (date: Date): WeekPeriod => {
    // Get start of week (Monday)
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    
    // Get end of week (Sunday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    // Format dates
    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };
    
    const formatDisplay = (start: Date, end: Date) => {
      const startStr = start.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      const endStr = end.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      return `${startStr} - ${endStr}`;
    };
    
    return {
      start: formatDate(startOfWeek),
      end: formatDate(endOfWeek),
      display: formatDisplay(startOfWeek, endOfWeek)
    };
  };

  const setWeek = (date: Date) => {
    setWeekPeriod(getWeekPeriod(date));
  };

  const goToPreviousWeek = () => {
    if (weekPeriod) {
      const currentDate = new Date(weekPeriod.start);
      currentDate.setDate(currentDate.getDate() - 7);
      setWeek(currentDate);
    }
  };

  const goToNextWeek = () => {
    if (weekPeriod) {
      const currentDate = new Date(weekPeriod.start);
      currentDate.setDate(currentDate.getDate() + 7);
      setWeek(currentDate);
    }
  };

  const goToCurrentWeek = () => {
    setWeek(new Date());
  };

  useEffect(() => {
    if (initialDate) {
      setWeek(initialDate);
    } else {
      setWeek(new Date());
    }
  }, [initialDate]);

  return {
    weekPeriod,
    setWeek,
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
    getWeekPeriod
  };
};
