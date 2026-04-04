import { parseAIScriptOutput } from './parseAIScriptOutput';
import { parseMarkdownTable } from '@/6-1-dashboard/utils/markdownTableUtils';

export type SectionType = 'concept' | 'judul' | 'formatStyle' | 'table' | 'caption' | 'hashtag';

export interface ScriptSection {
  id: string;
  type: SectionType;
  content: string;
  startIndex: number;
  endIndex: number;
  /** For table: 2D array [row][col], header at row 0 */
  tableData?: string[][];
}

export interface ParseScriptSectionsResult {
  sections: ScriptSection[];
  fullScript: string;
}

/**
 * Find the full concept section (including heading) for boundary extraction.
 * Only the concept paragraph; stops before **Judul Script**, **Format & Style**, or Breakdown Script table.
 */
function findConceptSection(script: string): { content: string; startIndex: number; endIndex: number } | null {
  const conceptPatterns: Array<{ pattern: RegExp; fullMatch: RegExp }> = [
    {
      pattern: /##\s*Concept\s+of\s+Content\s*##\s*\n([\s\S]*?)(?=\n##|\n###|\n\s*\*\*Judul\s+Script|\n\s*\*\*Format\s|\n\s*Breakdown\s+Script\s+dalam\s+bentuk|$)/i,
      fullMatch: /(##\s*Concept\s+of\s+Content\s*##\s*\n[\s\S]*?)(?=\n##|\n###|\n\s*\*\*Judul\s+Script|\n\s*\*\*Format\s|\n\s*Breakdown\s+Script\s+dalam\s+bentuk|$)/i,
    },
    {
      pattern: /##\s*Konsep\s+Konten(?:\s+Digital\s+Marketing)?\s*##\s*\n([\s\S]*?)(?=\n##|\n###|\n\s*\*\*Judul\s+Script|\n\s*\*\*Format\s|\n\s*Breakdown\s+Script\s+dalam\s+bentuk|$)/i,
      fullMatch: /(##\s*Konsep\s+Konten(?:\s+Digital\s+Marketing)?\s*##\s*\n[\s\S]*?)(?=\n##|\n###|\n\s*\*\*Judul\s+Script|\n\s*\*\*Format\s|\n\s*Breakdown\s+Script\s+dalam\s+bentuk|$)/i,
    },
    {
      pattern: /\*\*Konsep\s+Konten(?:\s+Digital\s+Marketing)?\*\*\s*\n([\s\S]*?)(?=\n##|\n###|\n\s*\*\*Judul\s+Script|\n\s*\*\*Format\s|\n\s*Breakdown\s+Script\s+dalam\s+bentuk|\n\*\*[A-Za-z]|$)/i,
      fullMatch: /(\*\*Konsep\s+Konten(?:\s+Digital\s+Marketing)?\*\*\s*\n[\s\S]*?)(?=\n##|\n###|\n\s*\*\*Judul\s+Script|\n\s*\*\*Format\s|\n\s*Breakdown\s+Script\s+dalam\s+bentuk|\n\*\*[A-Za-z]|$)/i,
    },
  ];
  for (const { fullMatch } of conceptPatterns) {
    const match = script.match(fullMatch);
    if (match && match[1]?.trim()) {
      const startIndex = script.indexOf(match[1]);
      const endIndex = startIndex + match[1].length;
      return { content: match[1].trim(), startIndex, endIndex };
    }
  }
  return null;
}

/**
 * Find Judul Script section.
 */
function findJudulSection(script: string): { content: string; startIndex: number; endIndex: number } | null {
  const patterns = [
    /\*\*Judul Script\*\*\s*:?\s*([^\n]+)/is,
    /\*\*Judul Script\*\*\s*:?\s*\n\s*([^\n]+)/is,
    /###\s*Judul Script\s*\n\s*([^\n]+)/is,
    /##\s*Script Konten Digital Marketing\s*:\s*([^#\n]+)\s*##/is,
  ];
  for (const pattern of patterns) {
    const match = script.match(pattern);
    if (match && match[1]?.trim()) {
      const fullMatch = match[0];
      const startIndex = script.indexOf(fullMatch);
      const endIndex = startIndex + fullMatch.length;
      const content = match[1].trim().replace(/\*\*/g, '').trim();
      return { content: fullMatch.trim(), startIndex, endIndex };
    }
  }
  return null;
}

/**
 * Find caption section (from ## CAPTION ## to end or ## Struktur).
 */
function findCaptionSection(script: string): { content: string; startIndex: number; endIndex: number } | null {
  const captionPatterns = [
    /(>\s*###\s*CAPTION\s*###\s*\n[\s\S]*?)(?=\n##\s*Struktur|$)/is,
    /(###\s*CAPTION\s*###\s*\n[\s\S]*?)(?=\n##\s*Struktur|$)/is,
    /(##\s*CAPTION\s*(?:[-–—]\s*WAJIB\s*DIBUAT)?\s*:?\s*(?:##\s*)?\s*\n[\s\S]*?)(?=\n##\s*Struktur|$)/is,
    /(##\s*Caption\s*:?\s*(?:##\s*)?\s*\n[\s\S]*?)(?=\n##\s*Struktur|$)/is,
    /(\*\*Caption\*\*\s*:?\s*\n[\s\S]*?)(?=\n##\s*Struktur|$)/is,
    /(\*\*CAPTION\*\*\s*:?\s*\n[\s\S]*?)(?=\n##\s*Struktur|$)/is,
    /(###\s*CAPTION\s*:?\s*\n[\s\S]*?)(?=\n##|\n###|$)/is,
  ];
  for (const pattern of captionPatterns) {
    const match = script.match(pattern);
    if (match && match[1]?.trim()) {
      const content = match[1]
        .replace(/\n##\s*Struktur\s*:.*$/is, '')
        .replace(/\n\*\*⚠️\s*HASHTAG.*$/is, '')
        .trim();
      const startIndex = script.indexOf(match[1]);
      const endIndex = startIndex + match[1].length;
      return { content, startIndex, endIndex };
    }
  }
  return null;
}

/**
 * Extract caption text from caption section content (strips header like ## CAPTION ##).
 * Used as fallback when parseAIScriptOutput returns empty caption.
 */
export function extractCaptionFromSection(sectionContent: string): string {
  if (!sectionContent?.trim()) return '';
  const headerPatterns = [
    /^>\s*###\s*CAPTION\s*###\s*\n?/i,
    /^###\s*CAPTION\s*###\s*\n?/i,
    /^#+\s*CAPTION\s*(?:[-–—]\s*WAJIB\s*DIBUAT)?\s*:?\s*(?:#+\s*)?\s*\n?/i,
    /^\*\*CAPTION\*\*\s*:?\s*\n?/i,
    /^\*\*Caption\*\*\s*:?\s*\n?/i,
    /^###\s*CAPTION\s*:?\s*\n?/i,
  ];
  let text = sectionContent.trim();
  for (const p of headerPatterns) {
    text = text.replace(p, '');
  }
  // Strip blockquote prefix from each line if present
  text = text.replace(/^\s*>\s*/gm, '').trim();
  return text.trim();
}

/**
 * Get caption from script using findCaptionSection as fallback.
 * Returns caption text (without header) when parseAIScriptOutput might miss it.
 */
export function getCaptionFallback(script: string): string {
  const trimmed = script?.trim() || '';
  if (!trimmed) return '';
  const section = findCaptionSection(trimmed);
  if (!section?.content) return '';
  return extractCaptionFromSection(section.content);
}

/**
 * Find hashtag lines at end of script (lines starting with #).
 */
function findHashtagSection(script: string): { content: string; startIndex: number; endIndex: number } | null {
  const lines = script.split('\n');
  let hashtagStartLine = -1;
  const hashtagLines: string[] = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed && (trimmed.startsWith('#') || /#\w+/.test(trimmed))) {
      hashtagLines.unshift(line);
      hashtagStartLine = i;
    } else if (hashtagStartLine >= 0) {
      break;
    }
  }
  if (hashtagLines.length === 0) return null;
  const content = hashtagLines.join('\n');
  const beforeHashtag = lines.slice(0, hashtagStartLine).join('\n');
  const startIndex = beforeHashtag.length;
  const endIndex = script.length;
  return { content, startIndex, endIndex };
}

/**
 * Parse script into sections with boundaries for revision/merge.
 */
export function parseScriptSections(script: string): ParseScriptSectionsResult {
  const fullScript = script?.trim() || '';
  const sections: ScriptSection[] = [];

  if (!fullScript) {
    return { sections, fullScript };
  }

  const { brief, caption, concept } = parseAIScriptOutput(fullScript);

  // 1. Concept
  const conceptSection = findConceptSection(fullScript);
  if (conceptSection && concept) {
    sections.push({
      id: 'concept',
      type: 'concept',
      content: conceptSection.content,
      startIndex: conceptSection.startIndex,
      endIndex: conceptSection.endIndex,
    });
  }

  // 2. Judul
  const judulSection = findJudulSection(fullScript);
  if (judulSection) {
    sections.push({
      id: 'judul',
      type: 'judul',
      content: judulSection.content,
      startIndex: judulSection.startIndex,
      endIndex: judulSection.endIndex,
    });
  }

  // 3. Table (first table in full script)
  const tableResult = parseMarkdownTable(fullScript);
  if (tableResult && tableResult.table.length > 0) {
    const tableMarkdown = fullScript.slice(tableResult.startIndex, tableResult.endIndex);
    const absStart = tableResult.startIndex;
    const absEnd = tableResult.endIndex;
    sections.push({
      id: 'table',
      type: 'table',
      content: tableMarkdown,
      startIndex: absStart,
      endIndex: absEnd,
      tableData: tableResult.table,
    });
  }

  // 4. Format & Style - content between Judul and Table (or between concept and table)
  const formatStylePatterns = [
    /\*\*Format\s*&\s*Style\*\*[\s\S]*?(?=\n\|\s|##\s*CAPTION|$)/i,
    /##\s*Format[\s\S]*?(?=\n\|\s|##\s*CAPTION|$)/i,
  ];
  for (const pattern of formatStylePatterns) {
    const match = fullScript.match(pattern);
    if (match && match[0]?.trim()) {
      const startIndex = fullScript.indexOf(match[0]);
      const endIndex = startIndex + match[0].length;
      const existing = sections.find((s) => s.type === 'formatStyle');
      if (!existing) {
        sections.push({
          id: 'formatStyle',
          type: 'formatStyle',
          content: match[0].trim(),
          startIndex,
          endIndex,
        });
      }
      break;
    }
  }

  // 5. Caption - add section when findCaptionSection finds it (even if parseAIScriptOutput missed)
  const captionSection = findCaptionSection(fullScript);
  const captionContent = captionSection ? extractCaptionFromSection(captionSection.content) : '';
  if (captionSection && (caption || captionContent)) {
    sections.push({
      id: 'caption',
      type: 'caption',
      content: captionSection.content,
      startIndex: captionSection.startIndex,
      endIndex: captionSection.endIndex,
    });
  }

  // 6. Hashtag
  const hashtagSection = findHashtagSection(fullScript);
  if (hashtagSection) {
    sections.push({
      id: 'hashtag',
      type: 'hashtag',
      content: hashtagSection.content,
      startIndex: hashtagSection.startIndex,
      endIndex: hashtagSection.endIndex,
    });
  }

  // Sort by startIndex
  sections.sort((a, b) => a.startIndex - b.startIndex);

  // Resolve overlaps so manual-edit save does not duplicate caption/hashtag.
  // Caption often matches to end of script (no "## Struktur") and then hashtag section
  // also matches the tail, so caption and hashtag overlap → save produces duplicate.
  for (let i = 0; i < sections.length - 1; i++) {
    const curr = sections[i];
    const next = sections[i + 1];
    if (curr.endIndex > next.startIndex) {
      curr.endIndex = next.startIndex;
      curr.content = fullScript.slice(curr.startIndex, curr.endIndex).trim();
    }
  }

  return { sections, fullScript };
}
