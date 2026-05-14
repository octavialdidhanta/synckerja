import React, { useState, useMemo, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { Save, RefreshCw, Pencil, X } from 'lucide-react';
import { stringifyMarkdownTable } from '@/6-1-dashboard/utils/markdownTableUtils';
import { EditableBriefTable } from '@/6-1-dashboard/modal/EditableBriefTable';
import { toast } from 'sonner';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { SaveToPlanModal } from './SaveToPlanModal';
import { RevisiModal } from './RevisiModal';
import { ReframeModal } from './ReframeModal';
import { RevisionSectionWrapper } from './RevisionSectionWrapper';
import { RevisionTable } from './RevisionTable';
import { parseScriptSections, type ScriptSection, type SectionType } from '../utils/parseScriptSections';
import { mergeRevisedPart, mergeTableCellRevision, mergeTableRowRevision, deleteTableRow } from '../utils/mergeRevisedPart';
import {
  SCRIPT_BREAKDOWN_CELL_TD,
  SCRIPT_BREAKDOWN_CELL_TH,
  scriptBreakdownMarkdownTableClassName,
} from '../utils/scriptBreakdownTableClasses';
import { reviseScriptPart, regenerateScriptWithDifferentProblem } from '../services/scriptGeneratorAIService';

/** Format satu baris tabel (string[]) jadi satu baris markdown | a | b | c | */
function tableRowToMarkdownLine(cells: string[]): string {
  if (!cells?.length) return '';
  const escape = (s: string) => String(s ?? '').trim().replace(/\n/g, ' ');
  return '| ' + cells.map(escape).join(' | ') + ' |';
}
/** Remove trailing empty columns so header stays row 0 and we don't get an extra "action" column from markdown trailing pipe */
function trimEmptyTableColumns(rows: string[][]): string[][] {
  if (rows.length === 0) return rows;
  const colCount = Math.max(...rows.map((r) => r.length));
  let lastNonEmptyCol = -1;
  for (let c = 0; c < colCount; c++) {
    const hasContent = rows.some((r) => (r[c] ?? '').trim() !== '');
    if (hasContent) lastNonEmptyCol = c;
  }
  if (lastNonEmptyCol < 0) return rows;
  return rows.map((r) => r.slice(0, lastNonEmptyCol + 1));
}

/** True if text looks like only table rows (every non-empty line is |...|), used to skip duplicate bottom-of-table in save */
function looksLikeTableRowsOnly(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  return lines.every((line) => line.startsWith('|') && line.endsWith('|'));
}

/** True if part is table markdown (has header and alignment row) */
function isTablePart(part: string): boolean {
  const p = part.trim();
  return p.startsWith('|') && p.includes('\n') && /\|[\s\-:]+\|/.test(p);
}

/** True if text starts with Format & Style section marker (## Format, **Format & Style**, etc.) */
function startsWithFormatStyleMarker(text: string): boolean {
  const t = text.trim();
  return /^#+\s*Format/i.test(t) || /^\*\*Format\s*&\s*Style\*\*/i.test(t);
}

const PROSE_CLASS =
  'prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-gray-900 prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-3 prose-p:mb-4 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:text-gray-900 prose-hr:my-4 prose-hr:border-gray-200';

/** Textarea that auto-expands height to fit content (no scroll inside field) */
function AutoResizeSectionTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(80, el.scrollHeight)}px`;
  }, [props.value]);
  return (
    <Textarea
      ref={ref}
      {...props}
      className={(props.className || '') + ' resize-none overflow-hidden'}
    />
  );
}

/** Wide breakdown tables: prose forces width:100%; w-max + min-w-full lets columns grow and this wrapper scrolls horizontally. */
const MARKDOWN_TABLE_SCROLL_WRAP =
  'scrollbar-hide seamless-scroll my-4 w-full min-w-0 max-w-full overflow-x-auto rounded-lg border border-gray-200';

const MARKDOWN_COMPONENTS = {
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className={MARKDOWN_TABLE_SCROLL_WRAP}>
      <table className={scriptBreakdownMarkdownTableClassName()}>{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => <thead className="bg-gray-50">{children}</thead>,
  tbody: ({ children }: { children?: React.ReactNode }) => (
    <tbody className="divide-y divide-gray-200 bg-white">{children}</tbody>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr className="divide-x divide-gray-200 hover:bg-gray-50/50 transition-colors">{children}</tr>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className={SCRIPT_BREAKDOWN_CELL_TH}>{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className={SCRIPT_BREAKDOWN_CELL_TD}>{children}</td>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-lg font-semibold text-gray-900 mt-4 mb-2 first:mt-0 pb-1 border-b border-gray-100">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-base font-semibold text-gray-900 mt-4 mb-2 first:mt-0 pb-1">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-3 mb-4 text-gray-700 leading-relaxed">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-2 ml-4 list-disc space-y-1 text-gray-700">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-2 ml-4 list-decimal space-y-1 text-gray-700">{children}</ol>
  ),
  hr: () => <hr className="my-4 border-t-2 border-dashed border-gray-200" />,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-2 pl-4 border-l-4 border-gray-300 text-gray-600 italic">{children}</blockquote>
  ),
};

interface FormDataForPlan {
  content_type_id?: string;
  service_id?: string;
  sub_service_id?: string;
  content_pillar_id?: string;
}

interface AIScriptResultProps {
  script: string;
  formDataForPlan?: FormDataForPlan | null;
  onScriptChange?: (script: string) => void;
}

const SECTION_LABELS: Record<SectionType, string> = {
  concept: 'Concept',
  judul: 'Judul Script',
  formatStyle: 'Format & Style',
  table: 'Tabel',
  caption: 'Caption',
  hashtag: 'Hashtag',
};

export const AIScriptResult: React.FC<AIScriptResultProps> = ({
  script,
  formDataForPlan,
  onScriptChange,
}) => {
  const { t } = useAppTranslation();
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [revisiModalOpen, setRevisiModalOpen] = useState(false);
  const [reframeModalOpen, setReframeModalOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [revisiTarget, setRevisiTarget] = useState<{
    originalText: string;
    startIndex?: number;
    endIndex?: number;
    sectionType: SectionType;
    tableCell?: { rowIndex: number; colIndex: number; tableStartIndex: number; tableEndIndex: number; tableData?: string[][] };
    tableRow?: { rowIndex: number; tableStartIndex: number; tableEndIndex: number; tableData?: string[][] };
  } | null>(null);
  const [isRevising, setIsRevising] = useState(false);
  const [selectionRevisi, setSelectionRevisi] = useState<string | null>(null);
  const [isManualEdit, setIsManualEdit] = useState(false);
  const [manualEditBlocks, setManualEditBlocks] = useState<Array<{ type: 'text' | 'table'; content: string | string[][]; label?: string }>>([]);

  const { sections, fullScript } = useMemo(() => parseScriptSections(script), [script]);

  const segments = useMemo(() => {
    const segs: Array<{ start: number; end: number; section?: ScriptSection }> = [];
    const sorted = [...sections].sort((a, b) => a.startIndex - b.startIndex);
    let lastEnd = 0;
    for (const sec of sorted) {
      if (sec.startIndex > lastEnd) {
        segs.push({ start: lastEnd, end: sec.startIndex, section: undefined });
      }
      segs.push({ start: sec.startIndex, end: sec.endIndex, section: sec });
      lastEnd = sec.endIndex;
    }
    if (lastEnd < fullScript.length) {
      segs.push({ start: lastEnd, end: fullScript.length, section: undefined });
    }
    return segs;
  }, [sections, fullScript]);

  const startManualEdit = () => {
    const blocks: Array<{ type: 'text' | 'table'; content: string | string[][]; label?: string }> = [];
    for (const seg of segments) {
      const slice = fullScript.slice(seg.start, seg.end);
      const label = seg.section ? SECTION_LABELS[seg.section.type] : undefined;
      if (seg.section?.type === 'table' && seg.section.tableData && seg.section.tableData.length > 0) {
        const tableData = trimEmptyTableColumns(seg.section.tableData);
        blocks.push({ type: 'table', content: tableData, label: SECTION_LABELS.table });
      } else {
        blocks.push({ type: 'text', content: slice, label });
      }
    }
    setManualEditBlocks(blocks);
    setIsManualEdit(true);
  };
  const cancelManualEdit = () => {
    setIsManualEdit(false);
    setManualEditBlocks([]);
  };
  const saveManualEdit = () => {
    if (!onScriptChange) return;
    const parts: string[] = [];
    for (const block of manualEditBlocks) {
      if (block.type === 'table') {
        const tableRows = block.content as string[][];
        if (tableRows.length > 0) {
          const trimmed = trimEmptyTableColumns(tableRows);
          const part = stringifyMarkdownTable(trimmed);
          if (part.trim() && part.trim() !== parts[parts.length - 1]?.trim()) {
            parts.push(part);
          }
        }
      } else {
        const part = block.content as string;
        const t = part.trim();
        // Skip empty and skip duplicate of previous part (prevents redundant caption/hashtag after overlap)
        if (!t) continue;
        if (t === parts[parts.length - 1]?.trim()) continue;
        // Skip text block that is only table rows when previous part is table (prevents duplicate bottom-of-table)
        const prev = parts[parts.length - 1];
        if (prev && isTablePart(prev) && looksLikeTableRowsOnly(t)) continue;
        // Skip duplicate Format & Style section (prevents redundant Format & Style after save)
        if (prev && startsWithFormatStyleMarker(prev) && startsWithFormatStyleMarker(t)) continue;
        parts.push(part);
      }
    }
    const newScript = parts.join('\n\n').trim() || script;
    onScriptChange(newScript);
    toast.success(t('scriptGenerator.manualEditSaved', 'Perubahan berhasil disimpan'));
    setIsManualEdit(false);
    setManualEditBlocks([]);
  };
  const updateManualEditBlock = (index: number, content: string | string[][]) => {
    setManualEditBlocks((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      const normalized = typeof content === 'string' ? content : trimEmptyTableColumns(content);
      next[index] = { ...next[index], content: normalized };
      return next;
    });
  };

  const getBlockLabel = (block: { label?: string }, idx: number) =>
    block.label || `${t('scriptGenerator.editManualTextLabel', 'Konten')} ${idx + 1}`;

  const handleRevisiSection = (sectionId: string, content: string, sectionType: SectionType) => {
    const sec = sections.find((s) => s.id === sectionId);
    setRevisiTarget({
      originalText: content,
      startIndex: sec?.startIndex,
      endIndex: sec?.endIndex,
      sectionType,
    });
    setRevisiModalOpen(true);
  };

  const handleRevisiTableCell = (
    rowIndex: number,
    colIndex: number,
    value: string,
    tableStartIndex: number,
    tableEndIndex: number,
    tableData?: string[][]
  ) => {
    setRevisiTarget({
      originalText: value,
      sectionType: 'table',
      tableCell: { rowIndex, colIndex, tableStartIndex, tableEndIndex, tableData },
    });
    setRevisiModalOpen(true);
  };

  const handleRevisiTableSection = (tableMarkdown: string) => {
    const tableSec = sections.find((s) => s.type === 'table');
    setRevisiTarget({
      originalText: tableMarkdown,
      startIndex: tableSec?.startIndex,
      endIndex: tableSec?.endIndex,
      sectionType: 'table',
    });
    setRevisiModalOpen(true);
  };

  const handleRevisiTableRow = (
    rowIndex: number,
    rowContent: string,
    tableStartIndex: number,
    tableEndIndex: number,
    tableData?: string[][]
  ) => {
    setRevisiTarget({
      originalText: rowContent,
      sectionType: 'table',
      tableRow: { rowIndex, tableStartIndex, tableEndIndex, tableData },
    });
    setRevisiModalOpen(true);
  };

  const handleDeleteTableRow = (
    rowIndex: number,
    tableStartIndex: number,
    tableEndIndex: number,
    tableData?: string[][]
  ) => {
    if (!onScriptChange) return;
    const newScript = deleteTableRow(script, {
      tableStartIndex,
      tableEndIndex,
      rowIndex,
      tableData,
    });
    if (newScript !== script) {
      onScriptChange(newScript);
      toast.success(t('scriptGenerator.revisi.deleteRowSuccess', 'Baris berhasil dihapus'));
    }
  };

  const handleRevisiSelection = () => {
    if (selectionRevisi) {
      setRevisiTarget({
        originalText: selectionRevisi,
        sectionType: 'concept',
      });
      setSelectionRevisi(null);
      setRevisiModalOpen(true);
    }
  };

  const handleRevisiConfirm = async (instruction: string) => {
    if (!revisiTarget || !onScriptChange) return;
    setIsRevising(true);
    try {
      let previousRowText: string | undefined;
      let nextRowText: string | undefined;
      if (revisiTarget.tableRow?.tableData?.length) {
        const { rowIndex, tableData } = revisiTarget.tableRow;
        if (rowIndex > 0) {
          const prev = tableData[rowIndex - 1];
          if (prev?.length) previousRowText = tableRowToMarkdownLine(prev);
        }
        if (rowIndex < tableData.length - 1) {
          const next = tableData[rowIndex + 1];
          if (next?.length) nextRowText = tableRowToMarkdownLine(next);
        }
      }
      const result = await reviseScriptPart(
        revisiTarget.originalText,
        instruction,
        revisiTarget.tableRow ? 'tableRow' : revisiTarget.sectionType,
        script,
        previousRowText,
        nextRowText
      );
      if (!result.success || !result.script) {
        toast.error(result.error || 'Gagal merevisi');
        throw new Error(result.error);
      }
      let newScript: string;
      if (revisiTarget.tableCell) {
        newScript = mergeTableCellRevision(script, {
          tableStartIndex: revisiTarget.tableCell.tableStartIndex,
          tableEndIndex: revisiTarget.tableCell.tableEndIndex,
          rowIndex: revisiTarget.tableCell.rowIndex,
          colIndex: revisiTarget.tableCell.colIndex,
          revisedCellValue: result.script,
          tableData: revisiTarget.tableCell.tableData,
        });
      } else if (revisiTarget.tableRow) {
        newScript = mergeTableRowRevision(script, {
          tableStartIndex: revisiTarget.tableRow.tableStartIndex,
          tableEndIndex: revisiTarget.tableRow.tableEndIndex,
          rowIndex: revisiTarget.tableRow.rowIndex,
          revisedRowMarkdown: result.script,
          tableData: revisiTarget.tableRow.tableData,
        });
      } else {
        newScript = mergeRevisedPart(
          script,
          revisiTarget.originalText,
          result.script,
          revisiTarget.startIndex,
          revisiTarget.endIndex
        );
      }
      // Fallback: when table cell/row merge returns unchanged (parse/indices mismatch), try text-based replace
      if ((revisiTarget.tableCell || revisiTarget.tableRow) && newScript === script && revisiTarget.originalText?.trim()) {
        const fallback = mergeRevisedPart(script, revisiTarget.originalText, result.script);
        if (fallback !== script) newScript = fallback;
      }
      if (newScript === script) {
        toast.error(
          'Teks tidak ditemukan untuk diganti. Pastikan: 1) Isi instruksi revisi, 2) Script belum berubah sejak memilih, 3) Pilih ulang teks/bagian yang ingin direvisi.'
        );
        throw new Error('Replace failed');
      }
      onScriptChange(newScript);
      toast.success('Revisi berhasil');
      setRevisiModalOpen(false);
      setRevisiTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Revisi gagal. Coba lagi.');
    } finally {
      setIsRevising(false);
    }
  };

  const handleReframeConfirm = async (instruction: string) => {
    if (!onScriptChange) return;
    setIsRegenerating(true);
    try {
      const result = await regenerateScriptWithDifferentProblem(script, instruction);
      if (!result.success || !result.script) {
        toast.error(result.error || 'Gagal meregenerasi');
        throw new Error(result.error);
      }
      onScriptChange(result.script);
      toast.success('Script berhasil diregenerasi');
      setReframeModalOpen(false);
    } catch {
      // Error handled above
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString()?.trim();
    setSelectionRevisi(text || null);
  };

  return (
    <div className="space-y-2">
      <div className="sticky top-0 z-10 flex flex-col gap-2 bg-white pb-2 -mt-0 pt-0 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
        <h3 className="text-lg font-semibold">{t('scriptGenerator.aiResultTitle', 'Hasil Script dari AI (Gemini)')}</h3>
        <div className="flex gap-2 flex-nowrap overflow-x-auto seamless-scroll">
          {onScriptChange && (
            <Button
              variant="outline"
              size="sm"
              onClick={isManualEdit ? cancelManualEdit : startManualEdit}
              disabled={!script?.trim()}
              title={isManualEdit ? t('common.cancel', 'Batal') : t('scriptGenerator.editManual', 'Edit manual')}
            >
              {isManualEdit ? <X className="h-4 w-4 mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
              {isManualEdit ? t('common.cancel', 'Batal') : t('scriptGenerator.editManual', 'Edit manual')}
            </Button>
          )}
          {isManualEdit && onScriptChange && (
            <Button
              variant="default"
              size="sm"
              onClick={saveManualEdit}
              title={t('common.save', 'Simpan')}
            >
              <Save className="h-4 w-4 mr-2" />
              {t('common.save', 'Simpan')}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReframeModalOpen(true)}
            disabled={!script?.trim() || !onScriptChange || isRegenerating || isManualEdit}
            title={t('scriptGenerator.reframe.button', 'Regenerate dengan masalah berbeda')}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('scriptGenerator.reframe.button', 'Regenerate dengan masalah berbeda')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSaveModalOpen(true)}
            disabled={!script?.trim()}
            title={t('scriptGenerator.saveToPlanButton', 'Simpan ke Plan')}
          >
            <Save className="h-4 w-4 mr-2" />
            {t('scriptGenerator.saveToPlanButton', 'Simpan ke Plan')}
          </Button>
        </div>
      </div>

      <ReframeModal
        open={reframeModalOpen}
        onClose={() => setReframeModalOpen(false)}
        onConfirm={handleReframeConfirm}
        isRegenerating={isRegenerating}
      />

      <SaveToPlanModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        script={script}
        formDataForPlan={formDataForPlan}
      />

      <RevisiModal
        open={revisiModalOpen}
        onClose={() => {
          setRevisiModalOpen(false);
          setRevisiTarget(null);
        }}
        originalText={revisiTarget?.originalText ?? ''}
        sectionLabel={revisiTarget ? SECTION_LABELS[revisiTarget.sectionType] : undefined}
        onConfirm={handleRevisiConfirm}
        isRevising={isRevising}
      />

      <div
        className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
        onMouseUp={isManualEdit ? undefined : handleMouseUp}
      >
        {isManualEdit ? (
          <div className="px-4 pt-4 pb-4 flex flex-col gap-4 min-h-0">
            <p className="text-sm text-gray-600 flex-shrink-0">
              {t('scriptGenerator.editManualHint', 'Edit script secara manual. Tabel dan teks dapat diedit langsung.')}
            </p>
            <div className="space-y-4 min-w-0">
              {manualEditBlocks.map((block, idx) => (
                <div key={idx} className="space-y-2">
                  {block.type === 'table' ? (
                    <>
                      <h4 className="text-sm font-semibold text-gray-800">
                        {getBlockLabel(block, idx)}
                      </h4>
                      <EditableBriefTable
                        tableData={block.content as string[][]}
                        alwaysEditable
                        onChange={(newData) => updateManualEditBlock(idx, newData)}
                        className="max-h-[min(450px,60vh)] min-h-0 flex-shrink-0"
                      />
                    </>
                  ) : (
                    <>
                      <h4 className="text-sm font-semibold text-gray-800">
                        {getBlockLabel(block, idx)}
                      </h4>
                      <AutoResizeSectionTextarea
                        value={block.content as string}
                        onChange={(e) => updateManualEditBlock(idx, e.target.value)}
                        className="min-h-[80px] font-mono text-sm"
                        placeholder={t('scriptGenerator.editManualPlaceholder', 'Teks...')}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
        <>
        {selectionRevisi && onScriptChange && (
          <div className="sticky top-0 z-10 flex justify-center py-2 bg-primary/10 border-b">
            <Button size="sm" onClick={handleRevisiSelection}>
              {t('scriptGenerator.revisi.revisiSelection', 'Revisi selection')}
            </Button>
          </div>
        )}
        <div
          className={`min-w-0 px-4 pt-4 pb-4 ${PROSE_CLASS} [&>*:last-child]:!mb-0 [&_table]:!w-max [&_table]:!min-w-full [&_table]:!table-fixed`}
        >
          {segments.map((seg, idx) => {
            const slice = fullScript.slice(seg.start, seg.end);
            if (!slice.trim()) return null;
            if (seg.section?.type === 'table' && seg.section.tableData) {
              return (
                <RevisionTable
                  key={idx}
                  tableData={seg.section.tableData}
                  tableMarkdown={seg.section.content}
                  startIndex={seg.section.startIndex}
                  endIndex={seg.section.endIndex}
                  onRevisiCell={({ rowIndex, colIndex, value }) =>
                    handleRevisiTableCell(
                      rowIndex,
                      colIndex,
                      value,
                      seg.section!.startIndex,
                      seg.section!.endIndex,
                      seg.section!.tableData
                    )
                  }
                  onRevisiRow={({ rowIndex, rowContent }) =>
                    handleRevisiTableRow(
                      rowIndex,
                      rowContent,
                      seg.section!.startIndex,
                      seg.section!.endIndex,
                      seg.section!.tableData
                    )
                  }
                  onDeleteRow={
                    onScriptChange
                      ? ({ rowIndex }) =>
                          handleDeleteTableRow(
                            rowIndex,
                            seg.section!.startIndex,
                            seg.section!.endIndex,
                            seg.section!.tableData
                          )
                      : undefined
                  }
                  onRevisiSection={handleRevisiTableSection}
                  disabled={!onScriptChange || isRevising}
                />
              );
            }
            if (seg.section && onScriptChange) {
              return (
                <RevisionSectionWrapper
                  key={idx}
                  sectionId={seg.section.id}
                  sectionType={seg.section.type}
                  content={seg.section.content}
                  onRevisi={handleRevisiSection}
                  disabled={isRevising}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                    {slice}
                  </ReactMarkdown>
                </RevisionSectionWrapper>
              );
            }
            return (
              <ReactMarkdown key={idx} remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                {slice}
              </ReactMarkdown>
            );
          })}
        </div>
        </>
        )}
      </div>
    </div>
  );
};
