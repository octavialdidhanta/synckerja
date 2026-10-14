import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/shared/lib/supabaseClient";
import { toast } from "@/shared/hooks/use-toast";
import { useInvalidateOwnershipCache } from "./useInvalidateOwnershipCache";

interface OwnershipTransfer {
  id: string;
  from_user_id: string;
  to_user_id: string;
  message: string | null;
  created_at: string;
  organization_id: string;
  from_user_name?: string;
  from_user_email?: string;
  organization_name?: string;
  to_user?: {
    full_name: string;
    email: string;
  };
}

interface OrganizationMember {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
}

async function getSessionUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function loadMemberDirectory(organizationId: string): Promise<OrganizationMember[]> {
  const { data, error } = await supabase.rpc("get_organization_members", {
    _organization_id: organizationId,
  });
  if (error) {
    console.error("Error loading member directory:", error);
    return [];
  }
  return (data as OrganizationMember[]) ?? [];
}

export function useTransferOwnership(organizationId?: string | null) {
  const { t } = useTranslation();
  const [userId, setUserId] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<OwnershipTransfer[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<OwnershipTransfer[]>([]);
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [incomingReady, setIncomingReady] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const { invalidateOwnershipData, forceRefreshAllData } = useInvalidateOwnershipCache();

  useEffect(() => {
    let cancelled = false;
    void getSessionUserId().then((id) => {
      if (!cancelled) setUserId(id);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void getSessionUserId().then((id) => setUserId(id));
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const fetchTransfers = useCallback(async () => {
    const uid = await getSessionUserId();
    if (!uid) return;

    setLoading(true);
    try {
      const { data: transfersData, error: transfersError } = await supabase
        .from("ownership_transfers")
        .select("*")
        .eq("to_user_id", uid)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (transfersError) {
        console.error("Error fetching transfers:", transfersError);
        return;
      }

      if (!transfersData || transfersData.length === 0) {
        setTransfers([]);
        return;
      }

      const orgIds = [...new Set(transfersData.map((transfer) => transfer.organization_id))];
      const directories = new Map<string, OrganizationMember[]>();
      const orgNames = new Map<string, string>();
      await Promise.all(
        orgIds.map(async (orgId) => {
          const [members, orgResult] = await Promise.all([
            loadMemberDirectory(orgId),
            supabase.from("organizations").select("company_name").eq("id", orgId).maybeSingle(),
          ]);
          directories.set(orgId, members);
          if (orgResult.data?.company_name) orgNames.set(orgId, orgResult.data.company_name);
        }),
      );

      setTransfers(
        transfersData.map((transfer) => {
          const sender = directories
            .get(transfer.organization_id)
            ?.find((member) => member.user_id === transfer.from_user_id);
          return {
            ...transfer,
            from_user_name: sender?.full_name || t("transferOwnership.fallback.unknownUser"),
            from_user_email: sender?.email || "",
            organization_name:
              orgNames.get(transfer.organization_id) || t("transferOwnership.fallback.unknownOrganization"),
          };
        }),
      );
    } catch (error) {
      console.error("Error in fetchTransfers:", error);
    } finally {
      setLoading(false);
      setIncomingReady(true);
    }
  }, [t]);

  const fetchPendingTransfers = useCallback(async () => {
    const uid = await getSessionUserId();
    if (!uid || !organizationId) return;

    setLoading(true);
    try {
      const { data: transfersData, error: transfersError } = await supabase
        .from("ownership_transfers")
        .select("*")
        .eq("from_user_id", uid)
        .eq("organization_id", organizationId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (transfersError) {
        console.error("Error fetching pending transfers:", transfersError);
        return;
      }

      if (!transfersData || transfersData.length === 0) {
        setPendingTransfers([]);
        return;
      }

      const members = await loadMemberDirectory(organizationId);
      const enrichedTransfers = transfersData.map((transfer) => {
        const recipient = members.find((member) => member.user_id === transfer.to_user_id);
        return {
          ...transfer,
          to_user: {
            full_name: recipient?.full_name || t("transferOwnership.fallback.unknownUser"),
            email: recipient?.email || "",
          },
        };
      });

      setPendingTransfers(enrichedTransfers);
    } catch (error) {
      console.error("Error in fetchPendingTransfers:", error);
    } finally {
      setLoading(false);
    }
  }, [organizationId, t]);

  const fetchOrganizationMembers = useCallback(async () => {
    if (!organizationId) return;

    setMembersLoading(true);
    try {
      const { data: membersData, error } = await supabase.rpc("get_organization_members", {
        _organization_id: organizationId,
      });

      if (error) {
        console.error("Error fetching organization members:", error);
        return;
      }

      setOrganizationMembers((membersData as OrganizationMember[]) || []);
    } catch (error) {
      console.error("Error in fetchOrganizationMembers:", error);
    } finally {
      setMembersLoading(false);
    }
  }, [organizationId]);

  const initiateTransfer = async (toUserId: string, message?: string) => {
    if (!organizationId) return false;

    try {
      const { error } = await supabase.rpc("transfer_ownership", {
        _to_user_id: toUserId,
        _message: message ?? null,
      });

      if (error) {
        throw error;
      }

      toast({
        title: t("transferOwnership.toast.success.requestSentTitle"),
        description: t("transferOwnership.toast.success.requestSentDescription"),
      });

      await fetchPendingTransfers();
      return true;
    } catch (error: unknown) {
      console.error("Error initiating transfer:", error);
      const messageText =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : t("transferOwnership.toast.error.startFailedDescription");
      toast({
        title: t("transferOwnership.toast.error.rpcFailedTitle"),
        description: messageText,
        variant: "destructive",
      });
      return false;
    }
  };

  const cancelTransfer = async (transferId: string) => {
    const uid = await getSessionUserId();
    if (!uid) return false;
    try {
      const { error } = await supabase
        .from("ownership_transfers")
        .update({ status: "cancelled" })
        .eq("id", transferId)
        .eq("from_user_id", uid);

      if (error) {
        throw error;
      }

      toast({
        title: t("transferOwnership.toast.success.cancelledTitle"),
        description: t("transferOwnership.toast.success.cancelledDescription"),
      });

      await fetchPendingTransfers();
      return true;
    } catch (error: unknown) {
      console.error("Error cancelling transfer:", error);
      const messageText =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : t("transferOwnership.toast.error.cancelFailedDescription");
      toast({
        title: t("transferOwnership.toast.error.cancelFailedTitle"),
        description: messageText,
        variant: "destructive",
      });
      return false;
    }
  };

  const acceptTransfer = async (transferId: string) => {
    setAccepting(true);
    try {
      const { error } = await supabase.rpc("accept_ownership_transfer", {
        _transfer_id: transferId,
      });

      if (error) {
        throw error;
      }

      toast({
        title: t("transferOwnership.toast.success.acceptedTitle"),
        description: t("transferOwnership.toast.success.acceptedDescription"),
      });

      await invalidateOwnershipData();
      await fetchTransfers();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await forceRefreshAllData();

      return true;
    } catch (error: unknown) {
      console.error("Error accepting transfer:", error);
      const messageText =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : t("transferOwnership.toast.error.acceptFailedDescription");
      toast({
        title: t("transferOwnership.toast.error.rpcFailedTitle"),
        description: messageText,
        variant: "destructive",
      });
      return false;
    } finally {
      setAccepting(false);
    }
  };

  useEffect(() => {
    void fetchTransfers();
  }, [userId, fetchTransfers]);

  useEffect(() => {
    if (organizationId) {
      void fetchPendingTransfers();
      void fetchOrganizationMembers();
    }
  }, [organizationId, userId, fetchPendingTransfers, fetchOrganizationMembers]);

  return {
    transfers,
    pendingTransfers,
    organizationMembers,
    loading,
    incomingReady,
    accepting,
    membersLoading,
    fetchTransfers,
    fetchPendingTransfers,
    initiateTransfer,
    cancelTransfer,
    acceptTransfer,
  };
}
