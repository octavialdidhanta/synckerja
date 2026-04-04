import { useSocialMediaContext } from '../context/SocialMediaContext';

/**
 * Optimized hook that provides direct access to centralized social media state
 * This replaces individual hooks and ensures all components use the same data source
 */
export const useOptimizedSocialMediaState = () => {
  const context = useSocialMediaContext();
  
  if (!context) {
    throw new Error('useOptimizedSocialMediaState must be used within SocialMediaProvider');
  }
  
  return context;
};

/**
 * Alias for useOptimizedSocialMediaState for backward compatibility
 */
export const useOptimizedSocialMedia = useOptimizedSocialMediaState;

/**
 * Hook for components that only need read access to social media data
 * This prevents unnecessary re-renders when mutation functions change
 */
export const useSocialMediaData = () => {
  const {
    contentPlans,
    contentTypes,
    services,
    subServices,
    contentPillars,
    meetingPoints,
    meetingPointUpdates,
    isLoading,
    error,
    organizationId,
    formatDisplayDate,
    getFilteredSubServices,
    getFilteredContentPlans
  } = useSocialMediaContext();
  
  return {
    contentPlans,
    contentTypes,
    services,
    subServices,
    contentPillars,
    meetingPoints,
    meetingPointUpdates,
    isLoading,
    error,
    organizationId,
    formatDisplayDate,
    getFilteredSubServices,
    getFilteredContentPlans
  };
};

/**
 * Hook for components that only need mutation access
 * This prevents unnecessary re-renders when data changes
 */
export const useSocialMediaMutations = () => {
  const {
    updateContentPlan,
    addContentPlan,
    deleteContentPlan,
    addMeetingPoint,
    updateMeetingPoint,
    deleteMeetingPoint,
    addMeetingPointUpdate,
    updateMeetingPointUpdate,
    refreshAll,
    refreshContentPlans,
    refreshMeetingPoints,
    refreshMasterData
  } = useSocialMediaContext();
  
  return {
    updateContentPlan,
    addContentPlan,
    deleteContentPlan,
    addMeetingPoint,
    updateMeetingPoint,
    deleteMeetingPoint,
    addMeetingPointUpdate,
    updateMeetingPointUpdate,
    refreshAll,
    refreshContentPlans,
    refreshMeetingPoints,
    refreshMasterData
  };
};

