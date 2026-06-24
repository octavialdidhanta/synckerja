import React from 'react';
import type { ServiceRequiredPlatform } from '@/6-1-dashboard/hook/useServiceRequiredPlatforms';
import { UnifiedAutoScheduleSection } from './UnifiedAutoScheduleSection';

type Props = {
  organizationId: string;
  planId: string;
  planTitle: string | null;
  postDate: string | null;
  caption: string;
  onCaptionChange: (value: string) => void;
  googleDriveLink?: string | null;
  employeeId?: string;
  reelEligible: boolean;
  serviceId?: string | null;
  requiredPlatforms: ServiceRequiredPlatform[];
};

export function AutoScheduleSection({ reelEligible, ...rest }: Props) {
  return <UnifiedAutoScheduleSection {...rest} eligible={reelEligible} />;
}
