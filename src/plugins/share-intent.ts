import { registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

export type ShareIntentFileItem = {
  path: string;
  name: string;
  mimeType: string;
  size?: number;
};

export type ShareIntentPluginType = {
  getPendingPayload(): Promise<{
    files: ShareIntentFileItem[];
    route?: string;
    error?: string;
  }>;
  getPendingRoute(): Promise<{ path: string }>;
  clearPendingRoute(): Promise<void>;
  clearPending(): Promise<void>;
  readFileChunk(options: {
    path: string;
    offset: number;
    length: number;
  }): Promise<{ data: string; bytesRead: number }>;
  getFileStat(options: { path: string }): Promise<{ size: number; name?: string }>;
  putDriveResumableChunk(options: {
    path: string;
    uploadUrl: string;
    offset: number;
    length: number;
    total: number;
    statusQuery?: boolean;
  }): Promise<{
    statusCode: number;
    body?: string;
    range?: string;
    location?: string;
  }>;
  addListener(
    eventName: "shareIntentReceived",
    listenerFunc: (payload: {
      files: ShareIntentFileItem[];
      route?: string;
      error?: string;
    }) => void,
  ): Promise<PluginListenerHandle>;
};

/** Bridges Android `ShareIntentPlugin` (share into app → pending files in cache). */
export const ShareIntent = registerPlugin<ShareIntentPluginType>("ShareIntent");
