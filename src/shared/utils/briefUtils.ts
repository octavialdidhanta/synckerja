/**
 * Extract the main title from brief content (first h1, **Judul Script:** value, or first substantial line before Format & Style).
 * Used to display in the Brief Content header to save vertical space.
 */
export function extractBriefTitle(text: string): string | null {
  if (!text?.trim()) return null;
  const lines = text.trim().split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (/^##\s+Format|^Format\s*&?\s*Style/i.test(t)) break;
    if (t.startsWith('## ')) break;
    const h1Match = t.match(/^#\s+(.+)$/);
    if (h1Match) return h1Match[1].trim();
    // **Judul Script:** value (same line) or **Judul Script:**\nvalue (next line)
    const judulSameLine = t.match(/^\*\*Judul\s+Script\*\*\s*:?\s*(.+)$/i);
    if (judulSameLine && judulSameLine[1]?.trim()) return judulSameLine[1].trim();
    const judulLabelOnly = /^\*\*Judul\s+Script\*\*\s*:?\s*$/i.test(t);
    if (judulLabelOnly && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      if (nextLine && !nextLine.startsWith('|') && !nextLine.startsWith('##') && !/^\*\*Format/i.test(nextLine)) {
        return nextLine.replace(/^\*\*(.+?)\*\*$/, '$1').trim();
      }
    }
    if (!t.startsWith('|') && !t.startsWith('-') && !t.startsWith('*') && !t.startsWith('>')) {
      const stripped = t.replace(/^\*\*(.+?)\*\*$/, '$1').trim();
      if (stripped && !/^Judul\s+Script\s*:?\s*$/i.test(stripped)) return stripped;
    }
  }
  return null;
}

/**
 * Remove the title line from the start of brief content (for rendering, to avoid duplication with header).
 * Handles: standalone title, # title, **Judul Script:** value, **Judul Script:**\nvalue.
 */
export function removeBriefTitleFromStart(text: string): string {
  const title = extractBriefTitle(text);
  if (!title) return text;
  const lines = text.split('\n');
  const result: string[] = [];
  let removed = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (removed) {
      result.push(line);
      continue;
    }
    // Exact title match (standalone)
    if (t === title || t === `# ${title}` || t === `**${title}**` || (t.startsWith('# ') && t.slice(2).trim() === title)) {
      removed = true;
      continue;
    }
    // **Judul Script:** value (same line)
    const judulSameLine = t.match(/^\*\*Judul\s+Script\*\*\s*:?\s*(.+)$/i);
    if (judulSameLine && judulSameLine[1]?.trim() === title) {
      removed = true;
      continue;
    }
    // **Judul Script:** (label only) - remove label and next line if it's the title
    if (/^\*\*Judul\s+Script\*\*\s*:?\s*$/i.test(t)) {
      const nextLine = lines[i + 1]?.trim();
      if (nextLine === title || nextLine === `**${title}**`) {
        removed = true;
        i++; // skip next line too
        continue;
      }
    }
    result.push(line);
  }
  return result.join('\n').trim();
}

/**
 * Strip AI introductory sentences from the beginning of brief content.
 * These phrases are not needed when importing to brief modal or displaying.
 * Example: "Berikut adalah script konten digital marketing untuk Reel berdurasi 30 detik, beserta caption yang diminta."
 */
export function stripBriefIntroductorySentence(text: string): string {
  if (!text?.trim()) return text;
  let result = text.trim();

  // Pattern 1: "Berikut adalah script konten digital marketing untuk Reel berdurasi 30 detik, beserta caption yang diminta."
  const intro1 = result.match(
    /^Berikut adalah script konten digital marketing untuk [^.]+\s+berdurasi\s+\d+\s+detik[^.]*beserta caption yang diminta\.?\s*\n?/i
  );
  if (intro1) {
    result = result.slice(intro1[0].length).trim();
    return result;
  }

  // Pattern 2: "Berikut adalah script konten digital marketing untuk Reel berdurasi 30 detik." (shorter)
  const intro2 = result.match(
    /^Berikut adalah script konten digital marketing untuk [^.]+\s+berdurasi\s+\d+\s+detik[^.]*\.\s*\n?/i
  );
  if (intro2) {
    result = result.slice(intro2[0].length).trim();
    return result;
  }

  // Pattern 3: "Tentu, ini dia script konten digital marketing untuk Reel berdurasi 30 detik dan captionnya..."
  const intro3 = result.match(
    /^Tentu,?\s*ini dia script konten digital marketing untuk [^.]+\s+berdurasi\s+\d+\s+detik[^.]*\.\s*\n?/i
  );
  if (intro3) {
    result = result.slice(intro3[0].length).trim();
  }

  return result;
}

/**
 * Strip "Breakdown Script dalam bentuk TABLE" line from brief.
 * Used when saving to plan - this label is not needed in the saved brief.
 */
export function stripBreakdownScriptLabel(text: string): string {
  if (!text?.trim()) return text;
  const lines = text.split('\n');
  const result = lines.filter((line) => {
    const t = line.trim();
    return !/Breakdown\s+Script\s+dalam\s+bentuk\s+TABLE/i.test(t);
  });
  return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Strip "## Script Konten Digital Marketing: X ##" line from brief.
 * Used when saving to plan - this section header is not needed in the saved brief.
 */
export function stripScriptKontenDigitalMarketing(text: string): string {
  if (!text?.trim()) return text;
  let result = text;
  result = result.replace(/^##\s*Script\s+Konten\s+Digital\s+Marketing(?:\s*:\s*[^#\n]*)?\s*##\s*\n?/gim, '');
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Make Judul Script and Format & Style display on one line with their values.
 * Transforms "**Judul Script:**\nvalue" -> "**Judul Script:** value"
 */
export function makeBriefSectionsInline(text: string): string {
  if (!text?.trim()) return text;
  let result = text;
  // **Judul Script:** or **Judul Script** followed by newline and value -> same line
  result = result.replace(/(\*\*Judul\s+Script\*\*\s*:?\s*)\n\s*([^\n*#]+)/gi, '$1 $2');
  // **Format & Style:** followed by content until next ** or ## or table -> same line (newlines to spaces)
  result = result.replace(/(\*\*Format\s*&\s*Style\*\*\s*:?\s*)\n\s*([\s\S]+?)(?=\n\*\*[A-Za-z]|\n##|\n\||$)/gi, (_, label, content) => label + ' ' + content.replace(/\n+/g, ' ').trim());
  return result;
}
