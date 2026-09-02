export const CATEGORY_LAYOUTS = ["list", "slider_bleed", "grid_2col"] as const;

export type CategoryLayout = (typeof CATEGORY_LAYOUTS)[number];

export type SliderPresentation = "hidden" | "contained" | "bleed";

export type SectionPresentation = "list" | "slider" | "grid";

export const DEFAULT_CATEGORY_LAYOUT: CategoryLayout = "list";

export function parseCategoryLayout(raw: unknown): CategoryLayout {
  if (raw === "slider_bleed" || raw === "grid_2col") return raw;
  return DEFAULT_CATEGORY_LAYOUT;
}

export function sliderPresentation(itemCount: number): SliderPresentation {
  if (itemCount <= 0) return "hidden";
  if (itemCount === 1) return "contained";
  return "bleed";
}

export function resolveCategorySection(args: {
  layout: unknown;
  itemCount: number;
}): {
  layout: CategoryLayout;
  presentation: SectionPresentation;
  slider: SliderPresentation;
} {
  const layout = parseCategoryLayout(args.layout);
  if (layout === "grid_2col") {
    return { layout, presentation: "grid", slider: "hidden" };
  }
  if (layout === "slider_bleed") {
    return {
      layout,
      presentation: "slider",
      slider: sliderPresentation(args.itemCount),
    };
  }
  return { layout: "list", presentation: "list", slider: "hidden" };
}
