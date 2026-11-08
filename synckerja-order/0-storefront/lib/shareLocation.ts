import { googleMapsPinUrl } from "../../shared/lib/googleMapsLink";

export type LocationSharePayload = {
  title: string;
  text: string;
  url: string;
};

export function locationSharePayload(args: {
  name: string;
  address?: string | null;
  mapsUrl?: string | null;
  pageUrl: string;
}): LocationSharePayload {
  const name = args.name.trim();
  const address = args.address?.trim() ?? "";
  const mapsUrl = args.mapsUrl?.trim() ?? "";
  const pageUrl = args.pageUrl.trim();
  const url = (mapsUrl ? googleMapsPinUrl(mapsUrl) : null) || mapsUrl || pageUrl;
  const text = [name, address].filter(Boolean).join("\n");
  return {
    title: name || url,
    text: text || url,
    url,
  };
}

type ShareDeps = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  copy: (value: string) => Promise<boolean>;
};

/** Opens the device share sheet. A cancelled sheet stays quiet. Otherwise the link is copied. */
export async function shareOrCopy(
  payload: LocationSharePayload,
  deps: ShareDeps,
): Promise<"shared" | "copied" | "aborted" | "failed"> {
  if (!payload.url) return "failed";
  if (typeof deps.share === "function") {
    const attempts: ShareData[] = [
      { title: payload.title, text: payload.text, url: payload.url },
      { title: payload.title, url: payload.url },
      { url: payload.url },
    ];
    for (const data of attempts) {
      if (typeof deps.canShare === "function" && !deps.canShare(data)) continue;
      try {
        await deps.share(data);
        return "shared";
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return "aborted";
      }
    }
  }
  const copied = await deps.copy(payload.url);
  return copied ? "copied" : "failed";
}

function copyWithSelection(value: string): boolean {
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "0";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    area.setSelectionRange(0, area.value.length);
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export async function copyShareText(value: string): Promise<boolean> {
  if (!value) return false;
  // Run while the click is still a user gesture. Awaiting clipboard first drops that gesture.
  if (copyWithSelection(value)) return true;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
