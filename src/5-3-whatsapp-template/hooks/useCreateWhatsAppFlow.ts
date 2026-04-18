import { useMutation } from "@tanstack/react-query";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";

export type CreateWhatsAppFlowPayload = {
  name: string;
  categories: string[];
  flow_json: Record<string, unknown> | string;
  publish?: boolean;
  endpoint_uri?: string;
};

export type MetaFlowCreateResult = {
  id?: string;
  success?: boolean;
  validation_errors?: unknown[];
  [key: string]: unknown;
};

function formatValidationErrors(result: MetaFlowCreateResult): string | null {
  const ve = result.validation_errors;
  if (!Array.isArray(ve) || ve.length === 0) return null;
  return ve
    .map((e) => {
      if (e != null && typeof e === "object" && "message" in e) return String((e as { message?: string }).message ?? e);
      return typeof e === "string" ? e : JSON.stringify(e);
    })
    .join(" · ");
}

export function useCreateWhatsAppFlow() {
  return useMutation({
    mutationFn: async (payload: CreateWhatsAppFlowPayload) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const url = `${SUPABASE_URL}/functions/v1/whatsapp-flows`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: { error?: { message?: string }; validation_errors?: unknown[] };
        success?: boolean;
        result?: MetaFlowCreateResult;
      };
      if (!res.ok) {
        const msg =
          typeof json?.error === "string"
            ? json.error
            : json?.details?.error?.message ?? "Failed to create WhatsApp flow";
        throw new Error(msg);
      }
      const result = json.result as MetaFlowCreateResult | undefined;
      if (!result) throw new Error("Invalid response from server");
      const veMsg = formatValidationErrors(result);
      if (result.success === false || veMsg) {
        throw new Error(veMsg ? `Meta validation: ${veMsg}` : "Meta rejected the flow (success: false)");
      }
      const id = result.id != null ? String(result.id).trim() : "";
      if (!id) throw new Error("Flow created but no id returned");
      return { ...result, id } as MetaFlowCreateResult & { id: string };
    },
  });
}
