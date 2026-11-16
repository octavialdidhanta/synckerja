/**
 * Curated Canva-available brand fonts. Keep in sync with
 * src/2-1-employees/ai/brandFonts.ts
 *
 * @typedef {{ canvaName: string, previewFamily: string, roleHint: "headline" | "body" | "both", google?: string }} BrandFont
 */

/** @type {BrandFont[]} */
export const BRAND_FONTS = [
  { canvaName: "Montserrat", previewFamily: '"Montserrat", system-ui, sans-serif', roleHint: "both", google: "Montserrat:wght@400;700" },
  { canvaName: "Poppins", previewFamily: '"Poppins", system-ui, sans-serif', roleHint: "both", google: "Poppins:wght@400;700" },
  { canvaName: "Open Sans", previewFamily: '"Open Sans", system-ui, sans-serif', roleHint: "both", google: "Open+Sans:wght@400;700" },
  { canvaName: "Lato", previewFamily: '"Lato", system-ui, sans-serif', roleHint: "both", google: "Lato:wght@400;700" },
  { canvaName: "Roboto", previewFamily: '"Roboto", system-ui, sans-serif', roleHint: "both", google: "Roboto:wght@400;700" },
  { canvaName: "Nunito", previewFamily: '"Nunito", system-ui, sans-serif', roleHint: "both", google: "Nunito:wght@400;700" },
  { canvaName: "Raleway", previewFamily: '"Raleway", system-ui, sans-serif', roleHint: "both", google: "Raleway:wght@400;700" },
  { canvaName: "Oswald", previewFamily: '"Oswald", system-ui, sans-serif', roleHint: "headline", google: "Oswald:wght@400;700" },
  { canvaName: "Playfair Display", previewFamily: '"Playfair Display", Georgia, serif', roleHint: "headline", google: "Playfair+Display:wght@400;700" },
  { canvaName: "Source Sans 3", previewFamily: '"Source Sans 3", system-ui, sans-serif', roleHint: "body", google: "Source+Sans+3:wght@400;700" },
  { canvaName: "Inter", previewFamily: '"Inter", system-ui, sans-serif', roleHint: "both", google: "Inter:wght@400;700" },
  { canvaName: "Merriweather", previewFamily: '"Merriweather", Georgia, serif', roleHint: "body", google: "Merriweather:wght@400;700" },
  { canvaName: "DM Sans", previewFamily: '"DM Sans", system-ui, sans-serif', roleHint: "both", google: "DM+Sans:wght@400;700" },
  { canvaName: "Bebas Neue", previewFamily: '"Bebas Neue", Impact, sans-serif', roleHint: "headline", google: "Bebas+Neue" },
];

const ALLOWED = new Set(BRAND_FONTS.map((row) => row.canvaName));

/** @param {unknown} name */
export function isAllowedBrandFont(name) {
  const value = String(name ?? "").replace(/\s+/g, " ").trim();
  return ALLOWED.has(value);
}

/** @param {unknown} name */
export function normalizeBrandFont(name) {
  const value = String(name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  return isAllowedBrandFont(value) ? value : "";
}

/**
 * @param {{ headline?: string | null, body?: string | null } | null | undefined} fonts
 * @param {string} genericRule
 */
export function typeLine(fonts, genericRule) {
  const headline = normalizeBrandFont(fonts?.headline);
  const body = normalizeBrandFont(fonts?.body);
  if (!headline && !body) return genericRule;
  if (headline && body) {
    return `Headline text always uses the Canva font "${headline}" on every page. Supporting/deskripsi text always uses the Canva font "${body}" on every page. Do not switch typefaces between pages. The layout of each page may differ.`;
  }
  if (headline) {
    return `Headline text always uses the Canva font "${headline}" on every page. Supporting/deskripsi text uses one consistent complementary font on every page. Do not switch typefaces between pages. The layout of each page may differ.`;
  }
  return `Supporting/deskripsi text always uses the Canva font "${body}" on every page. Headline text uses one consistent complementary font on every page. Do not switch typefaces between pages. The layout of each page may differ.`;
}
