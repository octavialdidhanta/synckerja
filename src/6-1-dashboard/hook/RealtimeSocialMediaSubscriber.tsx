
import React from 'react';
import { useRealtimeSocialMedia } from './useRealtimeSocialMedia';

interface RealtimeSocialMediaSubscriberProps {
  children: React.ReactNode;
}

/**
 * Component that subscribes to real-time updates
 * Must be used within SocialMediaProvider
 */
export const RealtimeSocialMediaSubscriber: React.FC<RealtimeSocialMediaSubscriberProps> = ({ 
  children 
}) => {
  // Setup realtime subscriptions - this hook needs SocialMediaProvider context
  useRealtimeSocialMedia();

  return <>{children}</>;
};

