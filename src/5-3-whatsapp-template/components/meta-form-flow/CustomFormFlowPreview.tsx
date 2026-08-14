import { useRef, useState } from "react";
import { MoreVertical, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import {
  inputPreviewProps,
  type LocalFormField,
} from "@/5-3-whatsapp-template/components/meta-form-flow/customFormFlowEditorTypes";

const DRAWER_TOP_MIN = 6;
const DRAWER_TOP_MAX = 78;
const DRAWER_TOP_DEFAULT = 14;

type CustomFormFlowPreviewProps = {
  screenTitle: string;
  introText: string;
  fields: LocalFormField[];
  invalidJson?: boolean;
};

export function CustomFormFlowPreview({
  screenTitle,
  introText,
  fields,
  invalidJson = false,
}: CustomFormFlowPreviewProps) {
  const { t } = useTranslation();
  const title = screenTitle.trim() || t("omnichannel.settings.flowBuilder.formFlowsEditor.previewDefaultTitle");
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

  if (invalidJson) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          {t("omnichannel.settings.flowBuilder.formFlowsEditor.previewInvalidJson")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-center">
        <p className="text-xs font-semibold tracking-wide text-slate-700">
          {t("omnichannel.settings.flowBuilder.formFlowsEditor.previewTitle")}
        </p>
      </div>
      <div
        className={cn(
          "relative mx-auto w-[min(100%,300px)] shrink-0",
          "rounded-[2.85rem] border border-black/50 bg-gradient-to-b from-[#2c3137] via-[#1e2429] to-[#0f1215]",
          "p-[11px] shadow-[0_28px_56px_-12px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]",
        )}
      >
        <div
          ref={shellRef}
          className="relative aspect-[9/19] min-h-[420px] w-full overflow-hidden rounded-[2.2rem] bg-black ring-1 ring-black/80"
        >
          <div
            className="absolute inset-0 bg-[#e5ddd5]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,0,0,0.045) 1px, transparent 0)`,
              backgroundSize: "14px 14px",
            }}
          />
          <div className="absolute inset-0 z-10 bg-black/40 backdrop-blur-[0.5px]" aria-hidden />
          <div
            className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[1.35rem] bg-white shadow-[0_-12px_40px_rgba(0,0,0,0.35)]"
            style={{ top: `${drawerTopPct}%` }}
          >
            <div
              className="flex shrink-0 cursor-grab touch-none select-none flex-col items-center border-b border-slate-100/90 bg-white py-3 active:cursor-grabbing"
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
            >
              <div className="h-1 w-11 shrink-0 rounded-full bg-slate-300/95" />
            </div>
            <header className="flex shrink-0 items-center gap-1.5 border-b border-slate-100 px-2.5 py-2.5">
              <button type="button" className="rounded-full p-1.5 text-slate-500" aria-hidden tabIndex={-1}>
                <X className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
              <h3 className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold text-slate-900">{title}</h3>
              <button type="button" className="rounded-full p-1.5 text-slate-500" aria-hidden tabIndex={-1}>
                <MoreVertical className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
            </header>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 py-3">
              <h4 className="text-lg font-bold text-slate-900">{title}</h4>
              {introText.trim() ? (
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-slate-700">{introText}</p>
              ) : null}
              <div className="space-y-3.5 pb-1">
                {fields.map((f) => {
                  const label = f.label.trim() || "Label";
                  const { type, placeholder } = inputPreviewProps(f.inputType);
                  return (
                    <div key={f.localKey} className="space-y-1.5">
                      <label className="block text-[14px] font-medium text-slate-900">
                        {label}
                        {f.required ? <span className="text-[#ea0038]"> *</span> : null}
                      </label>
                      {f.instructions?.trim() ? (
                        <p className="text-xs text-slate-500">{f.instructions.trim()}</p>
                      ) : null}
                      <input
                        readOnly
                        type={type}
                        placeholder={placeholder}
                        className="h-11 w-full rounded-md border border-slate-200 bg-[#f8f9fa] px-3 text-[15px] text-slate-800"
                        aria-hidden
                        tabIndex={-1}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="shrink-0 border-t border-slate-100 bg-white px-3.5 py-2.5">
              <div className="h-11 w-full rounded-md bg-[#00a884] text-center text-[15px] font-medium leading-[2.75rem] text-white">
                Continue
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
