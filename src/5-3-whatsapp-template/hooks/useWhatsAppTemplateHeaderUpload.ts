import { useMutation } from "@tanstack/react-query";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";

export type TemplateHeaderMediaFormat = "IMAGE" | "VIDEO" | "DOCUMENT";

export async function uploadWhatsAppTemplateHeaderMedia(
  file: File,
  format: TemplateHeaderMediaFormat,
  whatsappAccountId?: string | null,
): Promise<{ header_handle: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const form = new FormData();
  form.append("file", file);
  form.append("format", format);
  if (whatsappAccountId) form.append("whatsapp_account_id", whatsappAccountId);

  const url = `${SUPABASE_URL}/functions/v1/whatsapp-template-header-upload`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: form,
  });
  const json = (await res.json().catch(() => ({}))) as { header_handle?: string; error?: string; code?: string };
  if (!res.ok) {
    throw new Error(typeof json?.error === "string" ? json.error : "Upload failed");
  }
  const h = json.header_handle;
  if (!h) throw new Error("No header_handle in response");
  return { header_handle: h };
}

export function useWhatsAppTemplateHeaderUpload() {
  return useMutation({
    mutationFn: async ({
      file,
      format,
      whatsappAccountId,
    }: {
      file: File;
      format: TemplateHeaderMediaFormat;
      whatsappAccountId?: string | null;
    }) => uploadWhatsAppTemplateHeaderMedia(file, format, whatsappAccountId),
  });
}
