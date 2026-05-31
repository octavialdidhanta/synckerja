import { supabase } from "@/shared/lib/supabaseClient";

export const GOOGLE_PICKER_HOST_OPEN_EVENT = "synckerja-google-picker-host-open";
export const GOOGLE_PICKER_HOST_CLOSE_EVENT = "synckerja-google-picker-host-close";

const GOOGLE_PICKER_BODY_CLASS = "google-picker-host-open";

export function isGooglePickerHostSessionActive(): boolean {
  return typeof document !== "undefined" && document.body.classList.contains(GOOGLE_PICKER_BODY_CLASS);
}

export type GoogleDrivePickerSelection = {
  id: string;
  name: string;
  mimeType: string;
};

export type OpenGoogleDrivePickerOptions = {
  /** Pre-highlight resource from pasted URL (file or folder id). */
  preselectIds?: string[];
  /** When true, user can pick a folder (carousel grant). */
  selectFolder?: boolean;
};

type PickerDoc = {
  id: string;
  name: string;
  mimeType: string;
};

declare global {
  interface Window {
    gapi?: {
      load: (name: string, callback: () => void) => void;
    };
    google?: {
      picker: {
        Action: { PICKED: string; CANCEL: string };
        DocsView: new (viewId?: string) => {
          setIncludeFolders: (v: boolean) => unknown;
          setSelectFolderEnabled: (v: boolean) => unknown;
          setMimeTypes: (v: string) => unknown;
          setParent: (folderId: string) => unknown;
        };
        ViewId: { DOCS: string; FOLDERS: string };
        PickerBuilder: new () => {
          addView: (view: unknown) => unknown;
          setOAuthToken: (token: string) => unknown;
          setDeveloperKey: (key: string) => unknown;
          setAppId: (appId: string) => unknown;
          setOrigin: (origin: string) => unknown;
          setRelayUrl: (host: string) => unknown;
          setCallback: (cb: (data: { action: string; docs?: PickerDoc[] }) => void) => unknown;
          setTitle: (title: string) => unknown;
          enableFeature: (feature: string) => unknown;
          setFileIds: (ids: string[]) => unknown;
          build: () => { setVisible: (v: boolean) => void };
        };
        Feature: { MULTISELECT_ENABLED: string; SUPPORT_DRIVES: string };
        Response: { ACTION: string; DOCUMENTS: string };
      };
    };
  }
}

let gapiLoadPromise: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function waitForPickerNamespace(timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (window.google?.picker) {
        resolve();
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error("Google Picker is not available"));
        return;
      }
      window.setTimeout(tick, 50);
    };
    tick();
  });
}

function loadGapiPicker(): Promise<void> {
  if (gapiLoadPromise) return gapiLoadPromise;

  gapiLoadPromise = (async () => {
    await loadScript("https://apis.google.com/js/api.js");
    if (!window.gapi?.load) {
      throw new Error("Google API failed to load");
    }

    await new Promise<void>((resolve, reject) => {
      try {
        window.gapi!.load("picker", () => {
          if (window.google?.picker) {
            resolve();
            return;
          }
          void waitForPickerNamespace().then(resolve).catch(reject);
        });
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Failed to load Google Picker module"));
      }
    });

    if (!window.google?.picker) {
      await loadScript("https://apis.google.com/js/picker.js");
    }
    await waitForPickerNamespace();
  })().catch((e) => {
    gapiLoadPromise = null;
    throw e;
  });

  return gapiLoadPromise;
}

async function fetchPickerAccessToken(): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{
    accessToken?: string;
    error?: string;
  }>("google-oauth-manage", { body: { action: "picker_access_token" } });

  const bodyError = typeof data?.error === "string" ? data.error.trim() : "";
  if (error) {
    throw new Error(bodyError || error.message || "Failed to get picker token");
  }
  if (bodyError || !data?.accessToken) {
    throw new Error(bodyError || "Google account not connected");
  }
  return data.accessToken;
}

async function fetchPickerConfigFromEdge(): Promise<{ apiKey: string; appId: string } | null> {
  const { data, error } = await supabase.functions.invoke<{
    apiKey?: string;
    appId?: string;
    error?: string;
  }>("google-oauth-manage", { body: { action: "picker_config" } });
  if (error || data?.error) return null;
  const apiKey = typeof data?.apiKey === "string" ? data.apiKey.trim() : "";
  const appId = typeof data?.appId === "string" ? data.appId.trim() : "";
  if (!apiKey || !appId) return null;
  return { apiKey, appId };
}

async function resolvePickerConfig(): Promise<{ apiKey: string; appId: string }> {
  const envApiKey = import.meta.env.VITE_GOOGLE_PICKER_API_KEY?.trim() ?? "";
  const envAppId = import.meta.env.VITE_GOOGLE_PICKER_APP_ID?.trim() ?? "";
  if (envApiKey && envAppId) {
    return { apiKey: envApiKey, appId: envAppId };
  }

  const edge = await fetchPickerConfigFromEdge();
  if (edge) return edge;

  if (!envApiKey) {
    throw new Error("VITE_GOOGLE_PICKER_API_KEY is not configured");
  }
  throw new Error("VITE_GOOGLE_PICKER_APP_ID is not configured");
}

function beginGooglePickerHostSession(): () => void {
  if (typeof document === "undefined") {
    return () => undefined;
  }

  document.body.classList.add(GOOGLE_PICKER_BODY_CLASS);
  window.dispatchEvent(new CustomEvent(GOOGLE_PICKER_HOST_OPEN_EVENT));

  const isPickerLayer = (el: Element): boolean => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.classList.contains("picker-dialog") || el.classList.contains("picker-dialog-bg")) {
      return true;
    }
    if (el.tagName === "IFRAME") {
      const src = el.getAttribute("src") ?? "";
      const name = el.getAttribute("name") ?? "";
      return (
        src.includes("google.com/picker") ||
        src.includes("docs.google.com/picker") ||
        name.toLowerCase().includes("picker")
      );
    }
    return Boolean(el.querySelector("iframe[src*='picker'], .picker-dialog, .picker-dialog-bg"));
  };

  const unlockHostOverlays = (): void => {
    document.querySelectorAll<HTMLElement>("[data-radix-focus-guard]").forEach((el) => {
      el.style.display = "none";
      el.style.pointerEvents = "none";
      el.tabIndex = -1;
    });

    document.querySelectorAll<HTMLElement>("[aria-hidden='true'], [inert]").forEach((el) => {
      if (isPickerLayer(el)) {
        el.removeAttribute("aria-hidden");
        el.removeAttribute("inert");
      }
    });

    document.body.querySelectorAll<HTMLElement>(":scope > *").forEach((el) => {
      if (!isPickerLayer(el)) return;
      el.removeAttribute("aria-hidden");
      el.removeAttribute("inert");
      el.style.pointerEvents = "auto";
      el.style.zIndex = "2147483646";
    });
  };

  unlockHostOverlays();
  const observer = new MutationObserver(() => unlockHostOverlays());
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-hidden", "inert", "style", "class"],
  });

  const onFocusIn = (event: FocusEvent): void => {
    if (!isGooglePickerHostSessionActive()) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("[data-radix-focus-guard]")) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  };
  document.addEventListener("focusin", onFocusIn, true);

  return () => {
    observer.disconnect();
    document.removeEventListener("focusin", onFocusIn, true);
    document.body.classList.remove(GOOGLE_PICKER_BODY_CLASS);
    window.dispatchEvent(new CustomEvent(GOOGLE_PICKER_HOST_CLOSE_EVENT));
    document.querySelectorAll<HTMLElement>("[data-radix-focus-guard]").forEach((el) => {
      el.style.display = "";
      el.style.pointerEvents = "";
      el.tabIndex = 0;
    });
  };
}

/**
 * Opens Google Picker so the user grants this app access to specific Drive files/folders (drive.file scope).
 */
export async function openGoogleDrivePicker(
  options: OpenGoogleDrivePickerOptions = {},
): Promise<GoogleDrivePickerSelection[]> {
  const { apiKey, appId } = await resolvePickerConfig();
  const oauthToken = await fetchPickerAccessToken();
  await loadGapiPicker();

  const pickerNs = window.google?.picker;
  if (!pickerNs) {
    throw new Error("Google Picker is not available");
  }

  const preselectId = options.preselectIds?.find((id) => id.trim())?.trim() ?? "";
  const origin =
    typeof window !== "undefined" ? `${window.location.protocol}//${window.location.host}` : "";
  const relayHost = typeof window !== "undefined" ? window.location.host : "";

  const bumpPickerLayers = (): void => {
    if (!isGooglePickerHostSessionActive()) return;
    document.querySelectorAll<HTMLElement>(".picker-dialog, .picker-dialog-bg").forEach((el) => {
      el.removeAttribute("aria-hidden");
      el.removeAttribute("inert");
      el.style.pointerEvents = "auto";
      el.style.zIndex = "2147483646";
    });
  };

  return new Promise((resolve, reject) => {
    const endHostSession = beginGooglePickerHostSession();

    const finish = (selection: GoogleDrivePickerSelection[]) => {
      endHostSession();
      resolve(selection);
    };

    const fail = (error: Error) => {
      endHostSession();
      reject(error);
    };

    try {
      const view = options.selectFolder
        ? new pickerNs.DocsView(pickerNs.ViewId.FOLDERS)
        : new pickerNs.DocsView(pickerNs.ViewId.DOCS);

      if (options.selectFolder) {
        view.setIncludeFolders(true);
        view.setSelectFolderEnabled(true);
      } else {
        view.setMimeTypes(
          "image/png,image/jpeg,image/gif,image/webp,video/mp4,video/quicktime,application/vnd.google-apps.folder",
        );
      }

      const builder = new pickerNs.PickerBuilder()
        .addView(view)
        .setOAuthToken(oauthToken)
        .setDeveloperKey(apiKey)
        .setAppId(appId)
        .setTitle(
          options.selectFolder
            ? "Select a folder Synckerja may access"
            : "Select files Synckerja may access",
        )
        .enableFeature(pickerNs.Feature.SUPPORT_DRIVES)
        .setCallback((data) => {
          if (data.action === pickerNs.Action.CANCEL) {
            finish([]);
            return;
          }
          if (data.action === pickerNs.Action.PICKED && Array.isArray(data.docs)) {
            finish(
              data.docs.map((d) => ({
                id: d.id,
                name: d.name,
                mimeType: d.mimeType,
              })),
            );
            return;
          }
          finish([]);
        });

      if (origin) {
        builder.setOrigin(origin);
      }
      if (relayHost) {
        builder.setRelayUrl(relayHost);
      }

      if (!options.selectFolder && preselectId) {
        builder.setFileIds([preselectId]);
      }

      builder.build().setVisible(true);
      window.setTimeout(bumpPickerLayers, 0);
      window.setTimeout(bumpPickerLayers, 120);
    } catch (e) {
      fail(e instanceof Error ? e : new Error(String(e)));
    }
  });
}
