import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { AddOperationalEmailRecipientResult, OperationalEmailRecipient } from "../types";

export const OPERATIONAL_EMAIL_RECIPIENTS_QUERY_KEY = "operational-email-recipients";

/** Recipients list changes only on add/delete/verify — cache between visits. */
const OPERATIONAL_EMAIL_RECIPIENTS_STALE_MS = 5 * 60_000;

const SELECT_COLUMNS = "id, organization_id, email, status, verified_at, created_at";

function mapRecipient(row: OperationalEmailRecipient): OperationalEmailRecipient {
  return {
    id: row.id,
    organization_id: row.organization_id,
    email: row.email,
    status: row.status === "verified" ? "verified" : "pending",
    verified_at: row.verified_at ?? null,
    created_at: row.created_at,
  };
}

async function fetchRecipients(organizationId: string): Promise<OperationalEmailRecipient[]> {
  const { data, error } = await supabase
    .from("operational_email_recipients")
    .select(SELECT_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapRecipient(row as OperationalEmailRecipient));
}

export function buildOperationalEmailVerificationUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/verify-operational-email?token=${encodeURIComponent(token)}`;
}

export function useOperationalEmailRecipients() {
  const { organizationId } = useCurrentOrg();
  const { organizationName } = useCentralizedUserData();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [OPERATIONAL_EMAIL_RECIPIENTS_QUERY_KEY, organizationId],
    queryFn: async (): Promise<OperationalEmailRecipient[]> => {
      if (!organizationId) return [];
      return fetchRecipients(organizationId);
    },
    enabled: !!organizationId,
    staleTime: OPERATIONAL_EMAIL_RECIPIENTS_STALE_MS,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: [OPERATIONAL_EMAIL_RECIPIENTS_QUERY_KEY, organizationId],
    });
  };

  const addRecipient = useMutation({
    mutationFn: async (email: string): Promise<AddOperationalEmailRecipientResult> => {
      if (!organizationId) throw new Error("Organization ID is required");

      const { data, error } = await supabase.rpc("add_operational_email_recipient", {
        p_organization_id: organizationId,
        p_email: email,
      });
      if (error) throw error;

      const result = data as AddOperationalEmailRecipientResult;
      const verificationUrl = buildOperationalEmailVerificationUrl(result.verification_token);

      const { data: sendData, error: sendError } = await supabase.functions.invoke(
        "send-operational-email-verification",
        {
          body: {
            email: result.email,
            organizationName: organizationName ?? "your organization",
            verificationUrl,
          },
        },
      );

      if (sendError) throw sendError;
      if (sendData && typeof sendData === "object" && "success" in sendData && !sendData.success) {
        throw new Error(
          typeof sendData.error === "string" ? sendData.error : "verification_email_failed",
        );
      }

      return result;
    },
    onSuccess: () => invalidate(),
  });

  const deleteRecipient = useMutation({
    mutationFn: async (recipientId: string) => {
      const { error } = await supabase.rpc("delete_operational_email_recipient", {
        p_id: recipientId,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  return {
    recipients: query.data ?? [],
    isLoading: query.isLoading,
    addRecipient: addRecipient.mutateAsync,
    isAdding: addRecipient.isPending,
    deleteRecipient: deleteRecipient.mutateAsync,
    isDeleting: deleteRecipient.isPending,
  };
}
