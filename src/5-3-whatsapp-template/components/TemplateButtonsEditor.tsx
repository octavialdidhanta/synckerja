import {
  ChevronDown,
  ClipboardList,
  Copy,
  ExternalLink,
  Files,
  FileText,
  MessageCircle,
  MessageSquareReply,
  Phone,
  Plus,
  Tag,
  ThumbsUp,
  X,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useState } from "react";
import type { FlowTemplateButtonIcon, QuickReplyVariant, WizardTemplateButton } from "../types";
import { CreateWhatsAppFlowDialog } from "./CreateWhatsAppFlowDialog";

const BTN_TEXT_MAX = 25;
const URL_MAX = 2000;
const OFFER_CODE_MAX = 20;
/** WhatsApp Business Platform: up to 10 buttons total; this wizard keeps a small set aligned with common marketing templates. */
const MAX_BUTTONS = 10;

function newId(): string {
  return `btn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isQuickReply(b: WizardTemplateButton): boolean {
  return b.kind === "QUICK_REPLY";
}

/** Saat wizard memilih tipe pesan Flows: pastikan ada satu tombol Complete flow (tanpa duplikat). */
export function ensureFlowTemplateButton(buttons: WizardTemplateButton[]): WizardTemplateButton[] {
  if (buttons.some((b) => b.kind === "FLOW")) return buttons;
  if (buttons.length >= MAX_BUTTONS) return buttons;
  const flow = defaultButton("FLOW", newId());
  return [...buttons, { ...flow, text: "View flow" }];
}

function defaultButton(kind: WizardTemplateButton["kind"], id: string): WizardTemplateButton {
  switch (kind) {
    case "QUICK_REPLY":
      return { id, kind: "QUICK_REPLY", text: "", quickReplyVariant: "custom" };
    case "URL":
      return { id, kind: "URL", text: "", url: "https://", urlExample: "" };
    case "PHONE_NUMBER":
      return { id, kind: "PHONE_NUMBER", text: "", phoneNumber: "+" };
    case "FLOW":
      return {
        id,
        kind: "FLOW",
        text: "",
        flowId: "",
        flowAction: "navigate",
        navigateScreen: "",
        flowIcon: "DEFAULT",
        flowEntryMode: "existing",
      };
    case "COPY_CODE":
      return { id, kind: "COPY_CODE", offerExample: "" };
    case "VOICE_CALL":
      return { id, kind: "VOICE_CALL", text: "" };
  }
}

export function TemplateButtonsEditor({
  buttons,
  onChange,
}: {
  buttons: WizardTemplateButton[];
  onChange: (next: WizardTemplateButton[]) => void;
}) {
  const add = (kind: WizardTemplateButton["kind"]) => {
    if (buttons.length >= MAX_BUTTONS) return;
    onChange([...buttons, defaultButton(kind, newId())]);
  };

  const update = (id: string, patch: Partial<WizardTemplateButton>) => {
    onChange(
      buttons.map((b) => {
        if (b.id !== id) return b;
        return { ...b, ...patch } as WizardTemplateButton;
      }),
    );
  };

  const setKind = (id: string, kind: WizardTemplateButton["kind"]) => {
    onChange(buttons.map((b) => (b.id === id ? defaultButton(kind, b.id) : b)));
  };

  const remove = (id: string) => onChange(buttons.filter((b) => b.id !== id));

  const [flowDialogForButtonId, setFlowDialogForButtonId] = useState<string | null>(null);

  return (
    <>
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">
          Buttons<span className="font-normal text-muted-foreground"> · Optional</span>
        </h4>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={buttons.length >= MAX_BUTTONS}>
              <Plus className="h-4 w-4" />
              Add button
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem className="gap-2" onSelect={() => add("QUICK_REPLY")}>
              <MessageSquareReply className="h-4 w-4 shrink-0" />
              Custom (quick reply)
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onSelect={() => add("URL")}>
              <ExternalLink className="h-4 w-4 shrink-0" />
              Visit website
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onSelect={() => add("VOICE_CALL")}>
              <MessageCircle className="h-4 w-4 shrink-0" />
              Call on WhatsApp
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onSelect={() => add("PHONE_NUMBER")}>
              <Phone className="h-4 w-4 shrink-0" />
              Call phone number
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onSelect={() => add("FLOW")}>
              <ClipboardList className="h-4 w-4 shrink-0" />
              Complete flow
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onSelect={() => add("COPY_CODE")}>
              <Copy className="h-4 w-4 shrink-0" />
              Copy offer code
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="text-xs text-muted-foreground">
        Maksimal {MAX_BUTTONS} tombol. Teks tombol (jika dipakai) maksimal {BTN_TEXT_MAX} karakter. Quick reply harus berurutan di
        awal atau di akhir daftar (sesuai aturan WhatsApp).
      </p>

      {buttons.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-6 text-center text-sm text-muted-foreground">
          Opsional. Tambahkan quick reply, tautan, panggilan, flow, atau salin kode — sama seperti di Meta Business Suite.
        </div>
      ) : (
        <div className="space-y-3">
          {buttons.map((b, index) => (
            <div key={b.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-600">Button {index + 1}</span>
                <div className="flex items-center gap-2">
                  <Select value={b.kind} onValueChange={(v) => setKind(b.id, v as WizardTemplateButton["kind"])}>
                    <SelectTrigger className="h-8 min-w-[10.5rem] max-w-[14rem] text-xs">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="QUICK_REPLY">Quick reply</SelectItem>
                      <SelectItem value="URL">Visit website</SelectItem>
                      <SelectItem value="VOICE_CALL">Call on WhatsApp</SelectItem>
                      <SelectItem value="PHONE_NUMBER">Call phone number</SelectItem>
                      <SelectItem value="FLOW">Complete flow</SelectItem>
                      <SelectItem value="COPY_CODE">Copy offer code</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(b.id)}
                    title="Hapus tombol"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {b.kind === "QUICK_REPLY" ? (
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={b.quickReplyVariant ?? "custom"}
                      onValueChange={(v) => update(b.id, { quickReplyVariant: v as QuickReplyVariant })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">Custom</SelectItem>
                        <SelectItem value="prefilled">Pre-configured response</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {b.kind === "COPY_CODE" ? (
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    Di API WhatsApp, teks tombol &quot;Salin kode&quot; ditetapkan platform; yang dikirim ke Meta hanya contoh kode
                    untuk peninjauan (field <code className="rounded bg-white px-0.5">example</code>).
                  </p>
                ) : b.kind === "FLOW" ? null : (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs">Button text</Label>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {`${b.text.length}/${BTN_TEXT_MAX}`}
                      </span>
                    </div>
                    <Input
                      value={b.text}
                      onChange={(e) =>
                        update(b.id, { text: e.target.value.slice(0, BTN_TEXT_MAX) } as Partial<WizardTemplateButton>)
                      }
                      maxLength={BTN_TEXT_MAX}
                      placeholder={
                        b.kind === "QUICK_REPLY"
                          ? "Quick reply"
                          : b.kind === "VOICE_CALL"
                            ? "Call on WhatsApp"
                            : "Label tombol"
                      }
                    />
                  </div>
                )}

                {b.kind === "URL" ? (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Website URL</Label>
                      <Input
                        value={b.url}
                        onChange={(e) => update(b.id, { url: e.target.value.slice(0, URL_MAX) } as Partial<WizardTemplateButton>)}
                        placeholder="https://www.example.com"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        URL dinamis: sisipkan <code className="rounded bg-white px-0.5">{"{{1}}"}</code> di ujung query/path lalu
                        isi contoh URL lengkap (maks. {URL_MAX} karakter).
                      </p>
                    </div>
                    {/\{\{1\}\}/.test(b.url) ? (
                      <div className="space-y-1">
                        <Label className="text-xs">Contoh URL lengkap (peninjauan Meta)</Label>
                        <Input
                          value={b.urlExample}
                          onChange={(e) => update(b.id, { urlExample: e.target.value } as Partial<WizardTemplateButton>)}
                          placeholder="https://example.com/order/abc123"
                        />
                      </div>
                    ) : null}
                  </>
                ) : null}

                {b.kind === "PHONE_NUMBER" ? (
                  <div className="space-y-1">
                    <Label className="text-xs">Nomor (format E.164, contoh +628123456789)</Label>
                    <Input
                      value={b.phoneNumber}
                      onChange={(e) => update(b.id, { phoneNumber: e.target.value } as Partial<WizardTemplateButton>)}
                      placeholder="+628123456789"
                    />
                  </div>
                ) : null}

                {b.kind === "FLOW" ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-800">Type of action</Label>
                        <div className="flex h-9 items-center rounded-md border border-input bg-white px-3 text-xs text-slate-800 shadow-sm">
                          Complete flow
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-1 h-8 w-full gap-1 text-xs"
                          onClick={() => {
                            update(b.id, { flowEntryMode: "create_new" } as Partial<WizardTemplateButton>);
                            setFlowDialogForButtonId(b.id);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Create new
                        </Button>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-800">Button icon</Label>
                        <Select
                          value={b.flowIcon}
                          onValueChange={(v) =>
                            update(b.id, { flowIcon: v as FlowTemplateButtonIcon } as Partial<WizardTemplateButton>)
                          }
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Icon" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DEFAULT" className="text-xs">
                              <span className="flex items-center gap-2">
                                <ClipboardList className="h-4 w-4 shrink-0 opacity-70" />
                                Default
                              </span>
                            </SelectItem>
                            <SelectItem value="DOCUMENT" className="text-xs">
                              <span className="flex items-center gap-2">
                                <FileText className="h-4 w-4 shrink-0 opacity-70" />
                                Document
                              </span>
                            </SelectItem>
                            <SelectItem value="PROMOTION" className="text-xs">
                              <span className="flex items-center gap-2">
                                <Tag className="h-4 w-4 shrink-0 opacity-70" />
                                Promotion
                              </span>
                            </SelectItem>
                            <SelectItem value="REVIEW" className="text-xs">
                              <span className="flex items-center gap-2">
                                <ThumbsUp className="h-4 w-4 shrink-0 opacity-70" />
                                Review
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-1 h-8 w-full gap-1 text-xs"
                          onClick={() => {
                            update(b.id, { flowEntryMode: "existing" } as Partial<WizardTemplateButton>);
                            queueMicrotask(() => {
                              document.getElementById(`flow-id-input-${b.id}`)?.focus();
                            });
                          }}
                        >
                          <Files className="h-3.5 w-3.5" />
                          Use existing
                        </Button>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-800">Button text</Label>
                        <div className="flex items-center justify-end text-[10px] tabular-nums text-muted-foreground">
                          {b.text.length}/{BTN_TEXT_MAX}
                        </div>
                        <Input
                          id={`flow-cta-text-${b.id}`}
                          value={b.text}
                          onChange={(e) =>
                            update(b.id, { text: e.target.value.slice(0, BTN_TEXT_MAX) } as Partial<WizardTemplateButton>)
                          }
                          maxLength={BTN_TEXT_MAX}
                          placeholder="View flow"
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Flow ID</Label>
                      <Input
                        id={`flow-id-input-${b.id}`}
                        value={b.flowId}
                        onChange={(e) => update(b.id, { flowId: e.target.value.trim() } as Partial<WizardTemplateButton>)}
                        placeholder="ID flow yang sudah dipublikasikan di WhatsApp Manager"
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Flow action</Label>
                        <Select
                          value={b.flowAction}
                          onValueChange={(v) =>
                            update(b.id, { flowAction: v as "navigate" | "data_exchange" } as Partial<WizardTemplateButton>)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="navigate">navigate</SelectItem>
                            <SelectItem value="data_exchange">data_exchange</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Navigate screen (wajib jika navigate)</Label>
                        <Input
                          value={b.navigateScreen}
                          onChange={(e) => update(b.id, { navigateScreen: e.target.value } as Partial<WizardTemplateButton>)}
                          placeholder="ID layar pertama di Flow JSON"
                          disabled={b.flowAction !== "navigate"}
                        />
                      </div>
                    </div>
                  </>
                ) : null}

                {b.kind === "COPY_CODE" ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs">Offer code (contoh untuk peninjauan)</Label>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {b.offerExample.length}/{OFFER_CODE_MAX}
                      </span>
                    </div>
                    <Input
                      value={b.offerExample}
                      onChange={(e) =>
                        update(b.id, { offerExample: e.target.value.slice(0, OFFER_CODE_MAX) } as Partial<WizardTemplateButton>)
                      }
                      placeholder="Enter sample"
                      maxLength={OFFER_CODE_MAX}
                    />
                  </div>
                ) : null}

                {b.kind === "VOICE_CALL" ? (
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    Pastikan panggilan WhatsApp diaktifkan untuk nomor bisnis Anda di WhatsApp Manager (atau Phone Number Settings
                    API), sesuai panduan Meta.
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    <CreateWhatsAppFlowDialog
      open={flowDialogForButtonId !== null}
      onOpenChange={(o) => {
        if (!o) setFlowDialogForButtonId(null);
      }}
      targetButtonId={flowDialogForButtonId ?? ""}
      onSuccess={(buttonId, flowId, entryScreenId) => {
        update(buttonId, {
          flowId,
          navigateScreen: entryScreenId,
          flowAction: "navigate",
          flowEntryMode: "existing",
        } as Partial<WizardTemplateButton>);
        setFlowDialogForButtonId(null);
      }}
    />
    </>
  );
}

export function buildMetaButtonsPayload(buttons: WizardTemplateButton[]): Array<Record<string, unknown>> {
  return buttons.map((b) => {
    if (b.kind === "QUICK_REPLY") {
      return { type: "QUICK_REPLY", text: b.text.trim() };
    }
    if (b.kind === "PHONE_NUMBER") {
      return { type: "PHONE_NUMBER", text: b.text.trim(), phone_number: b.phoneNumber.trim() };
    }
    if (b.kind === "VOICE_CALL") {
      return { type: "VOICE_CALL", text: b.text.trim() };
    }
    if (b.kind === "FLOW") {
      const row: Record<string, unknown> = {
        type: "FLOW",
        text: b.text.trim(),
        flow_id: b.flowId.trim(),
        flow_action: b.flowAction,
      };
      if (b.flowAction === "navigate") {
        row.navigate_screen = b.navigateScreen.trim();
      }
      if (b.flowIcon && b.flowIcon !== "DEFAULT") {
        row.icon = b.flowIcon;
      }
      return row;
    }
    if (b.kind === "COPY_CODE") {
      const code = b.offerExample.trim();
      return { type: "COPY_CODE", example: [code] };
    }
    const url = b.url.trim();
    const row: Record<string, unknown> = { type: "URL", text: b.text.trim(), url };
    if (/\{\{1\}\}/.test(url)) {
      row.example = [(b.urlExample || "").trim()];
    }
    return row;
  });
}

function validateQuickReplyBlock(buttons: WizardTemplateButton[]): string | null {
  const qrIdx = buttons.map((b, i) => (isQuickReply(b) ? i : -1)).filter((i) => i >= 0);
  if (qrIdx.length === 0) return null;
  const first = qrIdx[0];
  const last = qrIdx[qrIdx.length - 1];
  for (let i = first; i <= last; i++) {
    if (!isQuickReply(buttons[i])) {
      return "Quick reply harus satu blok berurutan (tidak boleh ada jenis tombol lain di antara dua quick reply).";
    }
  }
  if (first !== 0 && last !== buttons.length - 1) {
    return "Quick reply harus semua di awal daftar atau semua di akhir (sesuai aturan pengelompokan tombol WhatsApp).";
  }
  return null;
}

export function validateTemplateButtons(buttons: WizardTemplateButton[]): string | null {
  if (buttons.length > MAX_BUTTONS) return `Maksimal ${MAX_BUTTONS} tombol per template.`;

  const qr = validateQuickReplyBlock(buttons);
  if (qr) return qr;

  let urlCount = 0;
  let phoneCount = 0;
  let copyCount = 0;
  let flowCount = 0;
  let voiceCount = 0;
  for (const b of buttons) {
    if (b.kind === "URL") urlCount++;
    else if (b.kind === "PHONE_NUMBER") phoneCount++;
    else if (b.kind === "COPY_CODE") copyCount++;
    else if (b.kind === "FLOW") flowCount++;
    else if (b.kind === "VOICE_CALL") voiceCount++;
  }
  if (urlCount > 2) return "Maksimal 2 tombol Visit website (URL) per template.";
  if (phoneCount > 1) return "Maksimal 1 tombol Call phone number per template.";
  if (copyCount > 1) return "Maksimal 1 tombol Copy offer code per template.";
  if (flowCount > 1) return "Maksimal 1 tombol Complete flow per template.";
  if (voiceCount > 1) return "Maksimal 1 tombol Call on WhatsApp per template.";

  for (const b of buttons) {
    if (b.kind === "COPY_CODE") {
      const c = b.offerExample.trim();
      if (!c) return "Isi contoh offer code untuk tombol Copy offer code.";
      if (c.length > OFFER_CODE_MAX) return `Offer code maksimal ${OFFER_CODE_MAX} karakter.`;
      continue;
    }
    const t = b.text.trim();
    if (!t) return "Setiap tombol (selain Copy offer code) wajib memiliki teks (button text).";
    if (t.length > BTN_TEXT_MAX) return `Teks tombol maksimal ${BTN_TEXT_MAX} karakter.`;

    if (b.kind === "URL") {
      const u = b.url.trim();
      if (u.length > URL_MAX) return `URL tombol maksimal ${URL_MAX} karakter.`;
      if (!/^https?:\/\//i.test(u)) return "URL tombol harus diawali http:// atau https://.";
      if (/\{\{1\}\}/.test(u) && !(b.urlExample || "").trim()) return "Isi contoh URL lengkap untuk tombol yang memakai {{1}} di URL.";
    }
    if (b.kind === "PHONE_NUMBER") {
      const p = b.phoneNumber.trim();
      if (!/^\+[1-9]\d{6,14}$/.test(p)) return "Nomor telepon tombol harus format E.164 (mis. +628123456789).";
    }
    if (b.kind === "FLOW") {
      if (!b.flowId.trim()) return "Flow ID wajib diisi untuk tombol Complete flow.";
      if (b.flowAction === "navigate" && !b.navigateScreen.trim()) {
        return "Navigate screen wajib diisi jika flow action = navigate.";
      }
    }
  }
  return null;
}
