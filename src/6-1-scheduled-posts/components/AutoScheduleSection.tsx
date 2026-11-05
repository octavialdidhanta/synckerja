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
  tiktokCarouselOnly?: boolean;
  tiktokReady?: boolean;
  carouselPreviewUrls?: string[];
  serviceId?: string | null;
  requiredPlatforms: ServiceRequiredPlatform[];
  headerTitle?: React.ReactNode;
  headerExtra?: React.ReactNode;
};

export function AutoScheduleSection({
  reelEligible,
  tiktokCarouselOnly = false,
  tiktokReady = false,
  carouselPreviewUrls,
  ...rest
}: Props) {
  return (
    <UnifiedAutoScheduleSection
      {...rest}
      eligible={reelEligible || tiktokCarouselOnly}
      tiktokCarouselOnly={tiktokCarouselOnly}
      tiktokReady={tiktokReady}
      carouselPreviewUrls={carouselPreviewUrls}
    />
  );
}
