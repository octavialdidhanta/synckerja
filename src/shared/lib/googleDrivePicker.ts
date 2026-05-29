import { supabase } from "@/shared/lib/supabaseClient";

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
        };
        ViewId: { DOCS: string; FOLDERS: string };
        PickerBuilder: new () => {
          addView: (view: unknown) => unknown;
          setOAuthToken: (token: string) => unknown;
          setDeveloperKey: (key: string) => unknown;
          setAppId: (appId: string) => unknown;
          setCallback: (cb: (data: { action: string; docs?: PickerDoc[] }) => void) => unknown;
          setTitle: (title: string) => unknown;
          enableFeature: (feature: string) => unknown;
          setFileIds: (ids: string[]) => unknown;
          build: () => { setVisible: (v: boolean) => void };
        };
        Feature: { MULTISELECT_ENABLED: string };
        Response: { ACTION: string; DOCUMENTS: string };
      };
    };
  }
}

let gapiLoadPromise: Promise<void> | null = null;

function loadGapiPicker(): Promise<void> {
  if (gapiLoadPromise) return gapiLoadPromise;

  gapiLoadPromise = new Promise((resolve, reject) => {
    if (window.gapi?.load) {
      window.gapi.load("picker", () => resolve());
      return;
    }

    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = () => {
      if (!window.gapi?.load) {
        reject(new Error("Google API failed to load"));
        return;
      }
      window.gapi.load("picker", () => resolve());
    };
    script.onerror = () => reject(new Error("Failed to load Google API script"));
    document.head.appendChild(script);
  });

  return gapiLoadPromise;
}

async function fetchPickerAccessToken(): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{
    accessToken?: string;
    error?: string;
  }>("google-oauth-manage", { body: { action: "picker_access_token" } });

  if (error) {
    throw new Error(error.message || "Failed to get picker token");
  }
  if (data?.error || !data?.accessToken) {
    throw new Error(data?.error ?? "Google account not connected");
  }
  return data.accessToken;
}

function resolvePickerConfig(): { apiKey: string; appId: string } {
  const apiKey = import.meta.env.VITE_GOOGLE_PICKER_API_KEY?.trim() ?? "";
  const appId = import.meta.env.VITE_GOOGLE_PICKER_APP_ID?.trim() ?? "";
  if (!apiKey) {
    throw new Error("VITE_GOOGLE_PICKER_API_KEY is not configured");
  }
  if (!appId) {
    throw new Error("VITE_GOOGLE_PICKER_APP_ID is not configured");
  }
  return { apiKey, appId };
}

/**
 * Opens Google Picker so the user grants this app access to specific Drive files/folders (drive.file scope).
 */
export async function openGoogleDrivePicker(
  options: OpenGoogleDrivePickerOptions = {},
): Promise<GoogleDrivePickerSelection[]> {
  const { apiKey, appId } = resolvePickerConfig();
  const oauthToken = await fetchPickerAccessToken();
  await loadGapiPicker();

  const pickerNs = window.google?.picker;
  if (!pickerNs) {
    throw new Error("Google Picker is not available");
  }

  return new Promise((resolve, reject) => {
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
      .setCallback((data) => {
        if (data.action === pickerNs.Action.CANCEL) {
          resolve([]);
          return;
        }
        if (data.action === pickerNs.Action.PICKED && Array.isArray(data.docs)) {
          resolve(
            data.docs.map((d) => ({
              id: d.id,
              name: d.name,
              mimeType: d.mimeType,
            })),
          );
          return;
        }
        resolve([]);
      });

    if (options.preselectIds?.length) {
      builder.setFileIds(options.preselectIds);
    }

    builder.build().setVisible(true);
  });
}
