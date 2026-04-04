import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { MoreVertical, Plus, Edit, Trash2, Search, Bold, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, IndentIncrease, IndentDecrease } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { ProductKnowledge } from '../hooks/useProductKnowledge';
import type { ProductKnowledgeFeature } from '../hooks/useProductKnowledgeFeatures';
import { useProductKnowledgeFeaturesMutations } from '../hooks/useProductKnowledgeFeatures';
import type { Service } from '../hooks/useServices';

function formatCompetitiveAdvantage(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter(Boolean).join('\n\n');
  return String(value);
}

function parseCompetitiveAdvantage(value: string): any {
  if (!value || !value.trim()) return null;
  if (looksLikeHtml(value)) return value.trim();
  const lines = value.split(/\n\n+/).map((p) => p.replace(/\s+$/, '')).filter((p) => p.trim().length > 0);
  return lines.length > 0 ? lines : null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function toEditorHtml(value: string): string {
  if (!value.trim()) return '';
  if (looksLikeHtml(value)) return value;
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function normalizeRichText(value: string): string | null {
  const cleanValue = value.replace(/\u200B/g, '');
  const plain = cleanValue.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
  if (!plain) return null;
  return cleanValue.trim();
}

interface FeatureManagerProps {
  masterFeatures: ProductKnowledgeFeature[];
  allProductKnowledgeRows: ProductKnowledge[];
  services: Service[];
  onDataChange: () => void;
  onMasterFeatureUpdated?: (featureId: string, payload: { feature_name: string; feature_description: string | null; solution: string | null; competitive_advantage: unknown }) => void;
}

export const FeatureManager: React.FC<FeatureManagerProps> = ({
  masterFeatures,
  allProductKnowledgeRows = [],
  services = [],
  onDataChange,
  onMasterFeatureUpdated,
}) => {
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const { createFeature, updateFeature, deleteFeature, isCreating, isUpdating } = useProductKnowledgeFeaturesMutations();

  const [isOpen, setIsOpen] = useState(false);
  const [featureSearchTerm, setFeatureSearchTerm] = useState('');
  const [activeEditor, setActiveEditor] = useState<'feature_description' | 'solution' | 'competitive_advantage_raw' | null>(null);
  const featureDescriptionEditorRef = useRef<HTMLDivElement>(null);
  const solutionEditorRef = useRef<HTMLDivElement>(null);
  const competitiveAdvantageEditorRef = useRef<HTMLDivElement>(null);

  const filteredFeatures = useMemo(() => {
    const term = featureSearchTerm.trim().toLowerCase();
    if (!term) return masterFeatures;
    return masterFeatures.filter((f) => {
      const name = (f.feature_name || '').toLowerCase();
      const desc = (f.feature_description || '').toLowerCase();
      return name.includes(term) || desc.includes(term);
    });
  }, [masterFeatures, featureSearchTerm]);

  const [modalData, setModalData] = useState<{
    open: boolean;
    mode: 'add' | 'edit';
    item: ProductKnowledgeFeature | null;
    service_id: string | null;
    feature_name: string;
    feature_description: string;
    solution: string;
    competitive_advantage_raw: string;
  }>({
    open: false,
    mode: 'add',
    item: null,
    service_id: null,
    feature_name: '',
    feature_description: '',
    solution: '',
    competitive_advantage_raw: '',
  });

  const handleAdd = useCallback(() => {
    setModalData({
      open: true,
      mode: 'add',
      item: null,
      service_id: null,
      feature_name: '',
      feature_description: '',
      solution: '',
      competitive_advantage_raw: '',
    });
    setIsOpen(false);
  }, []);

  const handleEdit = useCallback((item: ProductKnowledgeFeature) => {
    setModalData({
      open: true,
      mode: 'edit',
      item,
      service_id: item.service_id ?? null,
      feature_name: item.feature_name || '',
      feature_description: item.feature_description || '',
      solution: item.solution || '',
      competitive_advantage_raw: formatCompetitiveAdvantage(item.competitive_advantage),
    });
    setIsOpen(false);
  }, []);

  const handleDelete = useCallback(
    async (item: ProductKnowledgeFeature) => {
      const refCount = allProductKnowledgeRows.filter((row) => row.feature_id === item.id).length;
      if (refCount > 0) {
        toast.error(
          t('productKnowledge.masterData.cannotDeleteFeatureInUse', 'This feature is used by {{count}} row(s). Cannot delete.', {
            count: refCount,
          })
        );
        setIsOpen(false);
        return;
      }
      const msg = t('productKnowledge.masterData.deleteFeatureConfirm', 'Are you sure you want to delete "{{name}}"?' , { name: item.feature_name || '' });
      if (window.confirm(msg)) {
        await deleteFeature(item.id);
        queryClient.invalidateQueries({ queryKey: ['product-knowledge-features'] });
        onDataChange();
      }
      setIsOpen(false);
    },
    [allProductKnowledgeRows, deleteFeature, queryClient, onDataChange, t]
  );

  const handleSave = useCallback(async () => {
    const { feature_name, feature_description, solution, competitive_advantage_raw, service_id } = modalData;
    if (!feature_name.trim()) {
      return;
    }
    if (modalData.mode === 'add' && !service_id) {
      toast.error(t('productKnowledge.masterData.selectServiceRequired', 'Pilih Service untuk feature baru.'));
      return;
    }
    const normalizedFeatureDescription = normalizeRichText(feature_description);
    const normalizedSolution = normalizeRichText(solution);
    const competitive_advantage = parseCompetitiveAdvantage(competitive_advantage_raw);

    if (modalData.mode === 'add') {
      await createFeature({
        service_id: service_id ?? null,
        feature_name: feature_name.trim(),
        feature_description: normalizedFeatureDescription,
        solution: normalizedSolution,
        competitive_advantage,
      });
    } else if (modalData.item) {
      await updateFeature({
        id: modalData.item.id,
        input: {
          service_id: service_id ?? null,
          feature_name: feature_name.trim(),
          feature_description: normalizedFeatureDescription,
          solution: normalizedSolution,
          competitive_advantage,
        },
      });
      // Sync ke tabel utama: update semua baris product_knowledge yang pakai feature ini
      onMasterFeatureUpdated?.(modalData.item.id, {
        feature_name: feature_name.trim(),
        feature_description: normalizedFeatureDescription,
        solution: normalizedSolution,
        competitive_advantage,
      });
    }
    queryClient.invalidateQueries({ queryKey: ['product-knowledge-features'] });
    onDataChange();
    setModalData((prev) => ({ ...prev, open: false }));
  }, [modalData, createFeature, updateFeature, queryClient, onDataChange, onMasterFeatureUpdated, t]);

  const handleCloseModal = useCallback(() => {
    setModalData((prev) => ({ ...prev, open: false }));
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) setFeatureSearchTerm('');
  }, []);

  useEffect(() => {
    if (!modalData.open || !featureDescriptionEditorRef.current) return;
    const nextHtml = toEditorHtml(modalData.feature_description);
    if (featureDescriptionEditorRef.current.innerHTML !== nextHtml) {
      featureDescriptionEditorRef.current.innerHTML = nextHtml;
    }
  }, [modalData.open, modalData.feature_description]);

  useEffect(() => {
    if (!modalData.open || !solutionEditorRef.current) return;
    const nextHtml = toEditorHtml(modalData.solution);
    if (solutionEditorRef.current.innerHTML !== nextHtml) {
      solutionEditorRef.current.innerHTML = nextHtml;
    }
  }, [modalData.open, modalData.solution]);

  useEffect(() => {
    if (!modalData.open || !competitiveAdvantageEditorRef.current) return;
    const nextHtml = toEditorHtml(modalData.competitive_advantage_raw);
    if (competitiveAdvantageEditorRef.current.innerHTML !== nextHtml) {
      competitiveAdvantageEditorRef.current.innerHTML = nextHtml;
    }
  }, [modalData.open, modalData.competitive_advantage_raw]);

  const applyFeatureDescriptionCommand = useCallback((command: string) => {
    if (!featureDescriptionEditorRef.current) return;
    featureDescriptionEditorRef.current.focus();
    document.execCommand(command, false);
    setModalData((prev) => ({
      ...prev,
      feature_description: featureDescriptionEditorRef.current?.innerHTML ?? prev.feature_description,
    }));
  }, []);

  const applySolutionCommand = useCallback((command: string) => {
    if (!solutionEditorRef.current) return;
    solutionEditorRef.current.focus();
    document.execCommand(command, false);
    setModalData((prev) => ({
      ...prev,
      solution: solutionEditorRef.current?.innerHTML ?? prev.solution,
    }));
  }, []);

  const applyCompetitiveAdvantageCommand = useCallback((command: string) => {
    if (!competitiveAdvantageEditorRef.current) return;
    competitiveAdvantageEditorRef.current.focus();
    document.execCommand(command, false);
    setModalData((prev) => ({
      ...prev,
      competitive_advantage_raw: competitiveAdvantageEditorRef.current?.innerHTML ?? prev.competitive_advantage_raw,
    }));
  }, []);

  const isFeatureDescriptionEmpty = useMemo(() => {
    return !normalizeRichText(modalData.feature_description);
  }, [modalData.feature_description]);

  const isSolutionEmpty = useMemo(() => {
    return !normalizeRichText(modalData.solution);
  }, [modalData.solution]);

  const isCompetitiveAdvantageEmpty = useMemo(() => {
    return !normalizeRichText(modalData.competitive_advantage_raw);
  }, [modalData.competitive_advantage_raw]);

  const renderRichTextToolbar = (
    editorKey: 'feature_description' | 'solution' | 'competitive_advantage_raw',
    onCommand: (command: string) => void
  ) => (
    <div className={`${activeEditor === editorKey ? 'sticky top-[-8px] z-20' : 'relative'} flex flex-wrap items-center gap-1 border-b px-2 py-1 bg-gray-50`}>
      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onMouseDown={(e) => e.preventDefault()} onClick={() => onCommand('bold')} title={t('productKnowledge.masterData.toolbar.bold', 'Bold')}>
        <Bold className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onMouseDown={(e) => e.preventDefault()} onClick={() => onCommand('insertOrderedList')} title={t('productKnowledge.masterData.toolbar.numberedList', 'Numbering')}>
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onMouseDown={(e) => e.preventDefault()} onClick={() => onCommand('insertUnorderedList')} title={t('productKnowledge.masterData.toolbar.bulletList', 'Bullet list')}>
        <List className="h-4 w-4" />
      </Button>
      <div className="mx-1 h-5 w-px bg-gray-300" />
      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onMouseDown={(e) => e.preventDefault()} onClick={() => onCommand('justifyLeft')} title={t('productKnowledge.masterData.toolbar.alignLeft', 'Align left')}>
        <AlignLeft className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onMouseDown={(e) => e.preventDefault()} onClick={() => onCommand('justifyCenter')} title={t('productKnowledge.masterData.toolbar.alignCenter', 'Align center')}>
        <AlignCenter className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onMouseDown={(e) => e.preventDefault()} onClick={() => onCommand('justifyRight')} title={t('productKnowledge.masterData.toolbar.alignRight', 'Align right')}>
        <AlignRight className="h-4 w-4" />
      </Button>
      <div className="mx-1 h-5 w-px bg-gray-300" />
      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onMouseDown={(e) => e.preventDefault()} onClick={() => onCommand('outdent')} title={t('productKnowledge.masterData.toolbar.outdent', 'Decrease indent')}>
        <IndentDecrease className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onMouseDown={(e) => e.preventDefault()} onClick={() => onCommand('indent')} title={t('productKnowledge.masterData.toolbar.indent', 'Increase indent')}>
        <IndentIncrease className="h-4 w-4" />
      </Button>
    </div>
  );

  const handleRichTextKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const anchorNode = selection.anchorNode;
    if (!anchorNode) return;

    const anchorElement =
      anchorNode.nodeType === Node.ELEMENT_NODE
        ? (anchorNode as HTMLElement)
        : (anchorNode.parentElement as HTMLElement | null);

    if (!anchorElement) return;

    const currentListItem = anchorElement.closest('li');
    if (!currentListItem) return;

    const isEmptyListItem = currentListItem.textContent?.replace(/\u00a0/g, ' ').trim() === '';
    if (!isEmptyListItem) return;

    const currentList = currentListItem.parentElement;
    const parentListItem = currentList?.parentElement?.closest('li');
    if (!currentList || !parentListItem) return;

    const parentList = parentListItem.parentElement;
    if (!parentList) return;

    // On second Enter at an empty nested list item:
    // - if parent list is numbered (OL), continue to next number item
    // - otherwise fallback to default outdent behavior
    event.preventDefault();

    const isParentOrderedList = parentList.tagName.toLowerCase() === 'ol';
    if (!isParentOrderedList) {
      document.execCommand('outdent', false);
      return;
    }

    const newListItem = document.createElement('li');
    const placeholder = document.createTextNode('\u200B');
    newListItem.appendChild(placeholder);
    parentList.insertBefore(newListItem, parentListItem.nextSibling);

    // Remove the empty nested item, and remove nested list container if it becomes empty.
    currentListItem.remove();
    if (currentList.children.length === 0) {
      currentList.remove();
    }

    const range = document.createRange();
    range.setStart(placeholder, 1);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const loading = isCreating || isUpdating;

  const handleRichTextInput = useCallback(
    (key: 'feature_description' | 'solution' | 'competitive_advantage_raw', html: string) => {
      const cleanedHtml = html.replace(/\u200B/g, '');
      setModalData((prev) => ({ ...prev, [key]: cleanedHtml }));
    },
    []
  );

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-gray-100">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 max-h-80 bg-white border shadow-lg z-[1000001] p-0 flex flex-col">
          <div className="sticky top-0 bg-white z-10 border-b">
            <DropdownMenuItem onClick={handleAdd} className="cursor-pointer">
              <Plus className="mr-2 h-4 w-4" />
              {t('productKnowledge.masterData.addFeature', 'Add Feature')}
            </DropdownMenuItem>
            {masterFeatures.length > 0 && (
              <div className="px-2 pb-2" onClick={(e) => e.stopPropagation()}>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    type="text"
                    value={featureSearchTerm}
                    onChange={(e) => setFeatureSearchTerm(e.target.value)}
                    placeholder={t('productKnowledge.masterData.searchFeaturePlaceholder', 'Cari feature...')}
                    className="h-8 pl-7 pr-2 text-xs border-gray-200"
                    autoComplete="off"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="overflow-y-auto seamless-scroll max-h-[14rem]">
            {filteredFeatures.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1 text-xs font-medium text-gray-500">Features</div>
                {filteredFeatures.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-2 py-1 hover:bg-gray-50">
                    <span className="text-sm truncate flex-1 mr-2">{item.feature_name || '-'}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-blue-100"
                        onClick={() => handleEdit(item)}
                        title={t('productKnowledge.masterData.editFeature', 'Edit')}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-red-100"
                        onClick={() => handleDelete(item)}
                        title={t('productKnowledge.masterData.deleteFeature', 'Delete')}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </>
            )}
            {filteredFeatures.length === 0 && (
              <div className="px-2 py-2 text-xs text-gray-500 text-center italic">
                {masterFeatures.length === 0
                  ? t('productKnowledge.masterData.noFeaturesYet', 'No features yet')
                  : t('productKnowledge.masterData.noMatchingFeatures', 'Tidak ada feature yang cocok')}
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {modalData.open &&
        createPortal(
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-lg flex flex-col shadow-2xl w-[min(36rem,90vw)] h-[min(36rem,90vh)] max-h-[90vh] overflow-hidden">
              <h3 className="text-lg font-semibold flex-shrink-0 px-6 pt-6 pb-2">
                {modalData.mode === 'add'
                  ? t('productKnowledge.masterData.addFeature', 'Add Feature')
                  : t('productKnowledge.masterData.editFeature', 'Edit Feature')}
              </h3>
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain px-6 py-2">
                <div className="space-y-4 pb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {t('productKnowledge.masterData.service', 'Service')} *
                    </label>
                    <Select
                      value={modalData.service_id ?? 'placeholder'}
                      onValueChange={(value) =>
                        setModalData((prev) => ({ ...prev, service_id: value === 'placeholder' ? null : value }))
                      }
                    >
                      <SelectTrigger className="w-full h-9 text-sm border rounded">
                        <SelectValue placeholder={t('productKnowledge.masterData.selectService', 'Pilih Service')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="placeholder" disabled>
                          {t('productKnowledge.masterData.selectService', 'Pilih Service')}
                        </SelectItem>
                        {services.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('productKnowledge.masterData.serviceFeatureHint', 'Feature hanya muncul di baris yang memilih Service ini.')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {t('productKnowledge.masterData.featureName', 'Feature name')} *
                    </label>
                    <input
                      type="text"
                      value={modalData.feature_name}
                      onChange={(e) => setModalData((prev) => ({ ...prev, feature_name: e.target.value }))}
                      className="w-full p-2 border rounded text-sm"
                      placeholder={t('productKnowledge.masterData.featureNamePlaceholder', 'Enter feature name')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {t('productKnowledge.masterData.featureDescription', 'Feature description')}
                    </label>
                    <div className="border rounded-md bg-white">
                      {renderRichTextToolbar('feature_description', applyFeatureDescriptionCommand)}
                      <div className="relative">
                        {isFeatureDescriptionEmpty && (
                          <span className="pointer-events-none absolute left-3 top-2 text-sm text-gray-400">
                            {t('productKnowledge.masterData.featureDescriptionPlaceholder', 'Enter feature description')}
                          </span>
                        )}
                        <div
                          ref={featureDescriptionEditorRef}
                          contentEditable
                          suppressContentEditableWarning
                          spellCheck={false}
                          data-gramm="false"
                          data-gramm_editor="false"
                          data-enable-grammarly="false"
                          onFocus={() => setActiveEditor('feature_description')}
                          onBlur={() => setActiveEditor((prev) => (prev === 'feature_description' ? null : prev))}
                          onInput={(e) => {
                            const html = (e.currentTarget as HTMLDivElement).innerHTML;
                            handleRichTextInput('feature_description', html);
                          }}
                          onKeyDown={handleRichTextKeyDown}
                          className="min-h-[7rem] w-full p-2 text-sm outline-none [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {t('productKnowledge.masterData.solution', 'Solution')}
                    </label>
                    <div className="border rounded-md bg-white">
                      {renderRichTextToolbar('solution', applySolutionCommand)}
                      <div className="relative">
                        {isSolutionEmpty && (
                          <span className="pointer-events-none absolute left-3 top-2 text-sm text-gray-400">
                            {t('productKnowledge.masterData.solutionPlaceholder', 'Enter solution')}
                          </span>
                        )}
                        <div
                          ref={solutionEditorRef}
                          contentEditable
                          suppressContentEditableWarning
                          spellCheck={false}
                          data-gramm="false"
                          data-gramm_editor="false"
                          data-enable-grammarly="false"
                          onFocus={() => setActiveEditor('solution')}
                          onBlur={() => setActiveEditor((prev) => (prev === 'solution' ? null : prev))}
                          onInput={(e) => {
                            const html = (e.currentTarget as HTMLDivElement).innerHTML;
                            handleRichTextInput('solution', html);
                          }}
                          onKeyDown={handleRichTextKeyDown}
                          className="min-h-[7rem] w-full p-2 text-sm outline-none [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {t('productKnowledge.masterData.competitiveAdvantage', 'Competitive advantage')}
                    </label>
                    <div className="border rounded-md bg-white">
                      {renderRichTextToolbar('competitive_advantage_raw', applyCompetitiveAdvantageCommand)}
                      <div className="relative">
                        {isCompetitiveAdvantageEmpty && (
                          <span className="pointer-events-none absolute left-3 top-2 text-sm text-gray-400">
                            {t('productKnowledge.masterData.competitiveAdvantagePlaceholder', 'One per line or paragraph')}
                          </span>
                        )}
                        <div
                          ref={competitiveAdvantageEditorRef}
                          contentEditable
                          suppressContentEditableWarning
                          spellCheck={false}
                          data-gramm="false"
                          data-gramm_editor="false"
                          data-enable-grammarly="false"
                          onFocus={() => setActiveEditor('competitive_advantage_raw')}
                          onBlur={() => setActiveEditor((prev) => (prev === 'competitive_advantage_raw' ? null : prev))}
                          onInput={(e) => {
                            const html = (e.currentTarget as HTMLDivElement).innerHTML;
                            handleRichTextInput('competitive_advantage_raw', html);
                          }}
                          onKeyDown={handleRichTextKeyDown}
                          className="min-h-[7rem] w-full p-2 text-sm outline-none [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50/80">
                <Button variant="outline" onClick={handleCloseModal} disabled={loading}>
                  {t('productKnowledge.masterData.cancel', 'Cancel')}
                </Button>
                <Button onClick={handleSave} disabled={loading || !modalData.feature_name.trim() || (modalData.mode === 'add' && !modalData.service_id)}>
                  {loading ? t('productKnowledge.masterData.saving', 'Saving...') : t('productKnowledge.masterData.save', 'Save')}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
