import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { toast } from "sonner";
import type { SalesChannel } from "../types/pricingTypes";

interface SalesChannelRow {
  id: string;
  organization_id: string | null;
  name: string;
  type: "online" | "offline";
  commission_percent: number;
  payment_fee_percent: number;
  ad_spend_percent: number;
  other_fee_percent: number;
  total_fee_percent: number;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const mapRowToChannel = (row: SalesChannelRow): SalesChannel => ({
  id: row.id,
  name: row.name,
  type: row.type,
  commissionPercent: row.commission_percent,
  paymentFeePercent: row.payment_fee_percent,
  adSpendPercent: row.ad_spend_percent,
  otherFeePercent: row.other_fee_percent,
  totalFeePercent: row.total_fee_percent,
  isActive: row.is_active,
  isDefault: row.is_default,
});

export const useSalesChannels = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["sales-channels", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("sales_channels")
        .select("*")
        .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
        .order("is_default", { ascending: false })
        .order("name", { ascending: true });

      if (error) throw error;

      return (data || []).map((row) => mapRowToChannel(row as SalesChannelRow));
    },
    enabled: !!organizationId,
  });

  const createChannel = useMutation({
    mutationFn: async (channel: Omit<SalesChannel, "id" | "isDefault">) => {
      if (!organizationId) throw new Error("Organization not found");

      const totalFee =
        (channel.commissionPercent || 0) +
        (channel.paymentFeePercent || 0) +
        (channel.adSpendPercent || 0) +
        (channel.otherFeePercent || 0);

      const { data, error } = await supabase
        .from("sales_channels")
        .insert({
          organization_id: organizationId,
          name: channel.name,
          type: channel.type,
          commission_percent: channel.commissionPercent,
          payment_fee_percent: channel.paymentFeePercent || 0,
          ad_spend_percent: channel.adSpendPercent || 0,
          other_fee_percent: channel.otherFeePercent || 0,
          total_fee_percent: totalFee,
          is_active: channel.isActive,
          is_default: false,
        })
        .select()
        .single();

      if (error) throw error;
      return mapRowToChannel(data as SalesChannelRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-channels", organizationId] });
      toast.success("Sales channel saved successfully");
    },
    onError: () => {
      toast.error("Failed to save sales channel");
    },
  });

  const updateChannel = useMutation({
    mutationFn: async (channel: SalesChannel) => {
      if (!organizationId) throw new Error("Organization not found");

      if (channel.isDefault) {
        throw new Error("Cannot update system default channels");
      }

      const totalFee =
        (channel.commissionPercent || 0) +
        (channel.paymentFeePercent || 0) +
        (channel.adSpendPercent || 0) +
        (channel.otherFeePercent || 0);

      const { data, error } = await supabase
        .from("sales_channels")
        .update({
          name: channel.name,
          type: channel.type,
          commission_percent: channel.commissionPercent,
          payment_fee_percent: channel.paymentFeePercent || 0,
          ad_spend_percent: channel.adSpendPercent || 0,
          other_fee_percent: channel.otherFeePercent || 0,
          total_fee_percent: totalFee,
          is_active: channel.isActive,
        })
        .eq("id", channel.id)
        .eq("organization_id", organizationId)
        .select()
        .single();

      if (error) throw error;
      return mapRowToChannel(data as SalesChannelRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-channels", organizationId] });
      toast.success("Sales channel updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update sales channel");
    },
  });

  const deleteChannel = useMutation({
    mutationFn: async (id: string) => {
      if (!organizationId) throw new Error("Organization not found");

      const channel = channels.find((c) => c.id === id);
      if (channel?.isDefault) {
        throw new Error("Cannot delete system default channels");
      }

      const { error } = await supabase
        .from("sales_channels")
        .delete()
        .eq("id", id)
        .eq("organization_id", organizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-channels", organizationId] });
      toast.success("Sales channel deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete sales channel");
    },
  });

  const saveMultipleChannels = useMutation({
    mutationFn: async (channelsToSave: Omit<SalesChannel, "id" | "isDefault">[]) => {
      if (!organizationId) throw new Error("Organization not found");

      const { data, error } = await supabase
        .from("sales_channels")
        .insert(
          channelsToSave.map((channel) => {
            const totalFee =
              (channel.commissionPercent || 0) +
              (channel.paymentFeePercent || 0) +
              (channel.adSpendPercent || 0) +
              (channel.otherFeePercent || 0);

            return {
              organization_id: organizationId,
              name: channel.name,
              type: channel.type,
              commission_percent: channel.commissionPercent,
              payment_fee_percent: channel.paymentFeePercent || 0,
              ad_spend_percent: channel.adSpendPercent || 0,
              other_fee_percent: channel.otherFeePercent || 0,
              total_fee_percent: totalFee,
              is_active: channel.isActive,
              is_default: false,
            };
          }),
        )
        .select();

      if (error) throw error;
      return (data || []).map((row) => mapRowToChannel(row as SalesChannelRow));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-channels", organizationId] });
      toast.success("Sales channels saved successfully");
    },
    onError: () => {
      toast.error("Failed to save sales channels");
    },
  });

  return {
    channels,
    isLoading,
    createChannel: createChannel.mutateAsync,
    updateChannel: updateChannel.mutateAsync,
    deleteChannel: deleteChannel.mutateAsync,
    saveMultipleChannels: saveMultipleChannels.mutateAsync,
    isCreating: createChannel.isPending,
    isUpdating: updateChannel.isPending,
    isDeleting: deleteChannel.isPending,
    isSavingMultiple: saveMultipleChannels.isPending,
  };
};
