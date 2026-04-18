import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { MessageCircle } from "lucide-react";

export function WhatsAppTemplateEmptyState({
  reason,
  detail,
}: {
  reason: "not_configured" | "error" | "none";
  /** Server or network error message (shown for reason === "error"). */
  detail?: string | null;
}) {
  if (reason === "not_configured") {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/80 px-6 py-16 text-center">
        <MessageCircle className="mb-3 h-10 w-10 text-slate-400" aria-hidden />
        <h2 className="text-lg font-semibold text-slate-900">WhatsApp belum terhubung</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Hubungkan WhatsApp Business di halaman Connect, atau pastikan Edge Function <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">whatsapp-message-templates</code> sudah di-deploy versi terbaru (WABA bisa diambil otomatis dari Phone Number ID).
        </p>
        <Button asChild className="mt-6">
          <Link to="/operations/consultant/whatsapp/connect">Connect WhatsApp</Link>
        </Button>
      </div>
    );
  }
  if (reason === "none") {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/80 px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">Belum ada message template. Buat template pertama dengan tombol Create Template.</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-8 text-center text-sm text-red-800">
      <p>Gagal memuat template. Periksa izin token Meta (whatsapp_business_management) dan coba lagi.</p>
      {detail ? <p className="mt-2 break-words text-xs opacity-90">{detail}</p> : null}
    </div>
  );
}
