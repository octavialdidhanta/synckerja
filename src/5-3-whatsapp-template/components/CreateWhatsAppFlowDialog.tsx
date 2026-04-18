import { useEffect, useMemo, useRef, useState } from "react";
import { MoreVertical, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { cn } from "@/shared/lib/utils";
import { useCreateWhatsAppFlow } from "../hooks/useCreateWhatsAppFlow";
import {
  buildCustomFormFlowJson,
  CUSTOM_FORM_ENTRY_SCREEN_ID,
  toFlowApiName,
  type CustomFormField,
  type CustomFormFieldInputType,
} from "../utils/buildCustomFormFlowJson";

type FlowWizardType = "custom" | "survey" | "event" | "signup";

type LocalField = CustomFormField & { localKey: string };

function newLocalKey(): string {
  return `lf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function slugFieldName(label: string, index: number): string {
  const base = toFlowApiName(label).replace(/^_|_$/g, "") || `field_${index + 1}`;
  return base.length > 64 ? base.slice(0, 64) : base;
}

const META_WHATSAPP_FLOWS_MANAGER =
  "https://business.facebook.com/latest/whatsapp_manager/flows?nav_ref=whatsapp_manager";

function inputPreviewProps(inputType: CustomFormFieldInputType): { type: string; placeholder: string } {
  switch (inputType) {
    case "email":
      return { type: "email", placeholder: "email@contoh.com" };
    case "number":
      return { type: "text", placeholder: "0" };
    case "phone":
      return { type: "tel", placeholder: "+62…" };
    case "text":
    default:
      return { type: "text", placeholder: "…" };
  }
}

const DRAWER_TOP_MIN = 6;
const DRAWER_TOP_MAX = 78;
const DRAWER_TOP_DEFAULT = 14;

function CustomFormFlowPreview({
  screenTitle,
  introText,
  fields,
}: {
  screenTitle: string;
  introText: string;
  fields: LocalField[];
}) {
  const title = screenTitle.trim() || "Judul layar";
  const shellRef = useRef<HTMLDivElement>(null);
  const [drawerTopPct, setDrawerTopPct] = useState(DRAWER_TOP_DEFAULT);
  const dragRef = useRef<{ pointerId: number; startY: number; startTop: number } | null>(null);

  const onDragStart = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, startY: e.clientY, startTop: drawerTopPct };
  };

  const onDragMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const shell = shellRef.current;
    if (!shell) return;
    const h = shell.getBoundingClientRect().height;
    if (h < 1) return;
    const deltaPct = ((e.clientY - d.startY) / h) * 100;
    const next = Math.min(DRAWER_TOP_MAX, Math.max(DRAWER_TOP_MIN, d.startTop + deltaPct));
    setDrawerTopPct(next);
  };

  const onDragEnd = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-center">
        <p className="text-xs font-semibold tracking-wide text-slate-700">Preview</p>
        <p className="text-[10px] text-muted-foreground">
          Seret <span className="font-medium">handle</span> atau area grip di atas drawer untuk naik/turun
        </p>
      </div>

      {/* Device chassis — bezel + rounded screen */}
      <div
        className={cn(
          "relative mx-auto w-[min(100%,300px)] shrink-0",
          "rounded-[2.85rem] border border-black/50 bg-gradient-to-b from-[#2c3137] via-[#1e2429] to-[#0f1215]",
          "p-[11px] shadow-[0_28px_56px_-12px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]",
        )}
      >
        {/* Side button hint */}
        <div
          className="pointer-events-none absolute -left-[2px] top-[22%] z-10 h-10 w-[3px] rounded-l-sm bg-black/40"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-[2px] top-[28%] z-10 h-14 w-[3px] rounded-r-sm bg-black/35"
          aria-hidden
        />

        <div
          ref={shellRef}
          className="relative aspect-[9/19] min-h-[420px] w-full overflow-hidden rounded-[2.2rem] bg-black ring-1 ring-black/80"
        >
          {/* Chat wallpaper (behind drawer) */}
          <div
            className="absolute inset-0 bg-[#e5ddd5]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,0,0,0.045) 1px, transparent 0)`,
              backgroundSize: "14px 14px",
            }}
          />
          {/* Fake chat row peek */}
          <div className="absolute left-3 right-3 top-12 z-0 space-y-2 opacity-90">
            <div className="max-w-[78%] rounded-lg rounded-tl-sm bg-white px-2.5 py-1.5 text-[11px] text-slate-800 shadow-sm">
              Halo! Ada yang bisa kami bantu?
            </div>
            <div className="ml-auto max-w-[72%] rounded-lg rounded-tr-sm bg-[#d9fdd3] px-2.5 py-1.5 text-[11px] text-slate-900 shadow-sm">
              Saya ingin isi formulir
            </div>
          </div>

          {/* Dim overlay — chat stays visible like in-app */}
          <div className="absolute inset-0 z-10 bg-black/40 backdrop-blur-[0.5px]" aria-hidden />

          {/* Flow drawer — sheet from bottom (above dim); top% adjusted by drag */}
          <div
            className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[1.35rem] bg-white shadow-[0_-12px_40px_rgba(0,0,0,0.35)]"
            style={{ top: `${drawerTopPct}%` }}
          >
            {/* Drawer handle — interactive drag (expanded hit area) */}
            <div
              className="flex shrink-0 cursor-grab touch-none select-none flex-col items-center border-b border-slate-100/90 bg-white py-3 active:cursor-grabbing"
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
              role="slider"
              aria-valuenow={Math.round(100 - drawerTopPct)}
              aria-valuemin={100 - DRAWER_TOP_MAX}
              aria-valuemax={100 - DRAWER_TOP_MIN}
              aria-label="Seret untuk mengatur tinggi drawer pratinjau"
            >
              <div className="h-1 w-11 shrink-0 rounded-full bg-slate-300/95" />
              <span className="mt-1 text-[9px] font-medium uppercase tracking-wide text-slate-400">Tarik</span>
            </div>

            <header className="flex shrink-0 items-center gap-1.5 border-b border-slate-100 px-2.5 py-2.5">
              <button
                type="button"
                className="rounded-full p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
                aria-hidden
                tabIndex={-1}
              >
                <X className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
              <h3 className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold leading-tight text-slate-900">
                {title}
              </h3>
              <button
                type="button"
                className="rounded-full p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
                aria-hidden
                tabIndex={-1}
              >
                <MoreVertical className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3.5 py-3">
              <h4 className="text-lg font-bold leading-snug tracking-tight text-slate-900">{title}</h4>
              {introText.trim() ? (
                <p className="text-[14px] leading-relaxed text-slate-700 whitespace-pre-wrap">{introText}</p>
              ) : null}
              <div className="space-y-3.5 pb-1">
                {fields.map((f) => {
                  const label = f.label.trim() || "Label";
                  const { type, placeholder } = inputPreviewProps(f.inputType);
                  return (
                    <div key={f.localKey} className="space-y-1.5">
                      <label className="block text-[14px] font-medium leading-snug text-slate-900">
                        {label}
                        {f.required ? <span className="text-[#ea0038]"> *</span> : null}
                      </label>
                      {f.instructions?.trim() ? (
                        <p className="text-xs leading-relaxed text-slate-500">{f.instructions.trim()}</p>
                      ) : null}
                      <input
                        readOnly
                        type={type}
                        placeholder={placeholder}
                        className="h-11 w-full rounded-md border border-slate-200 bg-[#f8f9fa] px-3 text-[15px] text-slate-800 outline-none ring-0 placeholder:text-slate-400"
                        aria-hidden
                        tabIndex={-1}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-100 bg-white px-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
              <div className="h-11 w-full rounded-md bg-[#00a884] text-center text-[15px] font-medium leading-[2.75rem] text-white shadow-[0_1px_0_rgba(0,0,0,0.08)]">
                Continue
              </div>
              <p className="mt-2 text-center text-[11px] leading-snug text-slate-400">Managed by the business.</p>
            </div>
          </div>

          {/* Status / sensor strip — above dim + drawer in the top band */}
          <div className="pointer-events-none absolute left-0 right-0 top-0 z-30 flex h-8 items-end justify-center pb-1">
            <div className="flex w-[32%] min-w-[88px] items-center justify-center rounded-full bg-black/85 px-3 py-[5px]">
              <div className="h-1.5 w-8 rounded-full bg-slate-700/90" />
            </div>
          </div>
        </div>
      </div>

      <p className="max-w-[280px] text-center text-[10px] leading-relaxed text-muted-foreground">
        Isi formulir di pratinjau tetap statis; hanya drawer yang bisa digeser naik/turun seperti bottom sheet.
      </p>
    </div>
  );
}

export function CreateWhatsAppFlowDialog({
  open,
  onOpenChange,
  targetButtonId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** FLOW button row id from the template wizard (used when applying flowId + navigate_screen). */
  targetButtonId: string;
  onSuccess: (buttonId: string, flowId: string, entryScreenId: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [flowType, setFlowType] = useState<FlowWizardType>("custom");
  const [screenTitle, setScreenTitle] = useState("Form Digital");
  const [introText, setIntroText] = useState("");
  const [apiName, setApiName] = useState("custom_form");
  const [apiNameTouched, setApiNameTouched] = useState(false);
  const [fields, setFields] = useState<LocalField[]>(() => [
    {
      localKey: newLocalKey(),
      name: "nama",
      label: "Nama",
      instructions: "",
      inputType: "text",
      required: true,
    },
  ]);

  const createMutation = useCreateWhatsAppFlow();

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setFlowType("custom");
    setScreenTitle("Form Digital");
    setIntroText("");
    setApiName("custom_form");
    setApiNameTouched(false);
    setFields([
      {
        localKey: newLocalKey(),
        name: "nama",
        label: "Nama",
        instructions: "",
        inputType: "text",
        required: true,
      },
    ]);
  }, [open]);

  useEffect(() => {
    if (apiNameTouched || !open) return;
    setApiName(toFlowApiName(screenTitle));
  }, [screenTitle, apiNameTouched, open]);

  const canSubmit = useMemo(() => {
    if (flowType !== "custom") return false;
    const t = screenTitle.trim();
    if (!t) return false;
    if (!/^[a-z0-9_]{1,128}$/.test(apiName.trim())) return false;
    if (fields.length === 0) return false;
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      if (!f.label.trim()) return false;
      if (!/^[a-z][a-z0-9_]{0,63}$/.test(f.name.trim())) return false;
    }
    const names = new Set(fields.map((f) => f.name.trim()));
    if (names.size !== fields.length) return false;
    return true;
  }, [flowType, screenTitle, apiName, fields]);

  const addField = () => {
    const idx = fields.length;
    setFields((prev) => [
      ...prev,
      {
        localKey: newLocalKey(),
        name: `field_${idx + 1}`,
        label: "",
        instructions: "",
        inputType: "text",
        required: false,
      },
    ]);
  };

  const removeField = (localKey: string) => {
    setFields((prev) => (prev.length <= 1 ? prev : prev.filter((f) => f.localKey !== localKey)));
  };

  const updateField = (localKey: string, patch: Partial<CustomFormField>) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.localKey !== localKey) return f;
        return { ...f, ...patch };
      }),
    );
  };

  const handleSubmit = async () => {
    if (!targetButtonId.trim()) {
      toast.error('Tombol flow tidak valid. Tutup dialog dan buka lagi dari "Create new".');
      return;
    }
    if (!canSubmit) {
      toast.error("Lengkapi judul layar, nama flow internal, dan setiap field.");
      return;
    }
    const model = {
      screenTitle: screenTitle.trim(),
      introText: introText.trim() || undefined,
      fields: fields.map(({ localKey: _lk, ...rest }) => rest),
    };
    const { flowJson } = buildCustomFormFlowJson(model);
    try {
      const result = await createMutation.mutateAsync({
        name: apiName.trim(),
        categories: ["OTHER"],
        flow_json: flowJson,
        publish: true,
      });
      const flowId = String(result.id).trim();
      toast.success("Flow berhasil dibuat dan dipublikasikan.");
      onSuccess(targetButtonId, flowId, CUSTOM_FORM_ENTRY_SCREEN_ID);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat flow");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,800px)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <div className="border-b border-slate-100 px-6 py-4">
          <DialogHeader className="space-y-1 p-0 text-left">
            <DialogTitle>{step === 0 ? "Select a flow type" : "Custom form"}</DialogTitle>
          </DialogHeader>
        </div>

        {step === 0 ? (
          <div className="space-y-3 overflow-y-auto px-6 py-4">
            <p className="text-sm text-muted-foreground">
              Pilih jenis flow. Saat ini CRM mendukung pembuatan <span className="font-medium">Custom form</span> lewat API;
              tipe lain dapat dibuat di WhatsApp Manager.
            </p>
            <RadioGroup value={flowType} onValueChange={(v) => setFlowType(v as FlowWizardType)} className="space-y-2">
              {(
                [
                  {
                    value: "survey" as const,
                    title: "Send a survey",
                    desc: "Ask questions and collect preferences to better understand your users.",
                    disabled: true,
                  },
                  {
                    value: "event" as const,
                    title: "Register for an event",
                    desc: "Collect information from your users to register them for an event or promotion.",
                    disabled: true,
                  },
                  {
                    value: "signup" as const,
                    title: "Complete sign-up",
                    desc: "Quickly capture contact information.",
                    disabled: true,
                  },
                  {
                    value: "custom" as const,
                    title: "Custom form",
                    desc: "Create a form tailored to your specific needs.",
                    disabled: false,
                  },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm",
                    flowType === opt.value ? "border-brand-blue/40 bg-brand-blue/5" : "border-slate-200",
                    opt.disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <RadioGroupItem value={opt.value} disabled={opt.disabled} className="mt-0.5" />
                  <div>
                    <div className="font-medium">{opt.title}</div>
                    <div className="text-xs text-muted-foreground">{opt.desc}</div>
                    {opt.disabled ? <div className="mt-1 text-[10px] text-muted-foreground">Segera / gunakan WhatsApp Manager</div> : null}
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-h-0 space-y-4 overflow-y-auto border-slate-100 px-6 py-4 lg:border-r">
              <div className="space-y-1">
                <Label htmlFor="flow-screen-title">Screen title</Label>
                <Input
                  id="flow-screen-title"
                  value={screenTitle}
                  onChange={(e) => setScreenTitle(e.target.value.slice(0, 60))}
                  maxLength={60}
                />
                <p className="text-right text-xs tabular-nums text-muted-foreground">{screenTitle.length}/60</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="flow-api-name">Flow internal name (snake_case)</Label>
                <Input
                  id="flow-api-name"
                  value={apiName}
                  onChange={(e) => {
                    setApiNameTouched(true);
                    setApiName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 128));
                  }}
                  placeholder="custom_form"
                  className="font-mono text-sm"
                />
                <p className="text-[10px] text-muted-foreground">Digunakan di Meta; huruf kecil, angka, dan underscore saja.</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="flow-intro">Intro text · Optional</Label>
                <textarea
                  id="flow-intro"
                  value={introText}
                  onChange={(e) => setIntroText(e.target.value.slice(0, 4096))}
                  className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Teks penjelasan singkat di bawah judul"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Fields</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addField}>
                    + Add field
                  </Button>
                </div>
                <div className="space-y-3">
                  {fields.map((f, index) => (
                    <div key={f.localKey} className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-600">Field {index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive"
                          disabled={fields.length <= 1}
                          onClick={() => removeField(f.localKey)}
                        >
                          Remove
                        </Button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Label</Label>
                          <Input
                            value={f.label}
                            onChange={(e) => {
                              const label = e.target.value.slice(0, 20);
                              updateField(f.localKey, { label });
                            }}
                            maxLength={20}
                            placeholder="Label"
                          />
                          <p className="text-[10px] text-right tabular-nums text-muted-foreground">{f.label.length}/20</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Field name (JSON)</Label>
                          <Input
                            value={f.name}
                            onChange={(e) =>
                              updateField(f.localKey, {
                                name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 64),
                              })
                            }
                            className="font-mono text-xs"
                            placeholder="nama_lengkap"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            <button
                              type="button"
                              className="text-[#1877F2] hover:underline"
                              onClick={() => updateField(f.localKey, { name: slugFieldName(f.label, index) })}
                            >
                              Generate from label
                            </button>
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Instructions · Optional</Label>
                        <Input
                          value={f.instructions ?? ""}
                          onChange={(e) => updateField(f.localKey, { instructions: e.target.value.slice(0, 80) })}
                          maxLength={80}
                          placeholder="Helper text"
                        />
                        <p className="text-[10px] text-right tabular-nums text-muted-foreground">
                          {(f.instructions ?? "").length}/80
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs">Input type</Label>
                          <Select
                            value={f.inputType}
                            onValueChange={(v) =>
                              updateField(f.localKey, { inputType: v as CustomFormFieldInputType })
                            }
                          >
                            <SelectTrigger className="h-8 w-[10rem] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="phone">Phone</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2 pt-5">
                          <Switch
                            id={`req-${f.localKey}`}
                            checked={f.required}
                            onCheckedChange={(c) => updateField(f.localKey, { required: Boolean(c) })}
                          />
                          <Label htmlFor={`req-${f.localKey}`} className="text-xs">
                            Required
                          </Label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Setelah disimpan, Flow ID dan layar navigasi otomatis diisi pada tombol template (mode{" "}
                <span className="font-medium">navigate</span>, screen{" "}
                <code className="rounded bg-white px-0.5">{CUSTOM_FORM_ENTRY_SCREEN_ID}</code>).
              </p>
              <p className="text-[10px]">
                <a
                  href={META_WHATSAPP_FLOWS_MANAGER}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#1877F2] hover:underline"
                >
                  Buka WhatsApp Manager
                </a>{" "}
                untuk flow lanjutan di luar Custom form.
              </p>
            </div>
            <div className="shrink-0 overflow-y-auto border-t border-slate-100 bg-slate-50/90 px-4 py-6 lg:border-l lg:border-t-0">
              <CustomFormFlowPreview screenTitle={screenTitle} introText={introText} fields={fields} />
            </div>
          </div>
        )}

        <DialogFooter className="border-t border-slate-100 px-6 py-4 gap-2 sm:justify-between">
          {step === 1 ? (
            <Button type="button" variant="outline" onClick={() => setStep(0)}>
              Back
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          <div className="flex gap-2">
            {step === 0 ? (
              <Button
                type="button"
                className="bg-[#1877F2] hover:bg-[#166FE5]"
                disabled={flowType !== "custom"}
                onClick={() => setStep(1)}
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                className="bg-[#1877F2] hover:bg-[#166FE5]"
                disabled={!canSubmit || createMutation.isPending}
                onClick={() => void handleSubmit()}
              >
                {createMutation.isPending ? "Menyimpan…" : "Save & publish"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
