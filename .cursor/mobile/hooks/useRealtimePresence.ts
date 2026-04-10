import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/config/logger';

interface UserPresence {
  user_id: string;
  full_name: string;
  online_at: string;
  status: 'online' | 'away' | 'busy';
  page?: string;
}

export const useRealtimePresence = (organizationId: string, currentUser?: { id: string; name: string }) => {
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!organizationId || !currentUser) return;

    const channel = supabase.channel(`organization-${organizationId}`);
    channelRef.current = channel;

    // Track current user presence
    const userStatus: UserPresence = {
      user_id: currentUser.id,
      full_name: currentUser.name,
      online_at: new Date().toISOString(),
      status: 'online',
      page: window.location.pathname
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        logger.debug('Presence sync:', newState);
        
        const users: UserPresence[] = [];
        Object.values(newState).forEach((presences: any) => {
          presences.forEach((presence: UserPresence) => {
            users.push(presence);
          });
        });
        
        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        logger.debug('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        logger.debug('User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        logger.debug('Presence status:', status);
        setIsConnected(status === 'SUBSCRIBED');

        if (status === 'SUBSCRIBED') {
          const presenceTrackStatus = await channel.track(userStatus);
          logger.debug('Tracking presence:', presenceTrackStatus);
        }
      });

    // Update presence when page changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        channel.track({ ...userStatus, status: 'away' });
      } else {
        channel.track({ ...userStatus, status: 'online', online_at: new Date().toISOString() });
      }
    };

    // Update presence when page location changes
    const handlePageChange = () => {
      channel.track({ ...userStatus, page: window.location.pathname, online_at: new Date().toISOString() });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('popstate', handlePageChange);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('popstate', handlePageChange);
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsConnected(false);
      setOnlineUsers([]);
    };
    // Use primitive deps to avoid re-subscribing when parent re-creates currentUser object reference
  }, [organizationId, currentUser?.id]);

  const updateStatus = (status: 'online' | 'away' | 'busy') => {
    if (!currentUser) return;
    const ch = channelRef.current;
    if (!ch) return;
    ch.track({
      user_id: currentUser.id,
      full_name: currentUser.name,
      online_at: new Date().toISOString(),
      status,
      page: window.location.pathname
    });
  };

  return {
    onlineUsers,
    isConnected,
    updateStatus,
    totalOnline: onlineUsers.length,
    currentUserStatus: onlineUsers.find(u => u.user_id === currentUser?.id)?.status || 'offline'
  };
};