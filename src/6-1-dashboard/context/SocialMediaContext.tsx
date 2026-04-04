/* @refresh reset */
import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { devLog } from '@/shared/lib/logger';
import { useOptimizedSocialMediaData } from '../hook/useOptimizedSocialMediaData';
import { useOptimizedSocialMediaMutations } from '../hook/useOptimizedSocialMediaMutations';
// import { useMeetingPointsData } from '@/hooks/social-media/useMeetingPointsData'; // Commented out - not available
// import { useMeetingPointsMutations } from '@/hooks/social-media/useMeetingPointsMutations'; // Commented out - not available
import { ContentPlan } from '../types/social-media';
// import { MeetingPoint, MeetingPointUpdate } from '@/types/meeting-points'; // Commented out - not available

interface SocialMediaContextType {
  // Social Media Data
  contentPlans: ContentPlan[];
  contentTypes: any[];
  services: any[];
  subServices: any[];
  contentPillars: any[];
  
  // Meeting Points Data
  meetingPoints: any[]; // Commented out - MeetingPoint type not available
  meetingPointUpdates: any[]; // Commented out - MeetingPointUpdate type not available
  
  // Loading states
  isLoading: boolean;
  error: any;
  
  // Mutations
  updateContentPlan: (id: string, updates: Partial<ContentPlan>) => void;
  addContentPlan: (newPlan: Partial<ContentPlan>) => void;
  deleteContentPlan: (id: string) => void;
  
  addMeetingPoint: (data: any) => void;
  updateMeetingPoint: (id: string, updates: any) => void;
  deleteMeetingPoint: (id: string) => void;
  
  addMeetingPointUpdate: (data: any) => void;
  updateMeetingPointUpdate: (id: string, updates: any) => void;
  
  // Helper functions
  formatDisplayDate: (date: string | Date) => string;
  getFilteredSubServices: (serviceId: string) => any[];
  getFilteredContentPlans: (searchTerm: string, statusFilter: string) => ContentPlan[];
  
  // Refresh functions
  refreshAll: () => Promise<void>;
  refreshContentPlans: () => Promise<void>;
  refreshMeetingPoints: () => Promise<void>;
  refreshMasterData: () => Promise<void>;
  
  // Organization data
  organizationId: string | undefined;
}

const SocialMediaContext = createContext<SocialMediaContextType | undefined>(undefined);

export const SocialMediaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  
  // Social Media Data - ALWAYS call these hooks unconditionally
  const {
    contentPlans,
    contentTypes,
    services,
    subServices,
    contentPillars,
    isLoading: socialMediaLoading,
    error: socialMediaError,
    organizationId,
    invalidateContentPlans,
    invalidateMasterData
  } = useOptimizedSocialMediaData();
  
  
  // Meeting Points Data - ALWAYS call these hooks unconditionally
  const {
    meetingPoints,
    meetingPointUpdates,
    isLoading: meetingPointsLoading,
    error: meetingPointsError,
    invalidateMeetingPoints,
    invalidateMeetingPointUpdates
  } = { meetingPoints: [], meetingPointUpdates: [], isLoading: false, error: null, invalidateMeetingPoints: () => {}, invalidateMeetingPointUpdates: () => {} };
  
  // Social Media Mutations
  const {
    updateContentPlan,
    addContentPlan,
    deleteContentPlan
  } = useOptimizedSocialMediaMutations();
  
  // Meeting Points Mutations
  const {
    addMeetingPoint,
    updateMeetingPoint,
    deleteMeetingPoint,
    addMeetingPointUpdate,
    updateMeetingPointUpdate
  } = { addMeetingPoint: () => {}, updateMeetingPoint: () => {}, deleteMeetingPoint: () => {}, addMeetingPointUpdate: () => {}, updateMeetingPointUpdate: () => {} };
  
  // Combined loading and error states
  const isLoading = socialMediaLoading || meetingPointsLoading;
  const error = socialMediaError || meetingPointsError;
  
  // Helper functions
  const formatDisplayDate = useCallback((date: string | Date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }, []);
  
  const getFilteredSubServices = useCallback((serviceId: string) => {
    return subServices.filter(subService => subService.service_id === serviceId);
  }, [subServices]);
  
  const getFilteredContentPlans = useCallback((searchTerm: string, statusFilter: string) => {
    return (contentPlans as any[]).filter((plan: any) => {
      const matchesSearch = !searchTerm || 
        plan.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plan.brief?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || plan.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [contentPlans]);
  
  // Smart refresh functions
  const refreshAll = useCallback(async () => {
    devLog.debug('Refreshing all social media data');
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['social-media-plans', organizationId] }),
      queryClient.invalidateQueries({ queryKey: ['social-media-master', organizationId] }),
      queryClient.invalidateQueries({ queryKey: ['meeting-points', organizationId] }),
      queryClient.invalidateQueries({ queryKey: ['meeting-point-updates', organizationId] })
    ]);
  }, [queryClient, organizationId]);
  
  const refreshContentPlans = useCallback(async () => {
    devLog.debug('Refreshing content plans');
    await invalidateContentPlans();
  }, [invalidateContentPlans]);
  
  const refreshMeetingPoints = useCallback(async () => {
    devLog.debug('Refreshing meeting points');
    await Promise.all([
      invalidateMeetingPoints(),
      invalidateMeetingPointUpdates()
    ]);
  }, [invalidateMeetingPoints, invalidateMeetingPointUpdates]);
  
  const refreshMasterData = useCallback(async () => {
    devLog.debug('Refreshing master data (content types, services, etc.)');
    await invalidateMasterData();
  }, [invalidateMasterData]);
  
  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    // Data
    contentPlans,
    contentTypes,
    services,
    subServices,
    contentPillars,
    meetingPoints,
    meetingPointUpdates,
    
    // States
    isLoading,
    error,
    organizationId,
    
    // Mutations
    updateContentPlan,
    addContentPlan,
    deleteContentPlan,
    addMeetingPoint,
    updateMeetingPoint,
    deleteMeetingPoint,
    addMeetingPointUpdate,
    updateMeetingPointUpdate,
    
    // Helper functions
    formatDisplayDate,
    getFilteredSubServices,
    getFilteredContentPlans,
    
    // Refresh functions
    refreshAll,
    refreshContentPlans,
    refreshMeetingPoints,
    refreshMasterData
  }), [
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
    updateContentPlan,
    addContentPlan,
    deleteContentPlan,
    addMeetingPoint,
    updateMeetingPoint,
    deleteMeetingPoint,
    addMeetingPointUpdate,
    updateMeetingPointUpdate,
    formatDisplayDate,
    getFilteredSubServices,
    getFilteredContentPlans,
    refreshAll,
    refreshContentPlans,
    refreshMeetingPoints,
    refreshMasterData
  ]);
  
  return (
    <SocialMediaContext.Provider value={contextValue}>
      {children}
    </SocialMediaContext.Provider>
  );
};

export const useSocialMediaContext = () => {
  const context = useContext(SocialMediaContext);
  if (context === undefined) {
    throw new Error('useSocialMediaContext must be used within a SocialMediaProvider');
  }
  return context;
};