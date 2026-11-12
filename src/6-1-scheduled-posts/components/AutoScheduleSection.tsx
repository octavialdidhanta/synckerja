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
  nativeAppLayout?: boolean;
};

export function AutoScheduleSection({
  reelEligible,
  tiktokCarouselOnly = false,
  tiktokReady = false,
  carouselPreviewUrls,
  nativeAppLayout = false,
  ...rest
}: Props) {
  return (
    <UnifiedAutoScheduleSection
      {...rest}
      nativeAppLayout={nativeAppLayout}
      eligible={reelEligible || tiktokCarouselOnly}
      tiktokCarouselOnly={tiktokCarouselOnly}
      tiktokReady={tiktokReady}
      carouselPreviewUrls={carouselPreviewUrls}
    />
  );
}
