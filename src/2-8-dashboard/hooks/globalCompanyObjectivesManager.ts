import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * 🌐 GLOBAL COMPANY OBJECTIVES SUBSCRIPTION MANAGER
 * 
 * Manages a single real-time subscription for company objectives
 * across ALL components and hooks.
 * 
 * Features:
 * - ✅ Single subscription for entire app
 * - ✅ Reference counting (auto cleanup when no subscribers)
 * - ✅ Automatic reconnection
 * - ✅ Works across all provider instances
 */

class GlobalCompanyObjectivesManager {
  private channel: RealtimeChannel | null = null;
  private subscriberCount: number = 0;
  private currentOrgId: string | null = null;
  private queryClient: QueryClient | null = null;

  /**
   * Subscribe to company objectives real-time updates
   * Returns unsubscribe function
   */
  subscribe(organizationId: string, queryClient: QueryClient): () => void {
    const isDev = import.meta.env?.DEV;

    // Store query client
    if (!this.queryClient) {
      this.queryClient = queryClient;
    }

    // If already subscribed to this org, just increment counter
    if (this.channel && this.currentOrgId === organizationId) {
      this.subscriberCount++;
      if (isDev) {
        console.log(`🌐 Company Objectives: Subscriber #${this.subscriberCount} joined (reusing existing subscription)`);
      }
      return this.createUnsubscriber(organizationId);
    }

    // If subscribed to different org, cleanup first
    if (this.channel && this.currentOrgId !== organizationId) {
      if (isDev) {
        console.log('🌐 Company Objectives: Switching to new organization, cleaning up old subscription');
      }
      this.cleanup();
    }

    // Create new subscription
    this.currentOrgId = organizationId;
    this.subscriberCount = 1;

    if (isDev) {
      console.log('🌐 Company Objectives: Creating SINGLE global subscription for org:', organizationId);
    }

    this.channel = supabase
      .channel(`global_company_objectives_${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_objectives',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          if (isDev) {
            console.log('🌐 Company Objectives: Real-time update received', {
              event: payload.eventType,
              table: payload.table
            });
          }
          
          // Invalidate queries for all subscribers
          if (this.queryClient) {
            this.queryClient.invalidateQueries({ 
              queryKey: ['company-objectives'],
              exact: false 
            });
            
            this.queryClient.invalidateQueries({ 
              queryKey: ['company-objectives', organizationId],
              exact: false 
            });
          }
        }
      )
      .subscribe((status) => {
        if (isDev) {
          console.log('🌐 Company Objectives: Subscription status:', status);
        }
      });

    return this.createUnsubscriber(organizationId);
  }

  /**
   * Create an unsubscribe function
   */
  private createUnsubscriber(organizationId: string): () => void {
    return () => {
      const isDev = import.meta.env?.DEV;
      
      // Only cleanup if this is for the current org
      if (organizationId !== this.currentOrgId) {
        return;
      }

      this.subscriberCount--;
      
      if (isDev) {
        console.log(`🌐 Company Objectives: Subscriber left (${this.subscriberCount} remaining)`);
      }

      // Cleanup when no more subscribers
      if (this.subscriberCount <= 0) {
        if (isDev) {
          console.log('🌐 Company Objectives: No more subscribers, cleaning up subscription');
        }
        this.cleanup();
      }
    };
  }

  /**
   * Cleanup subscription
   */
  private cleanup(): void {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.currentOrgId = null;
    this.subscriberCount = 0;
  }

  /**
   * Get current stats (for debugging)
   */
  getStats() {
    return {
      subscriberCount: this.subscriberCount,
      currentOrgId: this.currentOrgId,
      hasActiveChannel: !!this.channel
    };
  }
}

// Export singleton instance
export const globalCompanyObjectivesManager = new GlobalCompanyObjectivesManager();

// Expose to window for debugging
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  (window as any).globalCompanyObjectivesManager = globalCompanyObjectivesManager;
}
