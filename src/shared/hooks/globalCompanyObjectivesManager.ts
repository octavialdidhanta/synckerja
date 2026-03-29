import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

class GlobalCompanyObjectivesManager {
  private channel: RealtimeChannel | null = null;
  private subscriberCount = 0;
  private currentOrgId: string | null = null;
  private queryClient: QueryClient | null = null;

  subscribe(organizationId: string, queryClient: QueryClient): () => void {
    const isDev = import.meta.env?.DEV;

    if (!this.queryClient) {
      this.queryClient = queryClient;
    }

    if (this.channel && this.currentOrgId === organizationId) {
      this.subscriberCount++;
      return this.createUnsubscriber(organizationId);
    }

    if (this.channel && this.currentOrgId !== organizationId) {
      this.cleanup();
    }

    this.currentOrgId = organizationId;
    this.subscriberCount = 1;

    this.channel = supabase
      .channel(`global_company_objectives_${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "company_objectives",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          if (this.queryClient) {
            this.queryClient.invalidateQueries({ queryKey: ["company-objectives"], exact: false });
            this.queryClient.invalidateQueries({ queryKey: ["company-objectives", organizationId], exact: false });
          }
        },
      )
      .subscribe((status) => {
        if (isDev) {
          console.log("Company Objectives realtime:", status);
        }
      });

    return this.createUnsubscriber(organizationId);
  }

  private createUnsubscriber(organizationId: string): () => void {
    return () => {
      if (organizationId !== this.currentOrgId) {
        return;
      }
      this.subscriberCount--;
      if (this.subscriberCount <= 0) {
        this.cleanup();
      }
    };
  }

  private cleanup(): void {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.currentOrgId = null;
    this.subscriberCount = 0;
  }
}

export const globalCompanyObjectivesManager = new GlobalCompanyObjectivesManager();
