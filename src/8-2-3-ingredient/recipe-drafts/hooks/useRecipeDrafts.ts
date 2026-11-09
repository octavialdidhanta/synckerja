import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { CATALOG_PRODUCT_RECIPES_QUERY_KEY } from "../../product-recipes/hooks/useCatalogProductRecipes";
import type { RecipeDraftListItem, RecipeDraftReview } from "../types";

export const RECIPE_DRAFTS_QUERY_KEY = "recipe-drafts";
export const RECIPE_DRAFT_REVIEW_QUERY_KEY = "recipe-draft-review";

function rpcError(error: { message?: string } | null): Error {
  return new Error(error?.message || "query_failed");
}

/** Open drafts from Claude for the current organization (pending, not expired). */
export function useRecipeDrafts() {
  const { organizationId } = useCurrentOrg();
  const query = useQuery({
    queryKey: [RECIPE_DRAFTS_QUERY_KEY, organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<RecipeDraftListItem[]> => {
      const { data, error } = await supabase.rpc("list_recipe_drafts", {
        p_organization_id: organizationId,
        p_status: "pending",
      });
      if (error) throw rpcError(error);
      const drafts = (data as { drafts?: RecipeDraftListItem[] } | null)?.drafts;
      return Array.isArray(drafts) ? drafts : [];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  return { drafts: query.data ?? [], isLoading: query.isLoading };
}

export function useRecipeDraftReview(draftId: string | null) {
  return useQuery({
    queryKey: [RECIPE_DRAFT_REVIEW_QUERY_KEY, draftId],
    enabled: !!draftId,
    queryFn: async (): Promise<RecipeDraftReview> => {
      const { data, error } = await supabase.rpc("get_recipe_draft_review", { p_draft_id: draftId });
      if (error) throw rpcError(error);
      return data as RecipeDraftReview;
    },
    refetchOnWindowFocus: false,
  });
}

export function useRecipeDraftActions(draftId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const settle = (review?: RecipeDraftReview) => {
    if (review && draftId) queryClient.setQueryData([RECIPE_DRAFT_REVIEW_QUERY_KEY, draftId], review);
    queryClient.invalidateQueries({ queryKey: [RECIPE_DRAFTS_QUERY_KEY, organizationId] });
  };

  const save = useMutation({
    mutationFn: async (lines: Array<{ ingredient_id: string; quantity: number }>): Promise<RecipeDraftReview> => {
      const { data, error } = await supabase.rpc("update_recipe_draft", { p_draft_id: draftId, p_lines: lines });
      if (error) throw rpcError(error);
      return data as RecipeDraftReview;
    },
    onSuccess: settle,
  });

  const publish = useMutation({
    mutationFn: async (confirmWarnings: boolean): Promise<RecipeDraftReview> => {
      const { data, error } = await supabase.rpc("publish_recipe_draft", {
        p_draft_id: draftId,
        p_confirm_warnings: confirmWarnings,
      });
      if (error) throw rpcError(error);
      return data as RecipeDraftReview;
    },
    onSuccess: (review) => {
      settle(review);
      // The live recipe changed: refresh the Recipes table and anything costing it.
      queryClient.invalidateQueries({ queryKey: [CATALOG_PRODUCT_RECIPES_QUERY_KEY, organizationId] });
    },
  });

  const reject = useMutation({
    mutationFn: async (note: string | null): Promise<RecipeDraftReview> => {
      const { data, error } = await supabase.rpc("reject_recipe_draft", { p_draft_id: draftId, p_note: note });
      if (error) throw rpcError(error);
      return data as RecipeDraftReview;
    },
    onSuccess: settle,
  });

  return {
    save: save.mutateAsync,
    publish: publish.mutateAsync,
    reject: reject.mutateAsync,
    isBusy: save.isPending || publish.isPending || reject.isPending,
  };
}
