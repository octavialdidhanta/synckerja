import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";

export type CreateTemplatePayload = {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  components: unknown[];
};

export function useCreateWhatsAppMessageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateTemplatePayload) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const url = `${SUPABASE_URL}/functions/v1/whatsapp-message-templates`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof json?.error === "string" ? json.error : "Failed to create template";
        throw new Error(msg);
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-message-templates"] });
    },
  });
}
