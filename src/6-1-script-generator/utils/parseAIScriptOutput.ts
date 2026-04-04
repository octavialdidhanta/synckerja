import { stripBriefIntroductorySentence } from '@/shared/utils/briefUtils';

/**
 * Extracts the Concept section from AI-generated script.
 * Only the concept paragraph; stops before **Judul Script**, **Format & Style**, Breakdown Script table, or ## CAPTION.
 */
function extractConcept(script: string): string {
  const conceptPatterns = [
    // ## Concept of Content ## or ## Konsep Konten ## — stop at next ##/### or **Judul/**Format/Breakdown
    /##\s*Concept\s+of\s+Content\s*##\s*\n([\s\S]*?)(?=\n##|\n###|\n\s*\*\*Judul\s+Script|\n\s*\*\*Format\s|\n\s*Breakdown\s+Script\s+dalam\s+bentuk|$)/i,
    /##\s*Konsep\s+Konten(?:\s+Digital\s+Marketing)?\s*##\s*\n([\s\S]*?)(?=\n##|\n###|\n\s*\*\*Judul\s+Script|\n\s*\*\*Format\s|\n\s*Breakdown\s+Script\s+dalam\s+bentuk|$)/i,
    // **Konsep Konten** — stop at ##/### or **Judul/**Format/Breakdown
    /\*\*Konsep\s+Konten(?:\s+Digital\s+Marketing)?\*\*\s*\n([\s\S]*?)(?=\n##|\n###|\n\s*\*\*Judul\s+Script|\n\s*\*\*Format\s|\n\s*Breakdown\s+Script\s+dalam\s+bentuk|\n\*\*[A-Za-z]|$)/i,
  ];
  for (const pattern of conceptPatterns) {
    const match = script.match(pattern);
    if (match && match[1]?.trim()) {
      return match[1].trim();
    }
  }
  return '';
}

/**
 * Parses AI-generated script output to extract Brief (Breakdown Script), Caption, and Concept sections.
 * Output follows structure from scriptGeneratorService prompt:
 * - Concept of Content (optional) → Judul → Format & Style → Breakdown Script (table) → ## CAPTION → caption text
 * Strips introductory sentences (e.g. "Berikut adalah script konten digital marketing...") from brief.
 */
export function parseAIScriptOutput(script: string): { brief: string; caption: string; concept: string } {
  if (!script || !script.trim()) {
    return { brief: '', caption: '', concept: '' };
  }

  const trimmed = script.trim();
  const concept = extractConcept(trimmed);

  // Match caption block and extract content (robust: same logic as findCaptionSection in parseScriptSections)
  const captionBlockPatterns: Array<{ marker: RegExp; contentGroup?: number }> = [
    // Three hashes (tiga tagar): ### CAPTION ### and blockquote > ### CAPTION ###
    { marker: />\s*###\s*CAPTION\s*###\s*\n([\s\S]*?)(?=\n##|\n###|\n\*\*⚠️\s*HASHTAG|$)/is, contentGroup: 1 },
    { marker: /###\s*CAPTION\s*###\s*\n([\s\S]*?)(?=\n##|\n###|\n\*\*⚠️\s*HASHTAG|$)/is, contentGroup: 1 },
    // Full block: ## CAPTION ... \n [content] until ## Struktur or end
    { marker: /##\s*CAPTION\s*(?:[-–—]\s*WAJIB\s*DIBUAT)?\s*:?\s*(?:##\s*)?\n([\s\S]*?)(?=\n##\s*Struktur|\n\*\*⚠️\s*HASHTAG|$)/is, contentGroup: 1 },
    { marker: /##\s*Caption\s*:?\s*(?:##\s*)?\n([\s\S]*?)(?=\n##\s*Struktur|\n\*\*⚠️\s*HASHTAG|$)/is, contentGroup: 1 },
    { marker: /\*\*Caption\*\*\s*:?\s*\n([\s\S]*?)(?=\n##\s*Struktur|\n\*\*⚠️\s*HASHTAG|$)/is, contentGroup: 1 },
    { marker: /\*\*CAPTION\*\*\s*:?\s*\n([\s\S]*?)(?=\n##\s*Struktur|\n\*\*⚠️\s*HASHTAG|$)/is, contentGroup: 1 },
    { marker: /###\s*CAPTION\s*:?\s*\n([\s\S]*?)(?=\n##|\n###|\n\*\*⚠️\s*HASHTAG|$)/is, contentGroup: 1 },
    // Variants: single #, CAPTION with ## at end, extra whitespace
    { marker: /#\s*CAPTION\s*:?\s*\n([\s\S]*?)(?=\n#|\n##|\n\*\*⚠️\s*HASHTAG|$)/is, contentGroup: 1 },
    { marker: /##\s*CAPTION\s*##\s*\n([\s\S]*?)(?=\n##|\n\*\*⚠️\s*HASHTAG|$)/is, contentGroup: 1 },
    { marker: /^\s*CAPTION\s*:?\s*[\r\n]+([\s\S]*?)(?=\n\s*#\s+\w|\n##|$)/im, contentGroup: 1 },
    // Marker-only (legacy): extract by slicing after marker
    { marker: />\s*###\s*CAPTION\s*###\s*\n/is },
    { marker: /###\s*CAPTION\s*###\s*\n/is },
    { marker: /##\s*CAPTION\s*(?:[-–—]\s*WAJIB\s*DIBUAT)?\s*:?\s*(?:##\s*)?\n/is },
    { marker: /##\s*Caption\s*:?\s*(?:##\s*)?\n/is },
    { marker: /\*\*Caption\*\*\s*:?\s*\n/is },
    { marker: /\*\*CAPTION\*\*\s*:?\s*\n/is },
    { marker: /##\s*CAPTION\s*##\s*\n/is },
    { marker: /---\s*\n\s*##\s*CAPTION/is },
  ];

  for (const { marker, contentGroup } of captionBlockPatterns) {
    const match = trimmed.match(marker);
    if (match) {
      let caption: string;
      if (contentGroup !== undefined && match[contentGroup]) {
        caption = match[contentGroup].trim();
      } else {
        const captionStartIndex = trimmed.indexOf(match[0]);
        const captionStartIndexAfterMarker = captionStartIndex + match[0].length;
        caption = trimmed.slice(captionStartIndexAfterMarker).trim();
      }
      const briefEndIndex = trimmed.indexOf(match[0]);

      let brief = trimmed.slice(0, briefEndIndex).trim();
      // Remove concept section from brief (saved separately to dashboard Concept)
      if (concept) {
        const conceptSectionPatterns = [
          /##\s*Concept\s+of\s+Content\s*##[\s\S]*?(?=\n##|\n###|\n\s*\*\*Judul\s+Script|\n\s*\*\*Format\s|\n\s*Breakdown\s+Script\s+dalam\s+bentuk|$)/i,
          /##\s*Konsep\s+Konten(?:\s+Digital\s+Marketing)?\s*##[\s\S]*?(?=\n##|\n###|\n\s*\*\*Judul\s+Script|\n\s*\*\*Format\s|\n\s*Breakdown\s+Script\s+dalam\s+bentuk|$)/i,
          /\*\*Konsep\s+Konten(?:\s+Digital\s+Marketing)?\*\*[\s\S]*?(?=\n##|\n###|\n\s*\*\*Judul\s+Script|\n\s*\*\*Format\s|\n\s*Breakdown\s+Script\s+dalam\s+bentuk|\n\*\*[A-Za-z]|$)/i,
        ];
        for (const cp of conceptSectionPatterns) {
          brief = brief.replace(cp, '').trim();
        }
      }
      brief = stripBriefIntroductorySentence(brief);

      // Remove trailing "Struktur:", "Hashtag" instruction lines if present
      caption = caption.replace(/\n##\s*Struktur\s*:.*$/is, '').trim();
      caption = caption.replace(/\n\*\*⚠️\s*HASHTAG.*$/is, '').trim();
      // Strip blockquote prefix from each line if present (e.g. "> line" -> "line")
      caption = caption.replace(/^\s*>\s*/gm, '').trim();
      return { brief, caption, concept };
    }
  }

  // No caption marker found - entire script is brief (minus concept if present)
  let brief = trimmed;
  if (concept) {
    const conceptSectionPatterns = [
      /##\s*Concept\s+of\s+Content\s*##[\s\S]*?(?=\n##|\n###|\n\s*\*\*Judul\s+Script|\n\s*\*\*Format\s|\n\s*Breakdown\s+Script\s+dalam\s+bentuk|$)/i,
      /##\s*Konsep\s+Konten(?:\s+Digital\s+Marketing)?\s*##[\s\S]*?(?=\n##|\n###|\n\s*\*\*Judul\s+Script|\n\s*\*\*Format\s|\n\s*Breakdown\s+Script\s+dalam\s+bentuk|$)/i,
      /\*\*Konsep\s+Konten(?:\s+Digital\s+Marketing)?\*\*[\s\S]*?(?=\n##|\n###|\n\s*\*\*Judul\s+Script|\n\s*\*\*Format\s|\n\s*Breakdown\s+Script\s+dalam\s+bentuk|\n\*\*[A-Za-z]|$)/i,
    ];
    for (const cp of conceptSectionPatterns) {
      brief = brief.replace(cp, '').trim();
    }
  }
  brief = stripBriefIntroductorySentence(brief);
  return { brief, caption: '', concept };
}

/**
 * Escape special regex characters in a string for use in RegExp.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface ParsedAIScriptMetadata {
  title: string;
  contentTypeName: string;
  contentPillarName: string;
}

/**
 * Parse metadata (title, content type, content pillar) from AI-generated script for SaveToPlan auto-fill.
 * Title: extracted from "**Judul Script:**" or "## Script Konten Digital Marketing: X ##" (value only).
 * Content Type: first exact match (word boundary) from contentTypeNames appearing in script.
 * Content Pillar: first exact match from contentPillarNames, or from "**Pillar:** X" pattern.
 */
export function parseAIScriptMetadata(
  script: string,
  contentTypeNames: string[],
  contentPillarNames: string[] = []
): ParsedAIScriptMetadata {
  if (!script || !script.trim()) {
    return { title: '', contentTypeName: '', contentPillarName: '' };
  }

  const trimmed = script.trim();
  let title = '';

  // Title pattern 1: **Judul Script:** Drama H-7... (same line)
  const judulMatch = trimmed.match(/\*\*Judul Script\*\*\s*:?\s*(.+?)(?:\n|$)/is);
  if (judulMatch && judulMatch[1]?.trim()) {
    title = judulMatch[1].trim().replace(/\*\*/g, '').trim();
  }

  // Title pattern 2: **Judul Script:**\nDrama H-7... (title on next line)
  if (!title) {
    const judulNextLine = trimmed.match(/\*\*Judul Script\*\*\s*:?\s*\n\s*(.+?)(?:\n|$)/is);
    if (judulNextLine && judulNextLine[1]?.trim()) {
      title = judulNextLine[1].trim().replace(/\*\*/g, '').trim();
    }
  }

  // Title pattern 3: ### Judul Script\nDrama H-7...
  if (!title) {
    const judulH3 = trimmed.match(/###\s*Judul Script\s*\n\s*(.+?)(?:\n|$)/is);
    if (judulH3 && judulH3[1]?.trim()) {
      title = judulH3[1].trim().replace(/\*\*/g, '').trim();
    }
  }

  // Title pattern 4: ## Script Konten Digital Marketing: X ##
  if (!title) {
    const scriptMatch = trimmed.match(/##\s*Script Konten Digital Marketing\s*:\s*(.+?)\s*##/is);
    if (scriptMatch && scriptMatch[1]?.trim()) {
      title = scriptMatch[1].trim().replace(/\*\*/g, '').trim();
    }
  }

  // Content type: first exact match (word boundary) from contentTypeNames
  let contentTypeName = '';
  for (const name of contentTypeNames) {
    if (!name?.trim()) continue;
    const escaped = escapeRegex(name.trim());
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    if (re.test(trimmed)) {
      contentTypeName = name.trim();
      break;
    }
  }

  // Content pillar: first from "**Pillar:** X" pattern, then from contentPillarNames match
  let contentPillarName = '';
  const pillarMatch = trimmed.match(/\*\*Pillar\*\*\s*:?\s*(.+?)(?:\n|$)/is);
  if (pillarMatch && pillarMatch[1]?.trim()) {
    const pillarValue = pillarMatch[1].trim().replace(/\*\*/g, '').trim();
    const matched = contentPillarNames.find((n) => n.trim().toLowerCase() === pillarValue.toLowerCase());
    if (matched) contentPillarName = matched.trim();
  }
  if (!contentPillarName) {
    for (const name of contentPillarNames) {
      if (!name?.trim()) continue;
      const escaped = escapeRegex(name.trim());
      const re = new RegExp(`\\b${escaped}\\b`, 'i');
      if (re.test(trimmed)) {
        contentPillarName = name.trim();
        break;
      }
    }
  }

  return { title, contentTypeName, contentPillarName };
}
