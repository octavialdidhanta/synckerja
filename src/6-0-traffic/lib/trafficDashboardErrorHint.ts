export function trafficDashboardErrorHint(err: unknown): string | null {
  const msg =
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
      ? (err as { message: string }).message.trim()
      : "";
  if (!msg) return null;
  const lower = msg.toLowerCase();
  if (lower.includes("forbidden")) {
    return "Akses ditolak untuk Web ID ini di organisasi aktif. Periksa organisasi di header dan pastikan properti sudah dihubungkan (Connect) untuk org tersebut.";
  }
  if (lower.includes("web_id is required")) {
    return "Web ID belum dipilih atau kosong.";
  }
  if (lower.includes("invalid range")) {
    return "Rentang tanggal tidak valid (akhir sebelum mulai). Sesuaikan filter tanggal.";
  }
  if (lower.includes("could not choose the best candidate")) {
    return "Ada dua versi get_traffic_dashboard di database (konflik overload). Jalankan migrasi terbaru (drop overload text,text,text) atau hapus fungsi duplikat di SQL Editor Supabase.";
  }
  if (lower.includes("pgrst") || lower.includes("could not find the function")) {
    return "Fungsi database tidak ditemukan atau tidak cocok. Pastikan migrasi Supabase untuk traffic sudah di-push ke project ini.";
  }
  return msg;
}
