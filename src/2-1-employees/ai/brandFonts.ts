/**
 * Curated Canva-available brand fonts. Keep in sync with
 * supabase/functions/_shared/aiEmployee/brandFonts.mjs
 */

export type BrandFontRole = "headline" | "body" | "both";

export type BrandFont = {
  canvaName: string;
  previewFamily: string;
  roleHint: BrandFontRole;
  google?: string;
};

export const BRAND_FONTS: BrandFont[] = [
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

export function isAllowedBrandFont(name: string): boolean {
  return ALLOWED.has(name.replace(/\s+/g, " ").trim());
}

export function normalizeBrandFont(name: string | null | undefined): string {
  const value = String(name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  return isAllowedBrandFont(value) ? value : "";
}

export function previewStack(name: string | null | undefined): string {
  const value = normalizeBrandFont(name);
  const row = BRAND_FONTS.find((item) => item.canvaName === value);
  return row?.previewFamily ?? "system-ui, sans-serif";
}

export function fontsForRole(role: "headline" | "body"): BrandFont[] {
  return BRAND_FONTS.filter((row) => row.roleHint === "both" || row.roleHint === role);
}

export function googleFontsHref(names: Array<string | null | undefined>): string | null {
  const families = new Set<string>();
  for (const name of names) {
    const value = normalizeBrandFont(name);
    const row = BRAND_FONTS.find((item) => item.canvaName === value);
    if (row?.google) families.add(row.google);
  }
  if (families.size === 0) return null;
  return `https://fonts.googleapis.com/css2?${[...families].map((family) => `family=${family}`).join("&")}&display=swap`;
}

/** SQL allowlist literal for RPC validation (single-quoted, comma-separated). */
export function brandFontSqlAllowlist(): string {
  return BRAND_FONTS.map((row) => `'${row.canvaName.replace(/'/g, "''")}'`).join(", ");
}
