import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { formatWhatsAppTemplateDeleteError } from "../utils/templateDeleteRules";

export type DeleteWhatsAppTemplateArgs = {
  /** Meta message template id (`hsm_id` in Graph delete). */
  hsmId: string;
  /** Meta template `name` — required together with `hsmId` per Graph API delete-by-id. */
  templateName: string;
  /** `organization_whatsapp_accounts.id` when listing by account; otherwise null for default WABA resolution. */
  whatsappAccountId: string | null;
};

export function useDeleteWhatsAppMessageTemplate() {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();

  return useMutation({
    mutationFn: async ({ hsmId, templateName, whatsappAccountId }: DeleteWhatsAppTemplateArgs) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const name = templateName.trim();
      if (!name) throw new Error("Template name is required to delete");
      const params = new URLSearchParams({ hsm_id: hsmId, name });
      if (whatsappAccountId) params.set("whatsapp_account_id", whatsappAccountId);
      const url = `${SUPABASE_URL}/functions/v1/whatsapp-message-templates?${params.toString()}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        hint?: string;
        details?: unknown;
      };
      if (!res.ok) {
        const base = typeof json?.error === "string" ? json.error : "Failed to delete template";
        const msg = formatWhatsAppTemplateDeleteError(base, json.details);
        const hint = typeof json?.hint === "string" ? json.hint.trim() : "";
        throw new Error(hint ? `${msg} ${hint}` : msg);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-message-templates", organizationId] });
    },
  });
}
