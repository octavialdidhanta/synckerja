/** Meta does not allow deleting templates in these statuses (see template-management docs). */
export function templateDeleteBlockReason(statusRaw: string): string | null {
  const s = statusRaw.toUpperCase().trim();
  if (s === "DISABLED") {
    return "Template berstatus Disabled tidak bisa dihapus lewat Meta API. Aktifkan atau hubungi dukungan Meta.";
  }
  if (s === "PENDING_DELETION" || s === "DELETED") {
    return "Template ini sudah dihapus atau sedang dalam proses penghapusan.";
  }
  return null;
}

export function formatWhatsAppTemplateDeleteError(
  message: string,
  details?: unknown,
): string {
  const err = (details as { error?: { error_user_msg?: string; message?: string; code?: number } } | undefined)?.error;
  const userMsg = err?.error_user_msg?.trim();
  if (userMsg) return userMsg;
  const metaMsg = err?.message?.trim();
  if (metaMsg && metaMsg !== message) return metaMsg;
  const code = err?.code;
  if (code === 10 || code === 200) {
    return `${message} Token Meta mungkin tidak punya izin whatsapp_business_management — hubungkan ulang di Operations → Consultant.`;
  }
  return message;
}
