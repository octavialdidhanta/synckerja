import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import type { ProductKnowledgeAiRow } from '../utils/parseProductKnowledgeAiTable';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Eye, PlusCircle } from 'lucide-react';

function DetailSection({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-sm text-gray-900 whitespace-pre-wrap rounded bg-gray-50 border border-gray-100 p-3">
        {value || '—'}
      </div>
    </div>
  );
}

interface ProductKnowledgeAiResultTableProps {
  rows: ProductKnowledgeAiRow[];
  onAddAsNewRow: (aiRow: ProductKnowledgeAiRow) => void;
}

export const ProductKnowledgeAiResultTable: React.FC<ProductKnowledgeAiResultTableProps> = ({
  rows,
  onAddAsNewRow,
}) => {
  const { t } = useAppTranslation();
  const [contentViewer, setContentViewer] = useState<{ open: boolean; title: string; content: string }>({
    open: false,
    title: '',
    content: '',
  });
  const [detailModalRow, setDetailModalRow] = useState<ProductKnowledgeAiRow | null>(null);

  const openContentViewer = (title: string, content: string) => {
    setContentViewer({ open: true, title, content: content || '—' });
  };

  const openDetailModal = (row: ProductKnowledgeAiRow) => {
    setDetailModalRow(row);
  };

  const closeDetailModal = () => {
    setDetailModalRow(null);
  };

  const handleAddFromDetailModal = () => {
    if (detailModalRow) {
      onAddAsNewRow(detailModalRow);
      closeDetailModal();
    }
  };

  if (rows.length === 0) return null;

  const colClass = 'px-2 py-1.5 text-sm max-w-[200px] truncate align-top border-r border-gray-200 cursor-pointer hover:bg-gray-50';
  const thClass = 'px-2 py-2 text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 bg-gray-50';

  const cellContent = (label: string, value: string) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          className="min-w-0 truncate w-full text-left"
          onClick={() => openContentViewer(label, value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openContentViewer(label, value);
            }
          }}
        >
          {value || '—'}
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-md max-h-64 overflow-auto whitespace-pre-wrap text-left"
      >
        {value || '—'}
      </TooltipContent>
    </Tooltip>
  );

  return (
    <>
      <TooltipProvider delayDuration={300}>
      <div className="rounded-md border border-gray-200 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className={thClass}>{t('productKnowledge.table.headers.solution', 'Solusi')}</TableHead>
              <TableHead className={thClass}>{t('productKnowledge.table.headers.targetMarket', 'Customer Persona')}</TableHead>
              <TableHead className={thClass}>{t('productKnowledge.table.headers.problem', 'Masalah')}</TableHead>
              <TableHead className={thClass}>{t('productKnowledge.table.headers.impact', 'Dampak')}</TableHead>
              <TableHead className={thClass}>{t('productKnowledge.table.headers.wants', 'Wants')}</TableHead>
              <TableHead className={thClass}>{t('productKnowledge.table.headers.needs', 'Needs')}</TableHead>
              <TableHead className={thClass}>{t('productKnowledge.table.headers.hiddenNeeds', 'Hidden Needs')}</TableHead>
              <TableHead className={thClass}>{t('productKnowledge.table.headers.falseBelief', 'False Belief')}</TableHead>
              <TableHead className={thClass}>{t('productKnowledge.table.headers.falseBeliefImpact', 'False Belief Impact')}</TableHead>
              <TableHead className={thClass}>{t('productKnowledge.table.headers.whatMakesThemStop', 'What Makes Them Stop?')}</TableHead>
              <TableHead className="px-2 py-2 text-xs font-semibold text-gray-700 uppercase bg-gray-50 w-[120px]">
                {t('productKnowledge.generate.seeDetail', 'See Detail')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={idx} className="border-b border-gray-200">
                <TableCell className={colClass}>
                  {cellContent(t('productKnowledge.table.headers.solution', 'Solusi'), row.solution)}
                </TableCell>
                <TableCell className={colClass}>
                  {cellContent(t('productKnowledge.table.headers.targetMarket', 'Customer Persona'), row.customerPersona)}
                </TableCell>
                <TableCell className={colClass}>
                  {cellContent(t('productKnowledge.table.headers.problem', 'Masalah'), row.problem)}
                </TableCell>
                <TableCell className={colClass}>
                  {cellContent(t('productKnowledge.table.headers.impact', 'Dampak'), row.impact)}
                </TableCell>
                <TableCell className={colClass}>
                  {cellContent(t('productKnowledge.table.headers.wants', 'Wants'), row.wants)}
                </TableCell>
                <TableCell className={colClass}>
                  {cellContent(t('productKnowledge.table.headers.needs', 'Needs'), row.needs)}
                </TableCell>
                <TableCell className={colClass}>
                  {cellContent(t('productKnowledge.table.headers.hiddenNeeds', 'Hidden Needs'), row.hiddenNeeds)}
                </TableCell>
                <TableCell className={colClass}>
                  {cellContent(t('productKnowledge.table.headers.falseBelief', 'False Belief'), row.falseBelief)}
                </TableCell>
                <TableCell className={colClass}>
                  {cellContent(t('productKnowledge.table.headers.falseBeliefImpact', 'False Belief Impact'), row.falseBeliefImpact)}
                </TableCell>
                <TableCell className={colClass}>
                  {cellContent(t('productKnowledge.table.headers.whatMakesThemStop', 'What Makes Them Stop?'), row.whatMakesThemStop)}
                </TableCell>
                <TableCell className="px-2 py-1.5 w-[120px]">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openDetailModal(row)}
                    className="gap-1.5"
                  >
                    <Eye className="h-4 w-4" />
                    {t('productKnowledge.generate.seeDetail', 'See Detail')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      </TooltipProvider>

      <Dialog open={contentViewer.open} onOpenChange={(open) => !open && setContentViewer((p) => ({ ...p, open: false }))}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">{contentViewer.title}</DialogTitle>
          </DialogHeader>
          <div className="mt-2 flex-1 min-h-0 overflow-auto rounded border bg-gray-50 p-3 text-sm whitespace-pre-wrap text-left">
            {contentViewer.content}
          </div>
          <DialogFooter className="flex-shrink-0 mt-4">
            <Button variant="outline" onClick={() => setContentViewer((p) => ({ ...p, open: false }))}>
              {t('common.close', 'Tutup')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail modal: square, seamless vertical scroll, then Cancel + Add to PK */}
      <Dialog open={Boolean(detailModalRow)} onOpenChange={(open) => !open && closeDetailModal()}>
        <DialogContent className="flex flex-col p-0 gap-0 w-[min(560px,85vmin)] h-[min(560px,85vmin)] max-w-[95vw] max-h-[85vh] overflow-hidden">
          <DialogHeader className="flex-shrink-0 px-4 pt-4 pb-2">
            <DialogTitle className="text-base">
              {t('productKnowledge.generate.detailTitle', 'Detail Hasil AI')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-2 seamless-scroll">
            {detailModalRow && (
              <div className="space-y-4 pr-2">
                <DetailSection
                  label={t('productKnowledge.table.headers.solution', 'Solusi')}
                  value={detailModalRow.solution}
                />
                <DetailSection
                  label={t('productKnowledge.table.headers.targetMarket', 'Customer Persona')}
                  value={detailModalRow.customerPersona}
                />
                <DetailSection
                  label={t('productKnowledge.table.headers.problem', 'Masalah')}
                  value={detailModalRow.problem}
                />
                <DetailSection
                  label={t('productKnowledge.table.headers.impact', 'Dampak')}
                  value={detailModalRow.impact}
                />
                <DetailSection
                  label={t('productKnowledge.table.headers.wants', 'Wants')}
                  value={detailModalRow.wants}
                />
                <DetailSection
                  label={t('productKnowledge.table.headers.needs', 'Needs')}
                  value={detailModalRow.needs}
                />
                <DetailSection
                  label={t('productKnowledge.table.headers.hiddenNeeds', 'Hidden Needs')}
                  value={detailModalRow.hiddenNeeds}
                />
                <DetailSection
                  label={t('productKnowledge.table.headers.falseBelief', 'False Belief')}
                  value={detailModalRow.falseBelief}
                />
                <DetailSection
                  label={t('productKnowledge.table.headers.falseBeliefImpact', 'False Belief Impact')}
                  value={detailModalRow.falseBeliefImpact}
                />
                <DetailSection
                  label={t('productKnowledge.table.headers.whatMakesThemStop', 'What Makes Them Stop?')}
                  value={detailModalRow.whatMakesThemStop}
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex-shrink-0 border-t border-gray-200 px-4 py-3 bg-gray-50 gap-2">
            <Button variant="outline" onClick={closeDetailModal}>
              {t('common.cancel', 'Batal')}
            </Button>
            <Button onClick={handleAddFromDetailModal} className="gap-1.5">
              <PlusCircle className="h-4 w-4" />
              {t('productKnowledge.generate.addToProductKnowledge', 'Add to Creative')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
