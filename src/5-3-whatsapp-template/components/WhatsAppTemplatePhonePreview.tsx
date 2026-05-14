import type { ReactNode } from "react";
import { Fragment } from "react";
import { format } from "date-fns";
import { cn } from "@/shared/lib/utils";

/**
 * Replace placeholders with Meta `example.body_text` / `example.header_text` values in **document order**
 * (left → right). Supports both `{{1}}` and named `{{LEAD_USER_FIRST_NAME}}` as returned by Graph.
 */
export function applyMetaVariableSamples(text: string, samples: string[] | undefined | null): string {
  if (!text?.length || !samples?.length) return text;
  let slot = 0;
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (full) => {
    const i = slot++;
    if (i < samples.length) {
      const v = String(samples[i] ?? "").trim();
      if (v !== "") return v;
    }
    return full;
  });
}

/** Private-use sentinels — must not appear in Meta template text. */
const V0 = "\uFFF9";
const V1 = "\uFFF8";

function maskTemplateVariables(s: string): string {
  return s.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, inner: string) => `${V0}${String(inner).trim()}${V1}`);
}

function variableChip(innerRaw: string, reactKey: string) {
  const raw = innerRaw.trim();
  const short = /^\d+$/.test(raw) || raw.length <= 20 ? raw : `${raw.slice(0, 18)}…`;
  return (
    <span
      key={reactKey}
      title={short !== raw ? raw : undefined}
      className="mx-px inline-flex min-h-[1.25rem] min-w-[1.25rem] max-w-[10rem] items-center justify-center rounded-[3px] bg-[#d3e7fd] px-1 py-px align-baseline text-[12px] font-semibold leading-none text-[#0066cc] ring-1 ring-[#b6d9f7]"
    >
      <span className="truncate">{short}</span>
    </span>
  );
}

function parseVariablesInPlain(plain: string, keyPrefix: string): ReactNode[] {
  const re = new RegExp(`${V0}([^${V1}]+)${V1}`, "g");
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(plain)) !== null) {
    const before = plain.slice(last, m.index);
    if (before) out.push(<Fragment key={`${keyPrefix}-t${i++}`}>{before}</Fragment>);
    out.push(variableChip(m[1], `${keyPrefix}-v${i++}`));
    last = m.index + m[0].length;
  }
  const tail = plain.slice(last);
  if (tail) out.push(<Fragment key={`${keyPrefix}-t${i}`}>{tail}</Fragment>);
  return out;
}

function parseBoldThenVariables(segment: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const boldRe = /\*([^*\n]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = boldRe.exec(segment)) !== null) {
    const before = segment.slice(last, m.index);
    if (before) out.push(...parseVariablesInPlain(before, `${keyPrefix}a${i}`));
    out.push(
      <strong key={`${keyPrefix}-s${i}`} className="font-semibold text-slate-900">
        {parseVariablesInPlain(m[1], `${keyPrefix}i${i}`)}
      </strong>,
    );
    last = m.index + m[0].length;
    i++;
  }
  const tail = segment.slice(last);
  if (tail) out.push(...parseVariablesInPlain(tail, `${keyPrefix}tail`));
  return out;
}

export function formatWhatsAppTemplateRichText(body: string): ReactNode[] {
  const masked = maskTemplateVariables(body);
  return parseBoldThenVariables(masked, "w");
}

function mediaHeaderLabel(format: string): string {
  const u = format.toUpperCase();
  if (u === "IMAGE") return "Gambar";
  if (u === "VIDEO") return "Video";
  if (u === "DOCUMENT") return "Dokumen";
  return u;
}

const previewFont =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export function WhatsAppTemplatePhonePreview({
  headerText,
  mediaFormat,
  headerMediaPreviewUrl,
  bodyText,
  bodyVariableExamples,
  headerVariableExamples,
  footerText,
  buttonLabels,
  previewAt,
  metaSyncLoading,
  className,
}: {
  headerText?: string | null;
  mediaFormat?: string | null;
  /** HTTPS URL from Meta HEADER `example.header_handle` when provided. */
  headerMediaPreviewUrl?: string | null;
  bodyText: string;
  bodyVariableExamples?: string[] | null;
  headerVariableExamples?: string[] | null;
  footerText?: string | null;
  buttonLabels?: string[];
  /** Timestamp in bubble — from Meta `last_updated_time` / `created_time` when available. */
  previewAt?: Date | null;
  metaSyncLoading?: boolean;
  className?: string;
}) {
  const labels = buttonLabels ?? [];
  const bodySamples = bodyVariableExamples ?? [];
  const headerSamples = headerVariableExamples ?? [];
  const fmt = (mediaFormat ?? "").toUpperCase();
  const hasMedia = Boolean(mediaFormat && ["IMAGE", "VIDEO", "DOCUMENT"].includes(fmt));
  const mediaUrl = (headerMediaPreviewUrl ?? "").trim();
  const showHttpsMedia = Boolean(mediaUrl && /^https?:\/\//i.test(mediaUrl));

  const headerRendered = headerText?.trim()
    ? applyMetaVariableSamples(headerText.trim(), headerSamples.length ? headerSamples : null)
    : "";
  const bodyRendered = applyMetaVariableSamples(bodyText.trim(), bodySamples.length ? bodySamples : null);
  const footerRendered = footerText?.trim()
    ? applyMetaVariableSamples(footerText.trim(), bodySamples.length ? bodySamples : null)
    : "";

  const timeLabel =
    previewAt != null && !Number.isNaN(previewAt.getTime()) ? format(previewAt, "HH:mm") : null;

  return (
    <div className={cn("flex flex-col items-stretch", className)}>
      <div className="mb-2 flex flex-col items-center gap-0.5">
        <p className="text-center text-xs font-semibold tracking-wide text-slate-600">Pratinjau pesan</p>
        {metaSyncLoading ? (
          <p className="text-center text-[10px] text-muted-foreground" aria-live="polite">
            Menyinkronkan komponen dari Meta…
          </p>
        ) : null}
      </div>
      <div
        className={cn(
          "mx-auto w-full max-w-[280px] shrink-0",
          "rounded-[1.75rem] border border-black/40 bg-gradient-to-b from-[#2c3137] via-[#1e2429] to-[#121518]",
          "p-2.5 shadow-[0_20px_44px_-12px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)]",
        )}
      >
        <div className="rounded-[1.25rem] bg-[#e5ddd5] p-2.5">
          <div
            className="rounded-lg bg-white px-3 py-2.5 shadow-sm ring-1 ring-black/[0.06]"
            style={{ fontFamily: previewFont }}
          >
            {hasMedia ? (
              <div className="mb-2 overflow-hidden rounded-md bg-slate-100">
                {showHttpsMedia && fmt === "IMAGE" ? (
                  <img
                    src={mediaUrl}
                    alt=""
                    className="max-h-[200px] w-full object-cover object-center"
                    referrerPolicy="no-referrer"
                  />
                ) : showHttpsMedia && fmt === "VIDEO" ? (
                  <video src={mediaUrl} className="max-h-[200px] w-full object-cover" controls playsInline muted />
                ) : showHttpsMedia && fmt === "DOCUMENT" ? (
                  <a
                    href={mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[72px] items-center justify-center break-all px-2 py-3 text-center text-[12px] font-medium text-[#027EB5] underline"
                  >
                    Dokumen (Meta)
                  </a>
                ) : (
                  <div className="flex aspect-[16/10] max-h-[120px] flex-col items-center justify-center gap-1 px-2 text-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {mediaHeaderLabel(fmt)}
                    </span>
                    <span className="text-[10px] leading-snug text-slate-400">
                      File contoh disimpan di Meta (URL publik tidak dikembalikan oleh API untuk handle ini).
                    </span>
                  </div>
                )}
              </div>
            ) : headerRendered ? (
              <div className="mb-2 border-b border-slate-100/90 pb-2 text-[15px] font-semibold leading-[1.45] text-slate-900">
                <span className="whitespace-pre-wrap break-words">{formatWhatsAppTemplateRichText(headerRendered)}</span>
              </div>
            ) : null}

            {bodyRendered ? (
              <p className="text-[15px] leading-[1.45] text-slate-900">
                <span className="whitespace-pre-wrap break-words">{formatWhatsAppTemplateRichText(bodyRendered)}</span>
              </p>
            ) : (
              <p className="text-sm text-slate-400">Tidak ada isi body</p>
            )}

            {footerRendered ? (
              <p className="mt-2 border-t border-slate-100/90 pt-2 text-[13px] leading-[1.45] text-slate-500">
                <span className="whitespace-pre-wrap break-words">
                  {/\{\{[^}]+\}\}/.test(footerRendered)
                    ? formatWhatsAppTemplateRichText(footerRendered)
                    : footerRendered}
                </span>
              </p>
            ) : null}

            {labels.length > 0 ? (
              <div className="mt-2 space-y-1.5 border-t border-slate-100/90 pt-2">
                {labels.map((label, i) => (
                  <div
                    key={`${i}-${label}`}
                    className="rounded-md border border-slate-200/90 bg-slate-50/90 px-2 py-1.5 text-center text-[13px] font-medium leading-tight text-[#027EB5]"
                  >
                    {label}
                  </div>
                ))}
              </div>
            ) : null}

            {timeLabel ? (
              <p className="mt-2 text-right text-[11px] tabular-nums text-slate-400">{timeLabel}</p>
            ) : (
              <p className="mt-2 text-right text-[11px] tabular-nums text-slate-300">—</p>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] leading-snug text-muted-foreground">
        Konten komponen dari <span className="font-medium">Meta Graph API</span>
        {bodySamples.length > 0 || headerSamples.length > 0
          ? " — variabel memakai contoh yang Meta simpan pada field example bila tersedia."
          : " — slot variabel ({{1}} atau nama seperti {{LEAD_USER_FIRST_NAME}}) ditampilkan hingga Meta mengirim example pada respons template."}
      </p>
    </div>
  );
}
