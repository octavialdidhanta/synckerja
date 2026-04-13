import { registerPlugin } from "@capacitor/core";

export type PhotoPickerMediaFile = {
  path: string;
  name: string;
  mimeType: string;
};

export type PhotoPickerPluginType = {
  pickMedia(options: {
    maxItems?: number;
    mediaType?: "imageOnly" | "imageAndVideo";
  }): Promise<{ files: PhotoPickerMediaFile[] }>;
};

/** Bridges Android `PhotoPickerPlugin` (system Photo Picker, no READ_MEDIA_*). */
export const PhotoPicker = registerPlugin<PhotoPickerPluginType>("PhotoPicker");
