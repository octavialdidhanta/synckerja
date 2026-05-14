import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Table2, ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import type {
  ScriptBreakdownTableTemplateRow,
  ScriptBreakdownTableColumnInput,
  ScriptBreakdownFillRule,
  ScriptBreakdownKeywordHint,
} from '../hooks/useScriptBreakdownTableTemplates';
import { cn } from '@/shared/lib/utils';

interface ScriptBreakdownTableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { name: string; is_default: boolean; columns: ScriptBreakdownTableColumnInput[] }) => Promise<void>;
  isLoading?: boolean;
  initialData?: ScriptBreakdownTableTemplateRow | null;
}

const emptyColumn = (): ScriptBreakdownTableColumnInput => ({
  header_label: '',
  placeholder_example: '',
  detail_body: '',
  fill_rule: 'strict',
  keyword_hint: 'none',
});

export const ScriptBreakdownTableModal: React.FC<ScriptBreakdownTableModalProps> = ({
  open,
  onOpenChange,
  onSave,
  isLoading = false,
  initialData = null,
}) => {
  const { t } = useAppTranslation();
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [columns, setColumns] = useState<ScriptBreakdownTableColumnInput[]>([emptyColumn()]);

  useEffect(() => {
    if (!open) {
      setName('');
      setIsDefault(false);
      setColumns([emptyColumn()]);
      return;
    }
    if (initialData) {
      setName(initialData.name || '');
      setIsDefault(initialData.is_default ?? false);
      const cols = initialData.script_breakdown_table_columns || [];
      if (cols.length === 0) {
        setColumns([emptyColumn()]);
      } else {
        setColumns(
          cols.map((c) => ({
            header_label: c.header_label || '',
            placeholder_example: c.placeholder_example ?? '',
            detail_body: c.detail_body ?? '',
            fill_rule: c.fill_rule,
            keyword_hint: c.keyword_hint,
          })),
        );
      }
    } else {
      setName('');
      setIsDefault(false);
      setColumns([emptyColumn()]);
    }
  }, [open, initialData]);

  const moveColumn = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= columns.length) return;
    setColumns((prev) => {
      const copy = [...prev];
      const tmp = copy[index];
      copy[index] = copy[next];
      copy[next] = tmp;
      return copy;
    });
  };

  const removeColumn = (index: number) => {
    setColumns((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const updateColumn = (index: number, patch: Partial<ScriptBreakdownTableColumnInput>) => {
    setColumns((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = (name || '').trim();
    if (!trimmedName) return;

    const normalized = columns
      .map((c) => ({
        header_label: (c.header_label || '').trim(),
        placeholder_example: (c.placeholder_example || '').trim() || null,
        detail_body: (c.detail_body || '').trim() || null,
        fill_rule: c.fill_rule,
        keyword_hint: c.keyword_hint,
      }))
      .filter((c) => c.header_label !== '');

    if (normalized.length === 0) return;

    await onSave({
      name: trimmedName,
      is_default: isDefault,
      columns: normalized,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden sm:max-w-[640px]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Table2 className="h-5 w-5 text-gray-700" />
            {initialData
              ? t('productKnowledge.scriptTable.modal.editTitle', 'Edit table template')
              : t('productKnowledge.scriptTable.modal.title', 'New table template')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'productKnowledge.scriptTable.modal.description',
              'Define columns for the script breakdown markdown table used in Script Generator.',
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="scrollbar-hide min-h-0 flex-1 space-y-4 overflow-y-auto py-4 pr-1">
            <div className="space-y-2">
              <Label htmlFor="sbt-name">{t('productKnowledge.scriptTable.modal.nameLabel', 'Template name')} *</Label>
              <Input
                id="sbt-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('productKnowledge.scriptTable.modal.namePlaceholder', 'e.g. Story Reel 10 columns')}
                disabled={isLoading}
                required
                maxLength={120}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="sbt-default"
                checked={isDefault}
                onCheckedChange={(v) => setIsDefault(v === true)}
                disabled={isLoading}
              />
              <Label htmlFor="sbt-default" className="text-sm font-normal cursor-pointer">
                {t('productKnowledge.scriptTable.modal.defaultLabel', 'Mark as default (informational)')}
              </Label>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
              <Label className="text-sm font-semibold">
                {t('productKnowledge.scriptTable.modal.columnsLabel', 'Columns')}
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                disabled={isLoading}
                onClick={() => setColumns((prev) => [...prev, emptyColumn()])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                {t('productKnowledge.scriptTable.modal.addColumn', 'Add column')}
              </Button>
            </div>

            <div className="space-y-3">
              {columns.map((col, index) => (
                <div
                  key={index}
                  className={cn('rounded-lg border border-gray-200 bg-gray-50/80 p-3 space-y-2', isLoading && 'opacity-60')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('productKnowledge.scriptTable.modal.columnN', 'Column {{n}}', { n: index + 1 })}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={isLoading || index === 0}
                        onClick={() => moveColumn(index, -1)}
                        title={t('productKnowledge.scriptTable.modal.moveUp', 'Move up')}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={isLoading || index === columns.length - 1}
                        onClick={() => moveColumn(index, 1)}
                        title={t('productKnowledge.scriptTable.modal.moveDown', 'Move down')}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                        disabled={isLoading || columns.length <= 1}
                        onClick={() => removeColumn(index)}
                        title={t('productKnowledge.scriptTable.modal.removeColumn', 'Remove')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">{t('productKnowledge.scriptTable.modal.headerLabel', 'Header')}</Label>
                      <Input
                        value={col.header_label}
                        onChange={(e) => updateColumn(index, { header_label: e.target.value })}
                        disabled={isLoading}
                        placeholder="Timing"
                        maxLength={80}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">
                        {t('productKnowledge.scriptTable.modal.placeholderLabel', 'Example cell (first row)')}
                      </Label>
                      <Input
                        value={col.placeholder_example ?? ''}
                        onChange={(e) => updateColumn(index, { placeholder_example: e.target.value })}
                        disabled={isLoading}
                        placeholder="0-3s"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('productKnowledge.scriptTable.modal.fillRule', 'Fill rule')}</Label>
                      <Select
                        value={col.fill_rule}
                        onValueChange={(v) =>
                          updateColumn(index, { fill_rule: v as ScriptBreakdownFillRule })
                        }
                        disabled={isLoading}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="strict">
                            {t('productKnowledge.scriptTable.modal.fillStrict', 'Strict (no empty cells)')}
                          </SelectItem>
                          <SelectItem value="honest_empty">
                            {t('productKnowledge.scriptTable.modal.fillHonest', 'Honest empty phrase allowed')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('productKnowledge.scriptTable.modal.keywordHint', 'Keyword hint')}</Label>
                      <Select
                        value={col.keyword_hint}
                        onValueChange={(v) =>
                          updateColumn(index, { keyword_hint: v as ScriptBreakdownKeywordHint })
                        }
                        disabled={isLoading}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('productKnowledge.scriptTable.modal.kwNone', 'None')}</SelectItem>
                          <SelectItem value="narasi">{t('productKnowledge.scriptTable.modal.kwNarasi', 'Narasi')}</SelectItem>
                          <SelectItem value="visual">{t('productKnowledge.scriptTable.modal.kwVisual', 'Visual')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">
                        {t('productKnowledge.scriptTable.modal.detailLabel', 'Detail (under ## Detail kolom ##)')}
                      </Label>
                      <Textarea
                        value={col.detail_body ?? ''}
                        onChange={(e) => updateColumn(index, { detail_body: e.target.value })}
                        disabled={isLoading}
                        rows={3}
                        className="min-h-[72px] resize-y"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 border-t border-gray-100 pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {initialData
                ? t('productKnowledge.scriptTable.modal.save', 'Save')
                : t('productKnowledge.scriptTable.modal.create', 'Create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
