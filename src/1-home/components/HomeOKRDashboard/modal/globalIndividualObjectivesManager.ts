import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Satu channel realtime `individual_objectives` per organisasi untuk seluruh app.
 *
 * Channel **tidak** ditutup saat jumlah subscriber sementara 0 (remount / Strict Mode / banyak baris
 * tabel) — itu yang memicu log CLOSED/SUBSCRIBED berulang dan getar UI. Hanya dibuang saat **ganti org**.
 */

class GlobalIndividualObjectivesManager {
  private channel: RealtimeChannel | null = null;
  private subscriberCount: number = 0;
  private currentOrgId: string | null = null;
  private queryClient: QueryClient | null = null;

  private disposeChannelImmediate(): void {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.currentOrgId = null;
    this.subscriberCount = 0;
  }

  subscribe(organizationId: string, queryClient: QueryClient): () => void {
    const isDev = import.meta.env?.DEV;
    this.queryClient = queryClient;

    if (this.channel && this.currentOrgId === organizationId) {
      this.subscriberCount++;
      return this.createUnsubscriber(organizationId);
    }

    if (this.channel && this.currentOrgId !== organizationId) {
      if (isDev) {
        console.log('Global Individual Objectives: Switching organization — closing previous channel');
      }
      this.disposeChannelImmediate();
    }

    this.currentOrgId = organizationId;
    this.subscriberCount = 1;

    if (isDev) {
      console.log('Global Individual Objectives: Subscribed for org:', organizationId);
    }

    this.channel = supabase
      .channel(`global_individual_objectives_${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'individual_objectives',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          if (this.queryClient) {
            this.queryClient.invalidateQueries({
              queryKey: ['individual-objectives'],
              exact: false,
            });
            this.queryClient.invalidateQueries({
              queryKey: ['individual-objectives', organizationId],
              exact: false,
            });
          }
        }
      )
      .subscribe();

    return this.createUnsubscriber(organizationId);
  }

  private createUnsubscriber(organizationId: string): () => void {
    return () => {
      if (organizationId !== this.currentOrgId) {
        return;
      }
      this.subscriberCount = Math.max(0, this.subscriberCount - 1);
      // Jangan removeChannel saat 0 — komponen akan subscribe lagi segera; tutup hanya saat ganti org di atas.
    };
  }

  getStats() {
    return {
      subscriberCount: this.subscriberCount,
      currentOrgId: this.currentOrgId,
      hasActiveChannel: !!this.channel,
    };
  }
}

export const globalIndividualObjectivesManager = new GlobalIndividualObjectivesManager();

if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  (window as any).globalIndividualObjectivesManager = globalIndividualObjectivesManager;
}
