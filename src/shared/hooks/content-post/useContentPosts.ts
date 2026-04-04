import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useToast } from "@/shared/components/ui/use-toast";
import { contentPostService } from "@/shared/services/content-post/supabase";
import type { CreateContentPostWithPaymentPayload } from "@/shared/types/content-post";

const EXPECTED_SCHEMA_MISSING = ["does not exist", "relation", "column"];

const isExpectedSchemaError = (error: unknown) => {
  const text = String((error as any)?.message || "").toLowerCase();
  return EXPECTED_SCHEMA_MISSING.some((entry) => text.includes(entry));
};

export const useContentPosts = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const postsQuery = useQuery({
    queryKey: ["kol-content-posts", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      if (!organizationId) return [];
      try {
        return await contentPostService.listContentPostsByOrg(organizationId);
      } catch (error) {
        if (isExpectedSchemaError(error)) return [];
        throw error;
      }
    },
  });

  const assignmentsQuery = useQuery({
    queryKey: ["kol-campaign-assignments", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      if (!organizationId) return [];
      try {
        return await contentPostService.listCampaignAssignmentsByOrg(organizationId);
      } catch (error) {
        if (isExpectedSchemaError(error)) return [];
        throw error;
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Omit<CreateContentPostWithPaymentPayload, "organization_id">) => {
      if (!organizationId) throw new Error("Organization is required");
      return contentPostService.createContentPostWithPayment({
        ...payload,
        organization_id: organizationId,
      } as CreateContentPostWithPaymentPayload);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["kol-content-posts"] }),
        queryClient.invalidateQueries({ queryKey: ["kol-content-milestones"] }),
      ]);
      toast({ title: "Success", description: "Content post berhasil dibuat." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Gagal membuat content post.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await (await import("@/shared/lib/supabaseClient")).supabase
        .from("kol_content_posts")
        .delete()
        .eq("id", postId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["kol-content-posts"] });
      toast({ title: "Success", description: "Content post dihapus." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Gagal menghapus content post.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const { error } = await (await import("@/shared/lib/supabaseClient")).supabase
        .from("kol_content_posts")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["kol-content-posts"] });
    },
  });

  return useMemo(
    () => ({
      contentPosts: postsQuery.data || [],
      assignments: assignmentsQuery.data || [],
      isLoading: postsQuery.isLoading || assignmentsQuery.isLoading,
      isPending: postsQuery.isPending || assignmentsQuery.isPending,
      createContentPostWithPayment: createMutation.mutateAsync,
      isCreating: createMutation.isPending,
      updateContentPost: updateMutation.mutateAsync,
      isUpdating: updateMutation.isPending,
      deleteContentPost: deleteMutation.mutateAsync,
      isDeleting: deleteMutation.isPending,
    }),
    [
      postsQuery.data,
      assignmentsQuery.data,
      postsQuery.isLoading,
      assignmentsQuery.isLoading,
      postsQuery.isPending,
      assignmentsQuery.isPending,
      createMutation.mutateAsync,
      createMutation.isPending,
      updateMutation.mutateAsync,
      updateMutation.isPending,
      deleteMutation.mutateAsync,
      deleteMutation.isPending,
    ],
  );
};
