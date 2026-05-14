import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Megaphone, Bell, KeyRound, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";
import { toast } from "sonner";
import { useWhatsAppAccounts } from "@/5-3-whatsapp/hooks/useWhatsAppAccounts";
import type { WhatsAppAccount } from "@/5-3-whatsapp/types";
import { useCreateWhatsAppMessageTemplate } from "../hooks/useCreateWhatsAppMessageTemplate";
import { useWhatsAppTemplateHeaderUpload } from "../hooks/useWhatsAppTemplateHeaderUpload";
import type { TemplateHeaderMediaFormat } from "../hooks/useWhatsAppTemplateHeaderUpload";
import { TemplateRichTextArea } from "./TemplateRichTextArea";
import { TemplateHeaderTextField } from "./TemplateHeaderTextField";
import {
  TemplateButtonsEditor,
  buildMetaButtonsPayload,
  ensureFlowTemplateButton,
  validateTemplateButtons,
} from "./TemplateButtonsEditor";
import { languageCodeToLabel } from "../utils/languageDisplay";
import { sortedUniqueVariableIndices, validateSequentialVariables } from "../utils/templateTextEditor";
import type { WizardTemplateButton } from "../types";

const STEPS = ["Set up template", "Edit template", "Submit for Review"] as const;

type Category = "MARKETING" | "UTILITY";

type HeaderMediaKind = "NONE" | "IMAGE" | "VIDEO" | "DOCUMENT";
type VariableKindOption = "NAME" | "NUMBER";

const ABOUT_TEMPLATES_URL =
  "https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates";

function sampleMatchesVariableKind(sample: string, kind: VariableKindOption): boolean {
  const t = sample.trim();
  if (!t) return false;
  if (kind === "NUMBER") return /^\d+$/.test(t);
  return /^[a-zA-ZÀ-ÿ0-9\s._,'@/-]+$/.test(t);
}

function wizardWhatsAppAccountLabel(a: WhatsAppAccount): string {
  const name = (a.whatsapp_business_name ?? "").trim();
  const phone = (a.display_phone_number ?? "").trim();
  if (name && phone) return `${name} (${phone})`;
  if (name) return name;
  if (phone) return phone;
  return a.phone_number_id;
}

export function CreateTemplateWizard({
  open,
  onOpenChange,
  whatsappAccountId = null,
  onWhatsappAccountIdChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** `organization_whatsapp_accounts.id` — awal pilihan saat wizard dibuka (disinkronkan dari halaman daftar). */
  whatsappAccountId?: string | null;
  /** Menyelaraskan dropdown akun di halaman template saat pengguna mengganti akun di wizard. */
  onWhatsappAccountIdChange?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { accounts: waAccounts, isLoading: waAccountsLoading } = useWhatsAppAccounts();
  const [wizardWaAccountId, setWizardWaAccountId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<Category>("MARKETING");
  const [messageType, setMessageType] = useState("default");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("id");
  const [headerText, setHeaderText] = useState("");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [headerSample, setHeaderSample] = useState("");
  const [bodyVariableSamples, setBodyVariableSamples] = useState<Record<number, string>>({});
  const [templateButtons, setTemplateButtons] = useState<WizardTemplateButton[]>([]);
  const [variableKind, setVariableKind] = useState<VariableKindOption>("NUMBER");
  const [headerMediaKind, setHeaderMediaKind] = useState<HeaderMediaKind>("NONE");
  const [headerMediaHandle, setHeaderMediaHandle] = useState("");
  const headerFileInputRef = useRef<HTMLInputElement>(null);
  const headerUploadMutation = useWhatsAppTemplateHeaderUpload();
  const createMutation = useCreateWhatsAppMessageTemplate();

  const effectiveWaAccountId =
    wizardWaAccountId && waAccounts.some((a) => a.id === wizardWaAccountId)
      ? wizardWaAccountId
      : waAccounts[0]?.id ?? null;

  const waAccountIdsKey = useMemo(() => waAccounts.map((a) => a.id).sort().join(","), [waAccounts]);

  useEffect(() => {
    if (!open) {
      setWizardWaAccountId(null);
      return;
    }
    if (!waAccountIdsKey) {
      setWizardWaAccountId(null);
      return;
    }
    setWizardWaAccountId((prev) => {
      if (prev && waAccounts.some((a) => a.id === prev)) return prev;
      const fromPage =
        whatsappAccountId && waAccounts.some((a) => a.id === whatsappAccountId) ? whatsappAccountId : null;
      return fromPage ?? waAccounts[0].id;
    });
  }, [open, whatsappAccountId, waAccountIdsKey, waAccounts]);

  useEffect(() => {
    const idx = sortedUniqueVariableIndices(body);
    setBodyVariableSamples((prev) => {
      const next: Record<number, string> = {};
      for (const n of idx) next[n] = prev[n] ?? "";
      return next;
    });
  }, [body]);

  const reset = () => {
    setStep(0);
    setCategory("MARKETING");
    setMessageType("default");
    setName("");
    setLanguage("id");
    setHeaderText("");
    setBody("");
    setFooter("");
    setHeaderSample("");
    setBodyVariableSamples({});
    setTemplateButtons([]);
    setVariableKind("NUMBER");
    setHeaderMediaKind("NONE");
    setHeaderMediaHandle("");
    setWizardWaAccountId(null);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const buildComponents = (): Array<Record<string, unknown>> => {
    const comps: Array<Record<string, unknown>> = [];
    if (headerMediaKind !== "NONE") {
      const handle = headerMediaHandle.trim();
      if (handle) {
        comps.push({
          type: "HEADER",
          format: headerMediaKind,
          example: { header_handle: [handle] },
        });
      }
    } else {
      const header = headerText.trim().slice(0, 60);
      if (header) {
        const hc: Record<string, unknown> = { type: "HEADER", format: "TEXT", text: header };
        if (/\{\{1\}\}/.test(header)) {
          const ex = (headerSample || "").trim() || "Contoh";
          hc.example = { header_text: [ex] };
        }
        comps.push(hc);
      }
    }
    const bodyComp: Record<string, unknown> = { type: "BODY", text: body.trim() };
    const bodyVars = sortedUniqueVariableIndices(body);
    if (bodyVars.length) {
      bodyComp.example = {
        body_text: [bodyVars.map((n) => (bodyVariableSamples[n] ?? "").trim() || `sample_${n}`)],
      };
    }
    comps.push(bodyComp);
    if (footer.trim()) comps.push({ type: "FOOTER", text: footer.trim().slice(0, 60) });
    if (templateButtons.length > 0) {
      comps.push({ type: "BUTTONS", buttons: buildMetaButtonsPayload(templateButtons) });
    }
    return comps;
  };

  const validateEditStep = (): boolean => {
    const t = name.trim().toLowerCase();
    if (!/^[a-z0-9_]+$/.test(t)) {
      toast.error("Nama template tidak valid (snake_case).");
      return false;
    }
    if (t.length > 512) {
      toast.error("Nama template maksimal 512 karakter.");
      return false;
    }
    if (!body.trim()) {
      toast.error("Body wajib diisi.");
      return false;
    }
    if (body.length > 1024) {
      toast.error("Body maksimal 1024 karakter.");
      return false;
    }
    if (headerMediaKind === "NONE" && headerText.trim().length > 60) {
      toast.error("Header maksimal 60 karakter.");
      return false;
    }
    if (headerMediaKind !== "NONE") {
      if (!headerMediaHandle.trim()) {
        toast.error("Header media: tempel header_handle dari hasil upload media (Resumable Upload API Meta).");
        return false;
      }
    }
    if (headerMediaKind === "NONE") {
      const hv = sortedUniqueVariableIndices(headerText);
      if (hv.some((n) => n !== 1)) {
        toast.error("Header teks hanya mendukung variabel {{1}}.");
        return false;
      }
      const hSeq = validateSequentialVariables(headerText, "Header");
      if (hSeq) {
        toast.error(hSeq);
        return false;
      }
    }
    const bSeq = validateSequentialVariables(body, "Body");
    if (bSeq) {
      toast.error(bSeq);
      return false;
    }
    if (/\{\{\d+\}\}/.test(footer)) {
      toast.error("Footer tidak mendukung variabel.");
      return false;
    }
    if (headerMediaKind === "NONE" && /\{\{1\}\}/.test(headerText.trim()) && !(headerSample || "").trim()) {
      toast.error("Isi contoh untuk variabel header {{1}}.");
      return false;
    }
    const bv = sortedUniqueVariableIndices(body);
    for (const n of bv) {
      const raw = (bodyVariableSamples[n] ?? "").trim();
      if (!raw) {
        toast.error(`Lengkapi contoh isi untuk variabel {{${n}}} di body.`);
        return false;
      }
      if (!sampleMatchesVariableKind(raw, variableKind)) {
        toast.error(
          variableKind === "NUMBER"
            ? `Contoh untuk {{${n}}} harus angka saja (tanpa spasi) sesuai tipe variabel Number.`
            : `Contoh untuk {{${n}}} tidak valid untuk tipe Name (gunakan huruf/angka/spasi umum).`,
        );
        return false;
      }
    }
    if (headerMediaKind === "NONE" && /\{\{1\}\}/.test(headerText.trim())) {
      const hs = (headerSample || "").trim();
      if (!sampleMatchesVariableKind(hs, variableKind)) {
        toast.error(
          variableKind === "NUMBER"
            ? "Contoh header {{1}} harus angka saja untuk tipe Number."
            : "Contoh header {{1}} tidak valid untuk tipe Name.",
        );
        return false;
      }
    }
    const btnErr = validateTemplateButtons(templateButtons);
    if (btnErr) {
      toast.error(btnErr);
      return false;
    }
    return true;
  };

  const submit = async () => {
    const trimmed = name.trim().toLowerCase();
    if (!/^[a-z0-9_]+$/.test(trimmed)) {
      toast.error("Nama template: huruf kecil, angka, dan underscore saja.");
      return;
    }
    if (!validateEditStep()) return;
    if (waAccounts.length > 0 && !effectiveWaAccountId) {
      toast.error("Pilih akun WhatsApp terlebih dahulu (langkah Set up template).");
      return;
    }
    try {
      await createMutation.mutateAsync({
        name: trimmed,
        language,
        category,
        components: buildComponents(),
        ...(effectiveWaAccountId ? { whatsapp_account_id: effectiveWaAccountId } : {}),
      });
      toast.success("Template dikirim ke Meta untuk ditinjau.");
      handleClose(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat template");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        fullscreenAnimation
        className={cn(
          "flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-none sm:h-[100dvh] sm:max-h-[100dvh] sm:rounded-none",
          "left-0 top-0 translate-x-0 translate-y-0",
        )}
      >
        <div className="shrink-0 border-b border-slate-100">
          <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
            {STEPS.map((label, i) => (
              <div key={label} className="flex flex-1 items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                    i === step ? "border-brand-blue bg-brand-blue/10 text-brand-blue" : "border-slate-200 text-slate-400",
                  )}
                >
                  {i + 1}
                </div>
                <span className={cn("hidden text-sm font-medium sm:inline", i === step ? "text-slate-900" : "text-slate-400")}>{label}</span>
                {i < STEPS.length - 1 ? <div className="mx-1 hidden h-px min-w-[1rem] flex-1 bg-slate-200 sm:block" /> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-1 flex-col px-4 py-4 sm:px-6 sm:py-5">
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-hidden sm:gap-6 md:grid-cols-2 md:gap-8">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain pr-0 md:pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {step === 0 ? (
                <>
                  <DialogHeader className="space-y-1 p-0 text-left">
                    <DialogTitle className="text-lg">Set up your template</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                      Pilih akun WhatsApp, lalu kategori dan jenis pesan. Autentikasi hanya didukung lewat Meta Business Manager.
                    </p>
                  </DialogHeader>

                  {waAccountsLoading ? (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-800">Akun WhatsApp</Label>
                      <div className="h-9 w-full max-w-md animate-pulse rounded-md bg-slate-100" aria-busy aria-label="Memuat daftar akun" />
                    </div>
                  ) : waAccounts.length > 0 ? (
                    <div className="space-y-2">
                      <Label htmlFor="wizard-wa-account" className="text-sm font-medium text-slate-800">
                        Akun WhatsApp
                      </Label>
                      <Select
                        value={effectiveWaAccountId ?? ""}
                        onValueChange={(id) => {
                          setWizardWaAccountId(id);
                          onWhatsappAccountIdChange?.(id);
                        }}
                      >
                        <SelectTrigger id="wizard-wa-account" className="h-9 w-full max-w-md font-normal">
                          <SelectValue placeholder="Pilih akun" />
                        </SelectTrigger>
                        <SelectContent align="start">
                          {waAccounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {wizardWhatsAppAccountLabel(a)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Template akan dibuat di WABA Meta untuk akun ini (sama dengan daftar template di halaman utama).
                      </p>
                    </div>
                  ) : (
                    <div
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
                      role="status"
                    >
                      <span>{t("whatsappTemplates.createWizard.noWhatsAppAccountLead")}</span>{" "}
                      <Link
                        to="/omnichannel/integrations/whatsapp"
                        className="font-semibold text-amber-950 underline underline-offset-2 hover:text-amber-900"
                      >
                        {t("whatsappTemplates.createWizard.connectWhatsAppLink")}
                      </Link>
                      <span> {t("whatsappTemplates.createWizard.noWhatsAppAccountTrail")}</span>
                    </div>
                  )}

                  <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50/80 p-1">
                    <button
                      type="button"
                      onClick={() => setCategory("MARKETING")}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium sm:text-sm",
                        category === "MARKETING" ? "bg-white shadow-sm" : "text-muted-foreground",
                      )}
                    >
                      <Megaphone className="h-4 w-4 shrink-0" />
                      Marketing
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategory("UTILITY")}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium sm:text-sm",
                        category === "UTILITY" ? "bg-white shadow-sm" : "text-muted-foreground",
                      )}
                    >
                      <Bell className="h-4 w-4 shrink-0" />
                      Utility
                    </button>
                    <button
                      type="button"
                      disabled
                      className="flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-slate-400 sm:text-sm"
                      title="Gunakan Meta Business Manager untuk template Authentication"
                    >
                      <KeyRound className="h-4 w-4 shrink-0" />
                      Authentication
                    </button>
                  </div>
                  <RadioGroup
                    value={messageType}
                    onValueChange={(v) => {
                      setMessageType(v);
                      if (v === "flows") {
                        setTemplateButtons((prev) => ensureFlowTemplateButton(prev));
                      }
                    }}
                    className="space-y-2"
                  >
                    <label
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm",
                        messageType === "default" ? "border-brand-blue/40 bg-brand-blue/5" : "border-slate-200",
                      )}
                    >
                      <RadioGroupItem value="default" className="mt-0.5" />
                      <div>
                        <div className="font-medium">Default</div>
                        <div className="text-xs text-muted-foreground">
                          Kirim pesan dengan media dan tombol kustom (bangun di langkah berikutnya).
                        </div>
                      </div>
                    </label>
                    <label
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm",
                        messageType === "flows" ? "border-brand-blue/40 bg-brand-blue/5" : "border-slate-200",
                      )}
                    >
                      <RadioGroupItem value="flows" className="mt-0.5" />
                      <div>
                        <div className="font-medium">Flows</div>
                        <div className="text-xs text-muted-foreground">
                          Form atau survei interaktif. Di langkah berikutnya tambahkan tombol bertipe Flow dan tautkan flow yang sudah
                          dipublikasikan di WhatsApp Manager.
                        </div>
                      </div>
                    </label>
                    {(
                      [
                        { key: "catalogue", title: "Catalogue", desc: "Menghubungkan katalog produk (segera)." },
                        { key: "calling", title: "Calling permissions request", desc: "Izin panggilan (segera)." },
                      ] as const
                    ).map((v) => (
                      <label
                        key={v.key}
                        className="flex cursor-not-allowed gap-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-sm text-slate-400"
                        title="Segera"
                      >
                        <RadioGroupItem value={v.key} className="mt-0.5" disabled />
                        <div>
                          <div className="font-medium text-slate-500">{v.title}</div>
                          <div className="text-xs">{v.desc}</div>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                </>
              ) : null}

              {step === 1 ? (
                <div className="space-y-6">
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-900">Template name and language</h3>
                    <div className="space-y-2">
                      <Label htmlFor="tpl-name">Name your template</Label>
                      <Input
                        id="tpl-name"
                        value={name}
                        onChange={(e) => setName(e.target.value.slice(0, 512))}
                        placeholder="Enter a template name."
                        autoComplete="off"
                        maxLength={512}
                      />
                      <p className="text-right text-xs tabular-nums text-muted-foreground">{name.trim().length}/512</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tpl-language">Select language</Label>
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger id="tpl-language" className="w-full max-w-md">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en_US">English</SelectItem>
                          <SelectItem value="id">Indonesian</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </section>

                  <div className="h-px bg-slate-200" />

                  <section className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Content</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Add a header, body and footer for your template. Cloud API hosted by Meta will review the template variables
                        and content to protect the security and integrity of our services.{" "}
                        <a
                          href={ABOUT_TEMPLATES_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[#1877F2] hover:underline"
                        >
                          About templates
                        </a>
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Label htmlFor="tpl-var-kind" className="text-sm font-medium text-slate-800">
                            Type of variable
                          </Label>
                          <span title="Mengatur format contoh variabel untuk peninjauan Meta: Name (teks) atau Number (angka saja).">
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                          </span>
                        </div>
                        <Select value={variableKind} onValueChange={(v) => setVariableKind(v as VariableKindOption)}>
                          <SelectTrigger id="tpl-var-kind">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NAME">Name</SelectItem>
                            <SelectItem value="NUMBER">Number</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tpl-media-sample">Media sample · Optional</Label>
                        <Select
                          value={headerMediaKind}
                          onValueChange={(v) => {
                            const next = v as HeaderMediaKind;
                            setHeaderMediaKind(next);
                            if (next !== "NONE") setHeaderText("");
                            setHeaderMediaHandle("");
                            if (headerFileInputRef.current) headerFileInputRef.current.value = "";
                          }}
                        >
                          <SelectTrigger id="tpl-media-sample">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE">None</SelectItem>
                            <SelectItem value="IMAGE">Image</SelectItem>
                            <SelectItem value="VIDEO">Video</SelectItem>
                            <SelectItem value="DOCUMENT">Document</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {headerMediaKind === "NONE" ? (
                      <TemplateHeaderTextField
                        id="tpl-header"
                        value={headerText}
                        onChange={setHeaderText}
                        maxLength={60}
                        placeholder={
                          language === "en_US"
                            ? "Add a short line of text to the header of your message in English"
                            : "Tambahkan teks singkat ke header pesan dalam Bahasa Indonesia"
                        }
                      />
                    ) : (
                      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                        <div>
                          <Label className="text-sm font-medium text-slate-800">
                            {headerMediaKind === "IMAGE"
                              ? "Gambar di bagian atas pesan"
                              : headerMediaKind === "VIDEO"
                                ? "Video di bagian atas pesan"
                                : "File dokumen di bagian atas pesan"}
                          </Label>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            Unggah satu file contoh yang akan ditampilkan di atas teks utama. WhatsApp akan memeriksa file ini
                            sebelum template disetujui. Gunakan format{" "}
                            {headerMediaKind === "IMAGE"
                              ? "foto JPG atau PNG."
                              : headerMediaKind === "VIDEO"
                                ? "video MP4."
                                : "berkas PDF."}{" "}
                            Setelah unggah selesai, kode otomatis akan terisi—Anda tidak perlu menyalin apa pun kecuali ingin
                            menggantinya.
                          </p>
                        </div>
                        <input
                          ref={headerFileInputRef}
                          type="file"
                          className="hidden"
                          accept={
                            headerMediaKind === "IMAGE"
                              ? "image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png"
                              : headerMediaKind === "VIDEO"
                                ? "video/mp4,.mp4"
                                : "application/pdf,.pdf"
                          }
                          onChange={() => {
                            /* handled by upload button reading files */
                          }}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => headerFileInputRef.current?.click()}
                            disabled={headerUploadMutation.isPending}
                          >
                            Pilih file
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="bg-[#1877F2] hover:bg-[#166FE5]"
                            disabled={headerUploadMutation.isPending}
                            onClick={() => {
                              const input = headerFileInputRef.current;
                              const f = input?.files?.[0];
                              if (!f) {
                                toast.error("Pilih file terlebih dahulu.");
                                return;
                              }
                              const fmt = headerMediaKind as TemplateHeaderMediaFormat;
                              void headerUploadMutation
                                .mutateAsync({ file: f, format: fmt, whatsappAccountId: effectiveWaAccountId })
                                .then(
                                (r) => {
                                  setHeaderMediaHandle(r.header_handle);
                                  toast.success("File berhasil diunggah. Anda bisa melanjutkan mengisi template.");
                                },
                                (err: unknown) => {
                                  toast.error(err instanceof Error ? err.message : "Upload gagal");
                                },
                              );
                            }}
                          >
                            {headerUploadMutation.isPending ? "Mengunggah…" : "Unggah ke WhatsApp"}
                          </Button>
                          {headerMediaHandle ? (
                            <Button type="button" variant="ghost" size="sm" onClick={() => {
                              setHeaderMediaHandle("");
                              if (headerFileInputRef.current) headerFileInputRef.current.value = "";
                            }}>
                              Hapus & pilih ulang
                            </Button>
                          ) : null}
                        </div>
                        {headerMediaHandle ? (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-green-800">Unggah berhasil</p>
                            <p className="break-all rounded border border-green-200 bg-green-50/80 px-2 py-1.5 font-mono text-[10px] text-green-900">
                              {headerMediaHandle.length > 120 ? `${headerMediaHandle.slice(0, 120)}…` : headerMediaHandle}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Teks panjang di bawah hanya untuk pengecekan; tidak perlu diingat atau disalin.
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Belum ada file yang diunggah. Silakan pilih file lalu tekan &quot;Unggah ke WhatsApp&quot; sebelum mengirim
                            template.
                          </p>
                        )}
                        <details className="text-xs">
                          <summary className="cursor-pointer font-medium text-[#1877F2]">Punya kode dari tempat lain? (lanjutan)</summary>
                          <div className="mt-2 space-y-1">
                            <Label htmlFor="tpl-header-handle" className="text-muted-foreground">
                              Tempel kode di sini (jarang dipakai)
                            </Label>
                            <Input
                              id="tpl-header-handle"
                              value={headerMediaHandle}
                              onChange={(e) => setHeaderMediaHandle(e.target.value)}
                              placeholder="Tempel kode yang Anda dapat dari tim IT atau dokumentasi"
                              className="text-xs"
                            />
                          </div>
                        </details>
                      </div>
                    )}

                    <TemplateRichTextArea
                      id="tpl-body"
                      label="Body"
                      mode="body"
                      value={body}
                      onChange={setBody}
                      maxLength={1024}
                      minRows={7}
                    />

                    {sortedUniqueVariableIndices(body).length > 0 || (headerMediaKind === "NONE" && /\{\{1\}\}/.test(headerText)) ? (
                      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/90 p-3">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Include samples of all variables in your message to help Meta review your template. Remember not to include
                          any customer information to protect your customer&apos;s privacy.
                        </p>
                        {headerMediaKind === "NONE" && /\{\{1\}\}/.test(headerText.trim()) ? (
                          <div className="space-y-1.5">
                            <Label htmlFor="sample-header-1" className="text-xs font-medium text-slate-700">
                              Header — <code className="rounded bg-white px-1">{"{{1}}"}</code>
                            </Label>
                            <Input
                              id="sample-header-1"
                              value={headerSample}
                              onChange={(e) => setHeaderSample(e.target.value)}
                              placeholder="Enter content for {{1}}"
                              maxLength={128}
                            />
                          </div>
                        ) : null}
                        {sortedUniqueVariableIndices(body).map((n) => (
                          <div key={n} className="space-y-1.5">
                            <Label htmlFor={`sample-body-${n}`} className="text-xs font-medium text-slate-700">
                              Body — <code className="rounded bg-white px-1">{`{{${n}}}`}</code>
                            </Label>
                            <Input
                              id={`sample-body-${n}`}
                              value={bodyVariableSamples[n] ?? ""}
                              onChange={(e) =>
                                setBodyVariableSamples((prev) => ({
                                  ...prev,
                                  [n]: e.target.value,
                                }))
                              }
                              placeholder={`Enter content for {{${n}}}`}
                              maxLength={128}
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <Label htmlFor="tpl-footer" className="text-sm font-medium text-slate-800">
                        Footer<span className="font-normal text-muted-foreground"> · Optional</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="tpl-footer"
                          value={footer}
                          onChange={(e) => setFooter(e.target.value.slice(0, 60))}
                          maxLength={60}
                          className="h-11 pr-14"
                          placeholder={
                            language === "en_US"
                              ? "Add a short line of text to the bottom of your message in English"
                              : "Tambahkan teks singkat di bagian bawah pesan (Bahasa Indonesia)"
                          }
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums text-muted-foreground">
                          {footer.length}/60
                        </span>
                      </div>
                    </div>
                  </section>

                  <div className="h-px bg-slate-200" />

                  <TemplateButtonsEditor buttons={templateButtons} onChange={setTemplateButtons} />
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-3 text-sm">
                  <DialogHeader className="space-y-1 p-0 text-left">
                    <DialogTitle className="text-lg">Submit for Review</DialogTitle>
                    <p className="text-muted-foreground">Periksa ringkasan sebelum dikirim ke Meta.</p>
                  </DialogHeader>
                  <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-2">
                    <div>
                      <span className="text-muted-foreground">Nama:</span> <span className="font-medium">{name || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Kategori:</span> <span className="font-medium">{category}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bahasa:</span>{" "}
                      <span className="font-medium">
                        {languageCodeToLabel(language)} ({language})
                      </span>
                    </div>
                    {headerMediaKind !== "NONE" ? (
                      <div>
                        <span className="text-muted-foreground">Header media:</span>{" "}
                        <span className="font-medium">
                          {headerMediaKind}
                          {headerMediaHandle.trim()
                            ? ` (${headerMediaHandle.trim().length > 28 ? `${headerMediaHandle.trim().slice(0, 24)}…` : headerMediaHandle.trim()})`
                            : ""}
                        </span>
                      </div>
                    ) : headerText.trim() ? (
                      <div>
                        <span className="text-muted-foreground">Header:</span>
                        <p className="mt-1 whitespace-pre-wrap rounded bg-white p-2 text-slate-800">{headerText}</p>
                      </div>
                    ) : null}
                    <div>
                      <span className="text-muted-foreground">Tipe variabel contoh:</span>{" "}
                      <span className="font-medium">{variableKind === "NAME" ? "Name" : "Number"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Body:</span>
                      <p className="mt-1 whitespace-pre-wrap rounded bg-white p-2 text-slate-800">{body || "—"}</p>
                    </div>
                    {footer.trim() ? (
                      <div>
                        <span className="text-muted-foreground">Footer:</span> <span className="font-medium">{footer}</span>
                      </div>
                    ) : null}
                    <div>
                      <span className="text-muted-foreground">Tombol:</span>
                      {templateButtons.length === 0 ? (
                        <p className="mt-1 text-slate-600">Tidak ada tombol (opsional).</p>
                      ) : (
                        <ul className="mt-1 list-inside list-disc space-y-0.5 text-slate-800">
                          {templateButtons.map((b) => (
                            <li key={b.id} className="text-sm">
                              <span className="font-medium">{b.kind}</span>
                              {b.kind === "COPY_CODE" ? (
                                <>: contoh kode {b.offerExample.trim() || "—"}</>
                              ) : (
                                <>
                                  {": "}
                                  {b.text.trim() || "—"}
                                  {b.kind === "URL" ? ` → ${b.url.trim()}` : null}
                                  {b.kind === "PHONE_NUMBER" ? ` → ${b.phoneNumber.trim()}` : null}
                                  {b.kind === "FLOW"
                                    ? ` → flow ${b.flowId.trim() || "—"}${b.flowIcon !== "DEFAULT" ? ` · icon ${b.flowIcon}` : ""}`
                                    : null}
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-slate-50/90 p-4 md:min-h-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <h3 className="shrink-0 text-sm font-semibold text-slate-800">Template preview</h3>
              <div className="mt-4 flex min-h-0 flex-1 justify-center md:items-start">
                <div className="w-full max-w-[260px] rounded-2xl border border-slate-200 bg-[#e5ddd5] p-3 shadow-inner">
                  <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
                    {headerMediaKind !== "NONE" ? (
                      <p className="mb-1 border-b border-slate-100 pb-1 text-center text-xs font-medium text-slate-600">
                        [{headerMediaKind} header]
                      </p>
                    ) : headerText.trim() ? (
                      <p className="mb-1 border-b border-slate-100 pb-1 text-sm font-semibold text-slate-900 whitespace-pre-wrap">
                        {headerText}
                      </p>
                    ) : null}
                    {body.trim() ? (
                      <p className="text-sm text-slate-900 whitespace-pre-wrap">{body}</p>
                    ) : (
                      <p className="text-sm text-slate-400">Pratinjau body akan muncul di sini</p>
                    )}
                    {footer.trim() ? <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">{footer}</p> : null}
                    {templateButtons.length > 0 ? (
                      <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                        {templateButtons.map((b) => (
                          <div
                            key={b.id}
                            className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-xs font-medium text-[#027EB5]"
                          >
                            {b.kind === "COPY_CODE"
                              ? (b.offerExample.trim() ? `Copy: ${b.offerExample.trim()}` : "Copy code")
                              : b.text.trim() ||
                                (b.kind === "URL"
                                  ? "Website"
                                  : b.kind === "PHONE_NUMBER"
                                    ? "Call"
                                    : b.kind === "FLOW"
                                      ? "Flow"
                                      : b.kind === "VOICE_CALL"
                                        ? "WA Call"
                                        : "Balasan")}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-2 text-right text-[10px] text-slate-400">11:59</p>
                  </div>
                </div>
              </div>
              <p className="mt-4 shrink-0 text-xs text-muted-foreground">
                Template dikirim ke Meta untuk peninjauan. Status akan menjadi pending hingga disetujui.
              </p>
            </div>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-slate-100 p-0 sm:justify-center">
          <div className="mx-auto flex w-full max-w-screen-2xl flex-col-reverse gap-3 px-4 py-3 sm:flex-row sm:justify-between sm:px-6 sm:py-4">
            <Button type="button" variant="outline" onClick={() => (step === 0 ? handleClose(false) : setStep((s) => s - 1))}>
              {step === 0 ? "Discard" : "Back"}
            </Button>
            {step < 2 ? (
              <Button
                type="button"
                className="bg-[#1877F2] hover:bg-[#166FE5]"
                disabled={step === 0 && waAccountsLoading}
                onClick={() => {
                  if (step === 0 && waAccounts.length > 0 && !effectiveWaAccountId) {
                    toast.error("Pilih akun WhatsApp terlebih dahulu.");
                    return;
                  }
                  if (step === 1 && !validateEditStep()) return;
                  setStep((s) => s + 1);
                }}
              >
                Next
              </Button>
            ) : (
              <Button type="button" className="bg-[#1877F2] hover:bg-[#166FE5]" disabled={createMutation.isPending} onClick={() => void submit()}>
                {createMutation.isPending ? "Mengirim…" : "Submit"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
