/**
 * One-off maintainer script: splits translations.ts into per-language chunks for code-splitting.
 * Run: node scripts/split-i18n-translations.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcPath = path.join(root, "src/shared/i18n/translations.ts");
const outDir = path.join(root, "src/shared/i18n");

const src = fs.readFileSync(srcPath, "utf8");
const lines = src.split("\n");

const idStart = lines.findIndex((l) => l.startsWith("const idTranslations"));
const enStart = lines.findIndex((l) => l.startsWith("const enTranslations"));
const exportStart = lines.findIndex((l) => l.startsWith("export const defaultTranslations"));

if (idStart < 0 || enStart < 0 || exportStart < 0) {
  throw new Error("Could not locate id/en/export blocks in translations.ts");
}

const preamble = lines.slice(0, idStart).join("\n");
const idBlock = lines
  .slice(idStart, enStart)
  .join("\n")
  .replace(/^const idTranslations/, "export const idTranslations");
const enBlock = lines
  .slice(enStart, exportStart)
  .join("\n")
  .replace(/^const enTranslations/, "export const enTranslations");
const footer = lines.slice(exportStart).join("\n");

const sharedTypes = `${preamble}
export type TranslationDictionary = Record<string, string>;
`;

fs.writeFileSync(
  path.join(outDir, "translations-id.ts"),
  `${sharedTypes}\n${idBlock}\n`,
  "utf8",
);
fs.writeFileSync(
  path.join(outDir, "translations-en.ts"),
  `${sharedTypes}\n${enBlock}\n`,
  "utf8",
);

const loader = `import type { AppLanguage } from "./translations";
import type { TranslationDictionary } from "./translationTypes";

export type { TranslationDictionary } from "./translationTypes";
export {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  APP_LANGUAGE_DEVICE_OVERRIDE_KEY,
} from "./translationTypes";

const cache: Partial<Record<AppLanguage, TranslationDictionary>> = {};

export function getCachedTranslationDictionary(
  lang: AppLanguage,
): TranslationDictionary | undefined {
  return cache[lang];
}

/** Loads one language dictionary (code-split chunk). */
export async function loadTranslationDictionary(
  lang: AppLanguage,
): Promise<TranslationDictionary> {
  if (cache[lang]) return cache[lang]!;
  const mod =
    lang === "en"
      ? await import("./translations-en")
      : await import("./translations-id");
  const dict = lang === "en" ? mod.enTranslations : mod.idTranslations;
  cache[lang] = dict;
  return dict;
}

export const applyVariables = (
  value: string,
  variables?: Record<string, string | number>,
): string => {
  if (!variables) return value;
  return Object.entries(variables).reduce<string>(
    (acc, [placeholder, v]) => acc.replace(\`{{\${placeholder}}}\`, String(v)),
    value,
  );
};

/** @deprecated Use loadTranslationDictionary — kept for rare sync call sites during migration */
export const defaultTranslations: Record<AppLanguage, TranslationDictionary> = new Proxy(
  {} as Record<AppLanguage, TranslationDictionary>,
  {
    get(_target, prop: string) {
      if (prop !== "id" && prop !== "en") return undefined;
      return cache[prop as AppLanguage];
    },
  },
);
`;

fs.writeFileSync(path.join(outDir, "translationTypes.ts"), `${preamble}\n`, "utf8");

// applyVariables + proxy loader (replaces monolithic translations.ts)
const oldTranslationsBackup = path.join(outDir, "translations.monolith.bak.ts");
if (!fs.existsSync(oldTranslationsBackup)) {
  fs.copyFileSync(srcPath, oldTranslationsBackup);
}
fs.writeFileSync(path.join(outDir, "translations.ts"), loader, "utf8");

console.log("Split complete:", { idStart, enStart, exportStart });
