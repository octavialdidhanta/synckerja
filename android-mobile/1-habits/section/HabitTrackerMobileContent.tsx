import React, { useState, useRef, useEffect } from 'react';
import { useHabitTracker } from '@/features/8-2-HabitTracker/context/HabitTrackerContext';
import { ConsistencyRateCard } from './ConsistencyRateCard';
import { HabitGridMobile } from './HabitGridMobile';
import { LoadingDots } from '@/shared/components/LoadingDots';

export const HabitTrackerMobileContent = () => {
  const { loading, refreshData, filteredHabits } = useHabitTracker();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const didRecoveryRefetch = useRef(false);

  // Recovery: refetch sekali jika load awal selesai tapi daftar masih kosong
  useEffect(() => {
    if (didRecoveryRefetch.current || loading || filteredHabits.length > 0) return;
    didRecoveryRefetch.current = true;
    refreshData().catch(() => {});
  }, [loading, filteredHabits.length, refreshData]);

  const scrollClassName =
    'scrollbar-hide flex-1 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain min-h-0 flex flex-col [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

  if (loading) {
    return (
      <div className={scrollClassName}>
        <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-habits space-y-1">
          <div className="bg-card rounded-lg border border-border p-6 flex items-center justify-center">
            <LoadingDots size="lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={scrollClassName}>
      <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-habits space-y-1">
        <ConsistencyRateCard currentMonth={currentMonth} />
        <HabitGridMobile currentMonth={currentMonth} onMonthChange={setCurrentMonth} />
      </div>
    </div>
  );
};
