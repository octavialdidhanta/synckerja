import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { supabase } from "@/shared/lib/supabaseClient";
import { useLeads } from "@/shared/hooks/organized/sales";
import { CampaignPanelFooter } from "@/5-3-whatsapp-template/layout/CampaignPanelFooter";
import { CAMPAIGN_MAIN_GRID, CAMPAIGN_TABLE_SECTION } from "@/5-3-whatsapp-template/layout/campaignLayout";
import {
  interpolateOutreachBody,
  OUTREACH_DAILY_COPY_SOFT_CAP,
  OUTREACH_MAX_MATERIALS,
  parseManualUsernames,
  type ManualKind,
} from "@/5-3-instagram-outreach/lib/audience";
import { downloadOutreachMaterialFile, validateOutreachFile } from "@/5-3-instagram-outreach/lib/uploadOutreachMaterial";
import {
  useInstagramOutreachDetail,
  useInstagramOutreachMutations,
  useOutreachCopiedToday,
  type OutreachCampaign,
  type OutreachMaterial,
  type OutreachTarget,
} from "@/5-3-instagram-outreach/hooks/useInstagramOutreach";

const STATUSES = ["new", "copied", "sent", "replied", "converted", "skipped"] as const;
const KINDS: ManualKind[] = ["like", "repost", "other"];

function statusClass(status: string): string {
  if (status === "converted") return "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80";
  if (status === "replied") return "bg-sky-100 text-sky-900 ring-1 ring-sky-200/80";
  if (status === "sent" || status === "copied") return "bg-amber-100 text-amber-900 ring-1 ring-amber-200/80";
  if (status === "skipped") return "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80";
  return "bg-slate-100 text-slate-800 ring-1 ring-slate-200/80";
}

function syncMessage(raw: string, t: (key: string, fallback: string) => string): string {
  const [code, ...rest] = raw.split("|");
  const detail = rest.join("|").trim();
  const fallbacks: Record<string, string> = {
    NO_IG_ACCOUNT: "Hubungkan akun Instagram bisnis organisasi ini dulu.",
    TOKEN_INVALID: "Token Instagram tidak berlaku. Sambungkan ulang dari Integrasi.",
    COMPETITOR_NOT_FOUND: "Username tidak ditemukan, atau akun itu bukan akun profesional publik.",
    RATE_LIMIT: "Meta membatasi permintaan. Coba lagi beberapa menit lagi.",
    COMMENTS_UNAVAILABLE: "Meta tidak memberikan daftar orang yang komentar di akun orang lain. Tombol ini hanya bisa menarik komentar dari akun Instagram yang sudah terhubung di Integrasi. Untuk akun lain, tempel username secara manual.",
    META_ERROR: "Meta tidak mengembalikan komentar.",
    CAMPAIGN_NOT_FOUND: "Kampanye tidak ditemukan.",
    OWNER_REQUIRED: "Hanya pemilik organisasi yang dapat menarik komentar.",
  };
  const label = t(`instagramOutreach.sync.${code}`, fallbacks[code] ?? fallbacks.META_ERROR);
  return detail ? `${label} ${detail}` : label;
}

type Props = {
  organizationId: string;
  campaign: OutreachCampaign;
  onBack: () => void;
};

export function OutreachDetail({ organizationId, campaign, onBack }: Props) {
  const { t } = useTranslation();
  const { createLead } = useLeads();
  const detail = useInstagramOutreachDetail(organizationId, campaign.id, true);
  const copiedToday = useOutreachCopiedToday(organizationId, true);
  const mutations = useInstagramOutreachMutations(organizationId);
  const [pasteText, setPasteText] = useState("");
  const [manualKind, setManualKind] = useState<ManualKind>("like");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [materialName, setMaterialName] = useState("");
  const [materialBody, setMaterialBody] = useState("");
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const materials = detail.data?.materials ?? [];
  const targets = detail.data?.targets ?? [];

  useEffect(() => {
    if (materials.length === 0) {
      setSelectedMaterialId(null);
      return;
    }
    if (!selectedMaterialId || !materials.some((item) => item.id === selectedMaterialId)) {
      setSelectedMaterialId(materials[0].id);
    }
  }, [materials, selectedMaterialId]);

  const selectedMaterial = materials.find((item) => item.id === selectedMaterialId) ?? null;
  const filtered = useMemo(
    () => targets.filter((target) => {
      if (statusFilter !== "all" && target.status !== statusFilter) return false;
      if (sourceFilter !== "all" && target.source !== sourceFilter) return false;
      return true;
    }),
    [sourceFilter, statusFilter, targets],
  );

  const copiedCount = copiedToday.data ?? 0;
  const showCap = copiedCount >= OUTREACH_DAILY_COPY_SOFT_CAP;

  const onSync = async () => {
    try {
      const summary = await mutations.syncCampaign.mutateAsync(campaign.id);
      toast.success(t("instagramOutreach.sync.summary", {
        posts: summary.posts_scanned,
        comments: summary.comments_seen,
        added: summary.usernames_added,
        updated: summary.usernames_updated,
        skipped: summary.skipped_no_username,
        likes: summary.like_count_total,
        defaultValue:
          "{{posts}} postingan, {{comments}} komentar, {{added}} akun baru, {{updated}} diperbarui, {{skipped}} tanpa username. Jumlah like: {{likes}}.",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "META_ERROR";
      toast.error(syncMessage(message, t));
    }
  };

  const onPaste = async () => {
    const parsed = parseManualUsernames(pasteText);
    if (parsed.valid.length === 0) {
      toast.error(t("instagramOutreach.paste.none", "Tidak ada username yang valid."));
      return;
    }
    try {
      const result = await mutations.pasteUsernames.mutateAsync({
        campaignId: campaign.id,
        usernames: parsed.valid,
        manualKind,
      });
      setPasteText("");
      const invalidNote = parsed.invalid.length > 0
        ? ` ${t("instagramOutreach.paste.invalid", "{{count}} token diabaikan.", { count: parsed.invalid.length })}`
        : "";
      toast.success(
        `${t("instagramOutreach.paste.added", "{{added}} akun baru, {{updated}} diperbarui.", {
          added: result.added,
          updated: result.updated,
        })}${invalidNote}`,
      );
    } catch {
      toast.error(t("instagramOutreach.sync.META_ERROR", "Meta tidak mengembalikan komentar."));
    }
  };

  const onCopy = async (target: OutreachTarget) => {
    if (!selectedMaterial) {
      toast.error(t("instagramOutreach.materials.needSelection", "Pilih materi dulu."));
      return;
    }
    try {
      await navigator.clipboard.writeText(interpolateOutreachBody(selectedMaterial.body, target.username));
      if (target.status === "new") await mutations.markCopied.mutateAsync(target);
      toast.success(t("instagramOutreach.action.copiedToast", "Naskah disalin. Tempel di Instagram."));
    } catch {
      toast.error(t("instagramOutreach.action.copyFailed", "Gagal menyalin naskah."));
    }
  };

  const onDownload = async (material: OutreachMaterial) => {
    if (!material.storage_path) return;
    try {
      await downloadOutreachMaterialFile(material.storage_path, material.file_name ?? material.name);
    } catch {
      toast.error(t("instagramOutreach.action.downloadFailed", "Gagal mengunduh lampiran."));
    }
  };

  const onConvert = async (target: OutreachTarget) => {
    if (convertingId) return;
    setConvertingId(target.id);
    let leadId: string | null = null;
    try {
      const { data: statuses, error: statusError } = await supabase
        .from("lead_statuses")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order");
      if (statusError) throw statusError;
      const rows = (statuses ?? []) as { id: string; name: string }[];
      const openStatus = rows.find((row) => row.name === "Open") ?? rows[0];
      const { data: userData } = await supabase.auth.getUser();
      const assignee = userData.user?.user_metadata?.full_name || userData.user?.email || "Owner";
      const lead = await createLead({
        client: `@${target.username}`,
        title: campaign.name,
        category: "Instagram Outreach",
        assignee,
        source: "Instagram Outreach",
        status_id: openStatus?.id,
        fu_priority: "Please Follow Up",
      });
      leadId = lead.id as string;
      await mutations.attachLead.mutateAsync({ target, leadId });
      toast.success(t("instagramOutreach.action.converted", "Lead dibuat."));
    } catch {
      if (leadId) {
        toast.error(t(
          "instagramOutreach.convert.linkFailed",
          "Lead sudah dibuat, tetapi status akun belum tertaut. Jangan klik lagi.",
        ));
      } else {
        toast.error(t("instagramOutreach.convert.failed", "Lead tidak dibuat. Status akun tidak berubah."));
      }
    } finally {
      setConvertingId(null);
    }
  };

  const onAddMaterial = async () => {
    const fileError = materialFile ? validateOutreachFile(materialFile) : null;
    if (fileError === "type") {
      toast.error(t("instagramOutreach.material.fileType", "Gunakan gambar JPEG, PNG, WebP, atau video MP4."));
      return;
    }
    if (fileError === "size") {
      toast.error(t("instagramOutreach.material.fileTooLarge", "Gambar maksimal 5 MB. Video maksimal 16 MB."));
      return;
    }
    try {
      await mutations.addMaterial.mutateAsync({
        campaignId: campaign.id,
        name: materialName,
        body: materialBody,
        file: materialFile,
        existingCount: materials.length,
      });
      setMaterialName("");
      setMaterialBody("");
      setMaterialFile(null);
      setFileInputKey((current) => current + 1);
      toast.success(t("instagramOutreach.material.saved", "Materi disimpan."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "limit") {
        toast.error(t("instagramOutreach.materials.limit", "Satu kampanye paling banyak 5 materi."));
        return;
      }
      if (message === "type") {
        toast.error(t("instagramOutreach.material.fileType", "Gunakan gambar JPEG, PNG, WebP, atau video MP4."));
        return;
      }
      if (message === "size") {
        toast.error(t("instagramOutreach.material.fileTooLarge", "Gambar maksimal 5 MB. Video maksimal 16 MB."));
        return;
      }
      toast.error(t("instagramOutreach.material.saveFailed", "Materi tidak tersimpan."));
    }
  };

  const syncError = campaign.last_sync_error
    ? syncMessage(campaign.last_sync_error, t)
    : null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            {t("instagramOutreach.detail.back", "Kembali")}
          </Button>
          <h2 className="truncate text-base font-semibold text-foreground">{campaign.name}</h2>
          <p className="text-xs text-muted-foreground">@{campaign.competitor_username}</p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (window.confirm(t("instagramOutreach.deleteCampaign", "Hapus kampanye ini?"))) {
                void mutations.deleteCampaign.mutateAsync(campaign.id).then(onBack).catch(() => {
                  toast.error(t("instagramOutreach.sync.META_ERROR", "Meta tidak mengembalikan komentar."));
                });
              }
            }}
          >
            {t("instagramOutreach.detail.delete", "Hapus")}
          </Button>
          <Button type="button" onClick={() => void onSync()} disabled={mutations.syncCampaign.isPending}>
            {mutations.syncCampaign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("instagramOutreach.detail.sync", "Tarik komentar")}
          </Button>
        </div>
      </div>

      {showCap ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t("instagramOutreach.dailyCap", {
            count: copiedCount,
            defaultValue:
              "Hari ini organisasi ini sudah menyalin {{count}} naskah. Instagram dapat membatasi akun yang mengirim banyak DM.",
          })}
        </div>
      ) : null}

      {syncError ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p>{syncError}</p>
          {campaign.last_sync_error?.startsWith("NO_IG_ACCOUNT") || campaign.last_sync_error?.startsWith("TOKEN_INVALID") ? (
            <Link className="mt-1 inline-block underline" to="/omnichannel/integrations/instagram">
              {t("instagramOutreach.create.connectLink", "Buka integrasi Instagram")}
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className={CAMPAIGN_MAIN_GRID}>
        <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch xl:col-span-8">
          <div className={CAMPAIGN_TABLE_SECTION}>
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className="space-y-3 border-b border-border p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                    <div className="space-y-1">
                      <Label htmlFor="outreach-paste">{t("instagramOutreach.detail.pasteLabel", "Tempel username")}</Label>
                      <Textarea
                        id="outreach-paste"
                        value={pasteText}
                        onChange={(event) => setPasteText(event.target.value)}
                        placeholder={t("instagramOutreach.detail.pastePlaceholder", "Satu username per baris, atau pisahkan dengan koma")}
                        rows={3}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t("instagramOutreach.detail.pasteKind", "Jenis")}</Label>
                      <Select value={manualKind} onValueChange={(value) => setManualKind(value as ManualKind)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {KINDS.map((kind) => (
                            <SelectItem key={kind} value={kind}>
                              {t(`instagramOutreach.detail.kind.${kind}`, kind)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button type="button" onClick={() => void onPaste()} disabled={mutations.pasteUsernames.isPending}>
                        {t("instagramOutreach.detail.pasteSubmit", "Tambah")}
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={t("instagramOutreach.detail.filter.status", "Status")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("instagramOutreach.detail.filter.all", "Semua status")}</SelectItem>
                        {STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {t(`instagramOutreach.status.${status}`, status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={sourceFilter} onValueChange={setSourceFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={t("instagramOutreach.detail.filter.source", "Sumber")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("instagramOutreach.detail.filter.allSources", "Semua sumber")}</SelectItem>
                        <SelectItem value="comment">{t("instagramOutreach.source.comment", "Komentar")}</SelectItem>
                        <SelectItem value="manual">{t("instagramOutreach.source.manual", "Manual")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="scrollbar-hide nested-scroll-touch-chain seamless-scroll min-h-0 flex-1 overflow-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {detail.isError ? (
                    <p className="px-4 py-6 text-sm text-muted-foreground">
                      {t("instagramOutreach.detail.loadFailed", "Daftar akun tidak dapat dimuat.")}
                    </p>
                  ) : detail.isLoading ? (
                    <p className="sr-only">{t("instagramOutreach.loadingAria", "Memuat outreach Instagram")}</p>
                  ) : filtered.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-muted-foreground">
                      {t("instagramOutreach.detail.emptyTargets", "Belum ada akun. Tarik komentar atau tempel username.")}
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("instagramOutreach.col.username", "Username")}</TableHead>
                          <TableHead>{t("instagramOutreach.col.source", "Sumber")}</TableHead>
                          <TableHead>{t("instagramOutreach.col.kind", "Jenis")}</TableHead>
                          <TableHead>{t("instagramOutreach.col.comment", "Komentar")}</TableHead>
                          <TableHead>{t("instagramOutreach.col.status", "Status")}</TableHead>
                          <TableHead>{t("instagramOutreach.col.actions", "Aksi")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((target) => (
                          <TableRow key={target.id}>
                            <TableCell className="font-medium">@{target.username}</TableCell>
                            <TableCell>{t(`instagramOutreach.source.${target.source}`, target.source)}</TableCell>
                            <TableCell>
                              {target.manual_kind
                                ? t(`instagramOutreach.detail.kind.${target.manual_kind}`, target.manual_kind)
                                : "—"}
                            </TableCell>
                            <TableCell className="max-w-[220px]">
                              <span className="line-clamp-2 text-xs text-muted-foreground">{target.comment_text ?? "—"}</span>
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${statusClass(target.status)}`}>
                                {t(`instagramOutreach.status.${target.status}`, target.status)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                <Button type="button" size="sm" variant="outline" onClick={() => void onCopy(target)}>
                                  {t("instagramOutreach.action.copy", "Salin")}
                                </Button>
                                {selectedMaterial?.storage_path ? (
                                  <Button type="button" size="sm" variant="outline" onClick={() => void onDownload(selectedMaterial)}>
                                    {t("instagramOutreach.action.download", "Unduh")}
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(`https://www.instagram.com/${target.username}/`, "_blank", "noopener,noreferrer")}
                                >
                                  {t("instagramOutreach.action.openProfile", "Profil")}
                                </Button>
                                {target.status === "new" || target.status === "copied" ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => void mutations.markStatus.mutateAsync({ target, status: "sent" })}
                                  >
                                    {t("instagramOutreach.action.markSent", "Terkirim")}
                                  </Button>
                                ) : null}
                                {target.status === "new" || target.status === "copied" || target.status === "sent" ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => void mutations.markStatus.mutateAsync({ target, status: "replied" })}
                                  >
                                    {t("instagramOutreach.action.markReplied", "Dibalas")}
                                  </Button>
                                ) : null}
                                {target.status !== "converted" && target.status !== "skipped" ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => void mutations.markStatus.mutateAsync({ target, status: "skipped" })}
                                  >
                                    {t("instagramOutreach.action.skip", "Lewati")}
                                  </Button>
                                ) : null}
                                {target.lead_id ? (
                                  <Button type="button" size="sm" variant="ghost" asChild>
                                    <Link to="/omnichannel/leads">{t("instagramOutreach.action.viewLead", "Lihat lead")}</Link>
                                  </Button>
                                ) : target.status !== "skipped" ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={convertingId === target.id}
                                    onClick={() => void onConvert(target)}
                                  >
                                    {t("instagramOutreach.action.convert", "Jadi tamu")}
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
              <CampaignPanelFooter
                count={filtered.length}
                sectionLabel={t("instagramOutreach.footer.targets", "akun")}
              />
            </div>
          </div>
        </div>

        <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch xl:col-span-4">
          <div className={CAMPAIGN_TABLE_SECTION}>
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="scrollbar-hide nested-scroll-touch-chain seamless-scroll min-h-0 flex-1 space-y-4 overflow-auto p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div>
                  <h3 className="text-sm font-semibold">{t("instagramOutreach.materials.title", "Materi")}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(
                      "instagramOutreach.materials.emptyBody",
                      "Siapkan dua materi: perkenalan dengan foto menu, dan ajakan dengan video 10–15 detik. Gunakan {username} di naskah.",
                    )}
                  </p>
                </div>
                {materials.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("instagramOutreach.materials.emptyTitle", "Belum ada materi.")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {materials.map((material) => (
                      <div key={material.id} className="flex gap-2 rounded-md border border-border p-2">
                        <label className="flex min-w-0 flex-1 cursor-pointer gap-2">
                          <input
                            type="radio"
                            name="outreach-material"
                            checked={selectedMaterialId === material.id}
                            onChange={() => setSelectedMaterialId(material.id)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{material.name}</span>
                            <span className="line-clamp-3 text-xs text-muted-foreground">
                              {interpolateOutreachBody(material.body, "username")}
                            </span>
                            {material.attachment_kind ? (
                              <span className="mt-1 block text-xs text-muted-foreground">
                                {material.attachment_kind === "image"
                                  ? t("instagramOutreach.materials.image", "Gambar")
                                  : t("instagramOutreach.materials.video", "Video")}
                              </span>
                            ) : null}
                          </span>
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void mutations.deleteMaterial.mutateAsync(material)}
                        >
                          {t("instagramOutreach.materials.remove", "Hapus")}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {materials.length < OUTREACH_MAX_MATERIALS ? (
                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="space-y-1">
                      <Label htmlFor="material-name">{t("instagramOutreach.materials.name", "Nama materi")}</Label>
                      <Input id="material-name" value={materialName} onChange={(event) => setMaterialName(event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="material-body">{t("instagramOutreach.materials.body", "Naskah")}</Label>
                      <Textarea
                        id="material-body"
                        value={materialBody}
                        onChange={(event) => setMaterialBody(event.target.value)}
                        rows={5}
                        maxLength={1000}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="material-file">{t("instagramOutreach.materials.file", "Gambar atau video")}</Label>
                      <Input
                        key={fileInputKey}
                        id="material-file"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,video/mp4"
                        onChange={(event) => setMaterialFile(event.target.files?.[0] ?? null)}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => void onAddMaterial()}
                      disabled={!materialName.trim() || !materialBody.trim() || mutations.addMaterial.isPending}
                    >
                      {t("instagramOutreach.materials.add", "Simpan materi")}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("instagramOutreach.materials.limit", "Satu kampanye paling banyak 5 materi.")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
