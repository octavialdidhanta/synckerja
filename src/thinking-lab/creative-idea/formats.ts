import type { CreativeFormat } from "@/thinking-lab/creative-idea/types";
import type { ImageSettings } from "@/thinking-lab/execution/script";

export function imageSettingsForCreativeFormat(format: CreativeFormat): ImageSettings | null {
  if (format === "video") return null;
  return {
    format: format === "carousel" ? "carousel" : "single",
    slideCountMode: "idea",
    slideCount: null,
    withImage: true,
  };
}
