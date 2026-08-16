import { useMemo } from 'react';
import { startOfMonth } from 'date-fns';
import { useOptimizedSocialMedia } from './useOptimizedSocialMediaState';
import {
  calculateContentBalance,
  calculatePICProductionStats,
} from '../lib/contentBalance';

export function useContentBalanceStats(selectedMonth?: Date, serviceFilter?: string) {
  const month = useMemo(
    () => selectedMonth ?? startOfMonth(new Date()),
    [selectedMonth],
  );
  const { contentPlans, contentTypes, isLoading, error } = useOptimizedSocialMedia();

  const contentBalance = useMemo(
    () => calculateContentBalance(contentPlans, contentTypes, month, serviceFilter),
    [contentPlans, contentTypes, month, serviceFilter],
  );

  const picProductionStats = useMemo(
    () => calculatePICProductionStats(contentPlans, contentTypes, month, serviceFilter),
    [contentPlans, contentTypes, month, serviceFilter],
  );

  return {
    selectedMonth: month,
    contentBalance,
    picProductionStats,
    isLoading,
    error,
  };
}
