/**
 * Canonical Meta WhatsApp template helpers (campaign worker + livechat follow-up).
 * Supabase deploy bundles one function folder at a time — `../_shared` is not included.
 * After editing this file, run: `node scripts/sync-wa-template-graph.mjs`
 * (copies into whatsapp-campaign-worker/ and send-whatsapp-template-followup/).
 */

export function countPlaceholders(text: string): number {
  return (text.match(/\{\{[^}]+\}\}/g) ?? []).length;
}

const MEDIA_HEADER_FORMATS = new Set(["IMAGE", "VIDEO", "DOCUMENT"]);

function extractHttpsHeaderMediaUrl(c: Record<string, unknown>): string | null {
  const ex = c.example;
  if (!ex || typeof ex !== "object") return null;
  const handles = (ex as { header_handle?: unknown }).header_handle;
  if (!Array.isArray(handles)) return null;
  for (const h of handles) {
    const s = String(h ?? "").trim();
    if (/^https?:\/\//i.test(s)) return s;
  }
  return null;
}

export type BuildGraphTemplateResult =
  | { ok: true; components: Array<Record<string, unknown>> }
  | { ok: false; reason: string };

export function isTemplateBuildFailure(
  result: BuildGraphTemplateResult,
): result is Extract<BuildGraphTemplateResult, { ok: false }> {
  return result.ok === false;
}

export type PostTemplateMessageResult =
  | { ok: true; wa_message_id: string; metaData: Record<string, unknown> }
  | { ok: false; status: number; body: string };

export function isPostTemplateMessageFailure(
  result: PostTemplateMessageResult,
): result is Extract<PostTemplateMessageResult, { ok: false }> {
  return result.ok === false;
}

/**
 * Build Graph API `template.components` from Meta template definition + flat parameter values.
 * Supports TEXT header/body placeholders and static media headers via example.header_handle HTTPS URL.
 */
export function buildGraphTemplateComponents(
  templateComponents: unknown[],
  parameterValues: unknown,
  options?: { allowMediaHeader?: boolean },
): BuildGraphTemplateResult {
  const allowMediaHeader = options?.allowMediaHeader !== false;
  const params = Array.isArray(parameterValues)
    ? parameterValues.map((x) => {
        const s = String(x ?? "").trim();
        return s.length > 0 ? s : "—";
      })
    : [];
  let idx = 0;
  const out: Array<Record<string, unknown>> = [];
  if (!Array.isArray(templateComponents)) return { ok: true, components: [] };

  for (const raw of templateComponents) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const c = raw as Record<string, unknown>;
    const type = String(c.type ?? "").toUpperCase();
    if (type === "HEADER") {
      const fmt = String(c.format ?? "TEXT").toUpperCase();
      if (MEDIA_HEADER_FORMATS.has(fmt)) {
        if (!allowMediaHeader) {
          return { ok: false, reason: "Media header templates are not supported for this send path yet." };
        }
        const text = String(c.text ?? "");
        const n = countPlaceholders(text);
        if (n > 0) {
          const parameters: { type: string; text: string }[] = [];
          for (let i = 0; i < n; i++) {
            const t = String(params[idx + i] ?? "—").slice(0, 1024);
            parameters.push({ type: "text", text: t.length ? t : "—" });
          }
          idx += n;
          out.push({ type: "header", parameters });
          continue;
        }
        const mediaUrl = extractHttpsHeaderMediaUrl(c);
        if (mediaUrl) {
          const fmtLower = fmt.toLowerCase();
          const paramType = fmtLower === "document" ? "document" : fmtLower === "video" ? "video" : "image";
          out.push({
            type: "header",
            parameters: [
              {
                type: paramType,
                [paramType]: { link: mediaUrl },
              },
            ],
          });
        }
        continue;
      }
      const text = String(c.text ?? "");
      const n = countPlaceholders(text);
      if (n === 0) continue;
      const parameters: { type: string; text: string }[] = [];
      for (let i = 0; i < n; i++) {
        const t = String(params[idx + i] ?? "—").slice(0, 1024);
        parameters.push({ type: "text", text: t.length ? t : "—" });
      }
      idx += n;
      out.push({ type: "header", parameters });
    } else if (type === "BODY") {
      const text = String(c.text ?? "");
      const n = countPlaceholders(text);
      if (n === 0) continue;
      const parameters: { type: string; text: string }[] = [];
      for (let i = 0; i < n; i++) {
        const t = String(params[idx + i] ?? "—").slice(0, 1024);
        parameters.push({ type: "text", text: t.length ? t : "—" });
      }
      idx += n;
      out.push({ type: "body", parameters });
    }
  }
  return { ok: true, components: out };
}

export function countTemplateParameterSlots(components: unknown[] | null | undefined): number {
  if (!Array.isArray(components)) return 0;
  let total = 0;
  for (const raw of components) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const c = raw as Record<string, unknown>;
    const type = String(c.type ?? "").toUpperCase();
    if (type === "HEADER") {
      const fmt = String(c.format ?? "").toUpperCase();
      if (MEDIA_HEADER_FORMATS.has(fmt)) {
        total += countPlaceholders(String(c.text ?? ""));
        continue;
      }
      total += countPlaceholders(String(c.text ?? ""));
    } else if (type === "BODY") {
      total += countPlaceholders(String(c.text ?? ""));
    }
  }
  return total;
}

/** Human-readable outbound body for whatsapp_messages.storage */
export function renderTemplateBodyPreview(
  templateName: string,
  templateComponents: unknown[] | null | undefined,
  parameterValues: unknown,
): string {
  const params = Array.isArray(parameterValues) ? parameterValues.map((x) => String(x ?? "").trim()) : [];
  let idx = 0;
  const parts: string[] = [`[Template: ${templateName}]`];
  if (!Array.isArray(templateComponents)) return parts.join("\n");
  for (const raw of templateComponents) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const c = raw as Record<string, unknown>;
    const type = String(c.type ?? "").toUpperCase();
    if (type === "HEADER") {
      const fmt = String(c.format ?? "TEXT").toUpperCase();
      if (MEDIA_HEADER_FORMATS.has(fmt)) {
        parts.push(`[${fmt}]`);
        const n = countPlaceholders(String(c.text ?? ""));
        for (let i = 0; i < n; i++) idx++;
        continue;
      }
      let text = String(c.text ?? "");
      const n = countPlaceholders(text);
      for (let i = 0; i < n; i++) {
        const val = params[idx++] ?? "—";
        text = text.replace(/\{\{[^}]+\}\}/, val);
      }
      if (text.trim()) parts.push(text.trim());
    } else if (type === "BODY") {
      let text = String(c.text ?? "");
      const n = countPlaceholders(text);
      for (let i = 0; i < n; i++) {
        const val = params[idx++] ?? "—";
        text = text.replace(/\{\{[^}]+\}\}/, val);
      }
      if (text.trim()) parts.push(text.trim());
    }
  }
  return parts.join("\n").slice(0, 4090);
}

export const META_API_BASE = "https://graph.facebook.com/v18.0";

export async function postTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  toDigits: string,
  templateName: string,
  templateLanguage: string,
  components: Array<Record<string, unknown>>,
): Promise<PostTemplateMessageResult> {
  const url = `${META_API_BASE}/${encodeURIComponent(phoneNumberId)}/messages`;
  const template: Record<string, unknown> = {
    name: templateName,
    language: { code: templateLanguage },
  };
  if (components.length > 0) template.components = components;

  let lastText = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toDigits,
        type: "template",
        template,
      }),
    });
    lastText = await res.text();
    if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
      await new Promise((r) => setTimeout(r, 650 * (attempt + 1)));
      continue;
    }
    if (!res.ok) return { ok: false, status: res.status, body: lastText.slice(0, 2000) };
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(lastText) as Record<string, unknown>;
    } catch {
      return { ok: false, status: res.status, body: lastText.slice(0, 2000) };
    }
    const messages = json?.messages as unknown[] | undefined;
    const first = messages?.[0] as Record<string, unknown> | undefined;
    const mid = first?.id != null ? String(first.id).trim() : "";
    if (!mid) return { ok: false, status: 500, body: lastText.slice(0, 2000) };
    return { ok: true, wa_message_id: mid, metaData: json };
  }
  return { ok: false, status: 429, body: lastText.slice(0, 2000) };
}
