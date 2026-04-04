import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Textarea } from '@/shared/components/ui/textarea';
import { Button } from '@/shared/components/ui/button';
import { ProductKnowledge } from '../hooks/useProductKnowledge';
import type { ProductKnowledgeFeature } from '../hooks/useProductKnowledgeFeatures';
import { LoadingDots } from '@/shared/components/LoadingDots';
import { Service } from '../hooks/useServices';
import { SubService } from '../hooks/useSubServices';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { FileText, Eye } from 'lucide-react';

/** Returns true if row has Feature, Feature Description, and at least one persona/content field filled */
function isRowFullyFilled(item: ProductKnowledge): boolean {
  const hasBase = !!(item.feature_name?.trim() && item.feature_description?.trim());
  if (!hasBase) return false;
  const hasPersona =
    (item.target_audience != null && (typeof item.target_audience === 'string' ? item.target_audience.trim() !== '' : true)) ||
    (item.problems_solved?.length ?? 0) > 0 ||
    !!(item.impact?.trim()) ||
    !!(item.wants?.trim()) ||
    !!(item.needs?.trim()) ||
    !!(item.hidden_needs?.trim()) ||
    !!(item.false_belief?.trim()) ||
    !!(item.false_belief_impact?.trim()) ||
    !!(item.what_makes_them_stop?.trim());
  return hasPersona;
}

function stripHtml(value: string): string {
  if (!value) return '';
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

interface ProductKnowledgeTableProps {
  data: ProductKnowledge[];
  isLoading?: boolean;
  selectedItems: string[];
  onSelectItem: (id: string, checked: boolean) => void;
  onFieldChange: (id: string, field: string, value: any) => void;
  onFeatureSelect: (id: string, master: ProductKnowledgeFeature | null) => void;
  onGeneratePromptForRow?: (rowId: string) => void;
  services: Service[];
  subServices: SubService[];
  masterFeatures: ProductKnowledgeFeature[];
}

export const ProductKnowledgeTable: React.FC<ProductKnowledgeTableProps> = ({
  data,
  isLoading = false,
  selectedItems,
  onSelectItem,
  onFieldChange,
  onFeatureSelect,
  onGeneratePromptForRow,
  services = [],
  subServices = [],
  masterFeatures = [],
}) => {
  const { t } = useAppTranslation();

  // Format problems array to display
  const formatProblems = (problems: string[] | null | undefined): string => {
    if (!problems || problems.length === 0) return '';
    // Format dengan newline dan baris kosong di antara setiap masalah untuk pemisahan visual
    // Pertahankan spasi di tengah baris
    return problems.filter(Boolean).join('\n\n');
  };

  // Get Product/Service name
  const getProductServiceName = (item: ProductKnowledge): string => {
    if (item.sub_service_name) {
      return `${item.service_name || 'N/A'} / ${item.sub_service_name}`;
    }
    if (item.service_name) {
      return item.service_name;
    }
    return '';
  };

  return (
    <div className="w-full max-w-full">
      <div className="rounded-md border border-gray-200">
        {/* Horizontal scroll only; vertical scroll is the page-level seamless container */}
        <div className="overflow-x-auto overflow-y-clip seamless-scroll nested-scroll-touch-chain">
          <table className="border-collapse" style={{ minWidth: onGeneratePromptForRow ? '4088px' : '3888px', width: '100%' }}>
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px' }} className="px-2 py-2 text-center border-r border-gray-200 border-b-2 border-gray-300">
                  <Checkbox 
                    checked={data.length > 0 && data.every((item) => selectedItems.includes(item.id))}
                    onCheckedChange={(checked) => {
                      if (data.length > 0) {
                        data.forEach((item) => onSelectItem(item.id, !!checked));
                      }
                    }}
                  />
                </th>
                <th style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }} className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 border-b-2 border-gray-300">
                  {t('productKnowledge.table.headers.productService', 'Product/Service')}
                </th>
                <th style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }} className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 border-b-2 border-gray-300">
                  {t('productKnowledge.table.headers.subService', 'Sub Service')}
                </th>
                <th style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }} className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 border-b-2 border-gray-300">
                  {t('productKnowledge.table.headers.feature', 'Feature')}
                </th>
                <th style={{ width: '200px', minWidth: '200px', maxWidth: '200px' }} className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 border-b-2 border-gray-300">
                  {t('productKnowledge.table.headers.featureDescription', 'Feature Description')}
                </th>
                <th style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }} className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 border-b-2 border-gray-300">
                  {t('productKnowledge.table.headers.solution', 'Solution')}
                </th>
                <th style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }} className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 border-b-2 border-gray-300">
                  {t('productKnowledge.table.headers.competitiveAdvantage', 'Competitive Advantage')}
                </th>
                <th style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }} className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 border-b-2 border-gray-300">
                  {t('productKnowledge.table.headers.targetMarket', 'Customer Persona')}
                </th>
                <th style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }} className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 border-b-2 border-gray-300">
                  {t('productKnowledge.table.headers.problem', 'Problem')}
                </th>
                <th style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }} className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 border-b-2 border-gray-300">
                  {t('productKnowledge.table.headers.impact', 'Impact')}
                </th>
                <th style={{ width: '200px', minWidth: '200px', maxWidth: '200px' }} className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 border-b-2 border-gray-300">
                  {t('productKnowledge.table.headers.wants', 'Wants')}
                </th>
                <th style={{ width: '200px', minWidth: '200px', maxWidth: '200px' }} className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 border-b-2 border-gray-300">
                  {t('productKnowledge.table.headers.needs', 'Needs')}
                </th>
                <th style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }} className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 border-b-2 border-gray-300">
                  {t('productKnowledge.table.headers.hiddenNeeds', 'Hidden Needs')}
                </th>
                <th style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }} className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 border-b-2 border-gray-300">
                  {t('productKnowledge.table.headers.falseBelief', 'False Belief')}
                </th>
                <th style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }} className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 border-b-2 border-gray-300">
                  {t('productKnowledge.table.headers.falseBeliefImpact', 'False Belief Impact')}
                </th>
                <th style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }} className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase border-b-2 border-gray-300">
                  {t('productKnowledge.table.headers.whatMakesThemStop', 'What Makes Them Stop?')}
                </th>
                {onGeneratePromptForRow && (
                  <th style={{ width: '200px', minWidth: '200px', maxWidth: '200px' }} className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase border-b-2 border-gray-300 bg-gray-50">
                    {t('productKnowledge.table.actions', 'Aksi')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={onGeneratePromptForRow ? 17 : 16} className="text-center py-8 border-b border-gray-200">
                    <LoadingDots />
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={onGeneratePromptForRow ? 17 : 16} className="text-center py-8 border-b border-gray-200">
                    <p className="text-gray-500 text-sm">{t('productKnowledge.table.emptyState', 'No product knowledge found')}</p>
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <ProductKnowledgeRow
                    key={item.id}
                    item={item}
                    isSelected={selectedItems.includes(item.id)}
                    onSelectItem={onSelectItem}
                    onFieldChange={onFieldChange}
                    onFeatureSelect={onFeatureSelect}
                    onGeneratePromptForRow={onGeneratePromptForRow}
                    getProductServiceName={getProductServiceName}
                    formatProblems={formatProblems}
                    services={services}
                    subServices={subServices}
                    allProductKnowledge={data}
                    masterFeatures={masterFeatures}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface ProductKnowledgeRowProps {
  item: ProductKnowledge;
  isSelected: boolean;
  onSelectItem: (id: string, checked: boolean) => void;
  onFieldChange: (id: string, field: string, value: any) => void;
  onFeatureSelect: (id: string, master: ProductKnowledgeFeature | null) => void;
  onGeneratePromptForRow?: (rowId: string) => void;
  getProductServiceName: (item: ProductKnowledge) => string;
  formatProblems: (problems: string[] | null | undefined) => string;
  services: Service[];
  subServices: SubService[];
  allProductKnowledge: ProductKnowledge[];
  masterFeatures: ProductKnowledgeFeature[];
}

function MainTableDetailSection({ label, value, isRichText = false }: { label: string; value: string; isRichText?: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-primary/20 bg-white shadow-sm">
      <div className="border-b border-primary/25 bg-primary px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary-foreground">{label}</span>
      </div>
      <div className="text-sm text-gray-900 whitespace-pre-wrap p-3 min-h-[2.5rem]">
        {isRichText && looksLikeHtml(value) ? (
          <div
            className="[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_p]:mb-2"
            dangerouslySetInnerHTML={{ __html: value }}
          />
        ) : (
          value || '—'
        )}
      </div>
    </div>
  );
}

const ProductKnowledgeRow: React.FC<ProductKnowledgeRowProps> = ({
  item,
  isSelected,
  onSelectItem,
  onFieldChange,
  onFeatureSelect,
  onGeneratePromptForRow,
  getProductServiceName,
  formatProblems,
  services,
  subServices,
  allProductKnowledge,
  masterFeatures,
}) => {
  const { t } = useAppTranslation();
  const isFeatureSelected = !!(item.feature_id || item.feature_name);
  const [isEditingTargetMarket, setIsEditingTargetMarket] = useState(false);
  const [isEditingProblems, setIsEditingProblems] = useState(false);
  const [isEditingImpact, setIsEditingImpact] = useState(false);
  const [isEditingWants, setIsEditingWants] = useState(false);
  const [isEditingNeeds, setIsEditingNeeds] = useState(false);
  const [isEditingHiddenNeeds, setIsEditingHiddenNeeds] = useState(false);
  const [isEditingFalseBelief, setIsEditingFalseBelief] = useState(false);
  const [isEditingFalseBeliefImpact, setIsEditingFalseBeliefImpact] = useState(false);
  const [isEditingWhatMakesThemStop, setIsEditingWhatMakesThemStop] = useState(false);
  
  // Popup state untuk view dan edit konten lengkap (readOnly = hanya baca untuk Feature, Feature Description, Solution, Competitive Advantage)
  const [popupState, setPopupState] = useState<{
    isOpen: boolean;
    field: string | null;
    title: string;
    content: string;
    editedContent: string;
    readOnly?: boolean;
    isHtml?: boolean;
  }>({
    isOpen: false,
    field: null,
    title: '',
    content: '',
    editedContent: '',
    readOnly: false,
    isHtml: false,
  });

  const READ_ONLY_POPUP_FIELDS = ['feature', 'featureDescription', 'solution', 'competitiveAdvantage'];
  const [rowDetailOpen, setRowDetailOpen] = useState(false);

  const handleCheckboxChange = (checked: boolean) => {
    onSelectItem(item.id, checked);
  };

  // Helper function untuk membuka popup view/edit (readOnly untuk Feature, Feature Description, Solution, Competitive Advantage)
  const openViewPopup = (field: string, title: string, content: string, readOnly?: boolean, isHtml?: boolean) => {
    const isReadOnly = readOnly ?? READ_ONLY_POPUP_FIELDS.includes(field);
    // Format content berdasarkan field type
    let formattedContent = '';
    
    if (field === 'problems') {
      formattedContent = formatProblems(item.problems_solved);
    } else if (field === 'competitiveAdvantage') {
      formattedContent = formatCompetitiveAdvantage(item.competitive_advantage);
    } else if (field === 'targetMarket') {
      formattedContent = formatTargetMarket(item.target_audience);
    } else {
      formattedContent = content || '';
    }
    
    setPopupState({
      isOpen: true,
      field,
      title,
      content: formattedContent,
      editedContent: formattedContent,
      readOnly: isReadOnly,
      isHtml: isHtml ?? field === 'featureDescription',
    });
  };

  // Format content untuk display di popup dengan paragraf
  const formatContentForPopup = (content: string): string => {
    if (!content || content.trim() === '') return '';
    // Jika content mengandung double newline, split menjadi paragraf
    if (content.includes('\n\n')) {
      return content.split(/\n\n+/).filter(Boolean).join('\n\n');
    }
    return content;
  };

  // Handler untuk save dari popup (tidak dipanggil saat readOnly)
  const handlePopupSave = () => {
    if (!popupState.field || popupState.readOnly) return;

    const field = popupState.field;
    const newValue = popupState.editedContent.trim();

    // Panggil handler yang sesuai berdasarkan field
    switch (field) {
      case 'targetMarket':
        handleTargetMarketBlur(newValue);
        break;
      case 'problems':
        handleProblemsBlur(newValue);
        break;
      case 'impact':
        handleImpactBlur(newValue);
        break;
      case 'wants':
        handleWantsBlur(newValue);
        break;
      case 'needs':
        handleNeedsBlur(newValue);
        break;
      case 'hiddenNeeds':
        handleHiddenNeedsBlur(newValue);
        break;
      case 'falseBelief':
        handleFalseBeliefBlur(newValue);
        break;
      case 'falseBeliefImpact':
        handleFalseBeliefImpactBlur(newValue);
        break;
      case 'whatMakesThemStop':
        handleWhatMakesThemStopBlur(newValue);
        break;
      case 'solution':
        handleSolutionBlur(newValue);
        break;
      case 'feature':
        handleFeatureNameBlur(newValue);
        break;
      case 'featureDescription':
        handleFeatureDescriptionBlur(newValue);
        break;
      case 'competitiveAdvantage':
        handleCompetitiveAdvantageBlur(newValue);
        break;
    }

    setPopupState({ ...popupState, isOpen: false });
  };

  // Handler untuk cancel dari popup
  const handlePopupCancel = () => {
    setPopupState({ ...popupState, isOpen: false, editedContent: popupState.content });
  };

  const handleFeatureNameBlur = (value: string) => {
    if (value !== item.feature_name) {
      onFieldChange(item.id, 'feature_name', value);
    }
  };

  const handleFeatureDescriptionBlur = (value: string) => {
    if (value !== item.feature_description) {
      onFieldChange(item.id, 'feature_description', value);
    }
  };

  // Format target_audience (JSONB) to string
  const formatTargetMarket = (targetAudience: any): string => {
    if (!targetAudience) return '';
    if (typeof targetAudience === 'string') return targetAudience;
    if (typeof targetAudience === 'object') {
      return JSON.stringify(targetAudience);
    }
    return String(targetAudience);
  };

  // Parse target market string to JSONB
  const parseTargetMarket = (value: string): any => {
    if (!value || value.trim() === '') return null;
    try {
      return JSON.parse(value);
    } catch {
      // If not valid JSON, return as string
      return value;
    }
  };

  // Helper function to normalize target_audience for comparison
  const normalizeTargetAudience = (targetAudience: any): string => {
    if (!targetAudience) return '';
    if (typeof targetAudience === 'string') return targetAudience.trim().toLowerCase();
    if (typeof targetAudience === 'object') {
      try {
        return JSON.stringify(targetAudience).toLowerCase();
      } catch {
        return String(targetAudience).toLowerCase();
      }
    }
    return String(targetAudience).toLowerCase();
  };

  const handleTargetMarketBlur = (value: string) => {
    const parsed = parseTargetMarket(value);
    const normalizedNewValue = normalizeTargetAudience(parsed);
    
    // Check for duplicates (excluding current item)
    const hasDuplicate = allProductKnowledge.some((pk) => {
      if (pk.id === item.id) return false; // Skip current item
      const normalizedExisting = normalizeTargetAudience(pk.target_audience);
      return normalizedExisting !== '' && normalizedExisting === normalizedNewValue;
    });
    
    if (hasDuplicate) {
      alert('Target Market (Customer Persona) ini sudah digunakan di baris lain. Harap gunakan nilai yang berbeda untuk memastikan setiap Customer Persona unik.');
      setIsEditingTargetMarket(false);
      return;
    }
    
    if (JSON.stringify(parsed) !== JSON.stringify(item.target_audience)) {
      onFieldChange(item.id, 'target_audience', parsed);
    }
    setIsEditingTargetMarket(false);
  };

  const handleProblemsBlur = (value: string) => {
    // Parse string dengan double newline (\n\n) sebagai pemisah utama antar masalah
    // Jika tidak ada double newline, gunakan single newline sebagai fallback
    // Pertahankan spasi di dalam setiap baris, termasuk indentasi di awal
    // Hanya hapus trailing whitespace (spasi di akhir baris)
    
    let problemsArray: string[] = [];
    
    // Coba split berdasarkan double newline terlebih dahulu
    if (value.includes('\n\n')) {
      problemsArray = value
        .split(/\n\n+/)
        .map(p => p.replace(/\s+$/, '')) // Hapus trailing whitespace saja
        .filter(p => p.trim().length > 0); // Hanya filter yang benar-benar kosong
    } else {
      // Fallback: split berdasarkan single newline dan kelompokkan
      // Baris kosong bertindak sebagai pemisah
      const lines = value.split(/\n/).map(p => p.replace(/\s+$/, ''));
      let currentProblem: string[] = [];
      
      for (const line of lines) {
        if (line.trim().length > 0) {
          currentProblem.push(line);
        } else if (currentProblem.length > 0) {
          problemsArray.push(currentProblem.join('\n'));
          currentProblem = [];
        }
      }
      
      if (currentProblem.length > 0) {
        problemsArray.push(currentProblem.join('\n'));
      }
    }
    
    if (JSON.stringify(problemsArray) !== JSON.stringify(item.problems_solved || [])) {
      onFieldChange(item.id, 'problems_solved', problemsArray);
    }
    setIsEditingProblems(false);
  };

  const handleImpactBlur = (value: string) => {
    if (value !== item.impact) {
      onFieldChange(item.id, 'impact', value);
    }
    setIsEditingImpact(false);
  };

  const handleSolutionBlur = (value: string) => {
    if (value !== item.solusi) {
      onFieldChange(item.id, 'solusi', value);
    }
  };

  const handleWantsBlur = (value: string) => {
    if (value !== (item.wants || '')) {
      onFieldChange(item.id, 'wants', value);
    }
    setIsEditingWants(false);
  };

  const handleNeedsBlur = (value: string) => {
    if (value !== (item.needs || '')) {
      onFieldChange(item.id, 'needs', value);
    }
    setIsEditingNeeds(false);
  };

  const handleHiddenNeedsBlur = (value: string) => {
    if (value !== (item.hidden_needs || '')) {
      onFieldChange(item.id, 'hidden_needs', value);
    }
    setIsEditingHiddenNeeds(false);
  };

  const handleFalseBeliefBlur = (value: string) => {
    if (value !== (item.false_belief || '')) {
      onFieldChange(item.id, 'false_belief', value);
    }
    setIsEditingFalseBelief(false);
  };

  const handleFalseBeliefImpactBlur = (value: string) => {
    if (value !== (item.false_belief_impact || '')) {
      onFieldChange(item.id, 'false_belief_impact', value);
    }
    setIsEditingFalseBeliefImpact(false);
  };

  const handleWhatMakesThemStopBlur = (value: string) => {
    if (value !== (item.what_makes_them_stop || '')) {
      onFieldChange(item.id, 'what_makes_them_stop', value);
    }
    setIsEditingWhatMakesThemStop(false);
  };

  // Format competitive_advantage (JSONB) to string
  const formatCompetitiveAdvantage = (competitiveAdvantage: any): string => {
    if (!competitiveAdvantage) return '';
    if (typeof competitiveAdvantage === 'string') return competitiveAdvantage;
    if (Array.isArray(competitiveAdvantage)) {
      // Format dengan newline dan baris kosong di antara setiap advantage untuk pemisahan visual
      // Pertahankan spasi di tengah baris
      return competitiveAdvantage.filter(Boolean).join('\n\n');
    }
    if (typeof competitiveAdvantage === 'object') {
      return JSON.stringify(competitiveAdvantage);
    }
    return String(competitiveAdvantage);
  };

  // Parse competitive advantage string to JSONB
  const parseCompetitiveAdvantage = (value: string): any => {
    if (!value || value.trim() === '') return null;
    // Try to parse as JSON first
    try {
      return JSON.parse(value);
    } catch {
      // If not valid JSON, treat as newline-separated array (seperti Problem)
      // Parse string dengan double newline (\n\n) sebagai pemisah utama antar advantage
      // Jika tidak ada double newline, gunakan single newline sebagai fallback
      // Pertahankan spasi di dalam setiap baris, termasuk indentasi di awal
      // Hanya hapus trailing whitespace (spasi di akhir baris)
      
      let items: string[] = [];
      
      // Coba split berdasarkan double newline terlebih dahulu
      if (value.includes('\n\n')) {
        items = value
          .split(/\n\n+/)
          .map(p => p.replace(/\s+$/, '')) // Hapus trailing whitespace saja
          .filter(p => p.trim().length > 0); // Hanya filter yang benar-benar kosong
      } else {
        // Fallback: split berdasarkan single newline dan kelompokkan
        // Baris kosong bertindak sebagai pemisah
        const lines = value.split(/\n/).map(p => p.replace(/\s+$/, ''));
        let currentItem: string[] = [];
        
        for (const line of lines) {
          if (line.trim().length > 0) {
            currentItem.push(line);
          } else if (currentItem.length > 0) {
            items.push(currentItem.join('\n'));
            currentItem = [];
          }
        }
        
        if (currentItem.length > 0) {
          items.push(currentItem.join('\n'));
        }
      }
      
      return items.length > 0 ? items : null;
    }
  };

  const handleCompetitiveAdvantageBlur = (value: string) => {
    const parsed = parseCompetitiveAdvantage(value);
    const currentValue = item.competitive_advantage;
    if (JSON.stringify(parsed) !== JSON.stringify(currentValue)) {
      onFieldChange(item.id, 'competitive_advantage', parsed);
    }
  };

  return (
    <tr className="hover:bg-gray-50 border-b border-gray-200">
      {/* Checkbox */}
      <td style={{ width: '48px', minWidth: '48px', maxWidth: '48px' }} className="px-2 py-1 text-center border-r border-gray-200">
        <Checkbox checked={isSelected} onCheckedChange={handleCheckboxChange} />
      </td>

      {/* Product/Service */}
      <td style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }} className="px-2 py-1 border-r border-gray-200">
        <Select 
          value={item.service_id || 'placeholder'} 
          onValueChange={(value) => {
            if (value === 'placeholder') {
              onFieldChange(item.id, 'service_id', null);
              onFieldChange(item.id, 'sub_service_id', null);
              onFeatureSelect(item.id, null);
            } else {
              onFieldChange(item.id, 'service_id', value);
              onFieldChange(item.id, 'sub_service_id', null);
              onFeatureSelect(item.id, null);
            }
          }}
        >
          <SelectTrigger className="h-8 text-xs border-gray-200 text-left">
            <SelectValue placeholder={t('productKnowledge.table.selectService', 'Select Service')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="placeholder" disabled>{t('productKnowledge.table.selectService', 'Select Service')}</SelectItem>
            {services.map(service => (
              <SelectItem key={service.id} value={service.id}>
                {service.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      {/* Sub Service */}
      <td style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }} className="px-2 py-1 border-r border-gray-200">
        <Select 
          value={item.sub_service_id || 'placeholder'} 
          onValueChange={(value) => {
            if (value === 'placeholder') {
              onFieldChange(item.id, 'sub_service_id', null);
            } else {
              onFieldChange(item.id, 'sub_service_id', value);
            }
          }}
          disabled={!item.service_id}
        >
          <SelectTrigger className="h-8 text-xs border-gray-200 text-left">
            <SelectValue placeholder={item.service_id ? t('productKnowledge.table.selectSubService', 'Select Sub Service') : t('productKnowledge.table.selectServiceFirst', 'Select Service First')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="placeholder" disabled>{t('productKnowledge.table.selectSubService', 'Select Sub Service')}</SelectItem>
            {subServices
              .filter(subService => subService.service_id === item.service_id)
              .map(subService => (
                <SelectItem key={subService.id} value={subService.id}>
                  {subService.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </td>

      {/* Fitur - read-only: klik hanya untuk baca; dropdown hanya untuk assign feature */}
      <td style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }} className="px-2 py-1 border-r border-gray-200">
        <div className="flex items-center gap-1 w-full">
          <div
            className="flex-1 min-w-0 text-sm text-gray-700 cursor-pointer hover:bg-gray-100 p-1 rounded min-h-[32px] flex items-center truncate"
            onClick={() => openViewPopup('feature', t('productKnowledge.table.headers.feature', 'Feature'), item.feature_name || '', true)}
            title={item.feature_name || t('productKnowledge.table.selectFeature', 'Select Feature')}
          >
            {item.feature_name || <span className="text-gray-400 italic">{t('productKnowledge.table.selectFeature', 'Select Feature')}</span>}
          </div>
          <Select
            value={item.feature_id || (masterFeatures.find((m) => m.feature_name === item.feature_name)?.id) || 'placeholder'}
            onValueChange={(value) => {
              if (value === 'placeholder' || value === '') {
                onFeatureSelect(item.id, null);
              } else {
                const master = masterFeatures.find((m) => m.id === value);
                if (master) onFeatureSelect(item.id, master);
              }
            }}
          >
            <SelectTrigger className="h-8 w-8 flex-shrink-0 p-0 border border-gray-200 rounded inline-flex items-center justify-center min-w-[2rem] [&>span:first-child]:hidden [&>*:last-child]:ml-0" title={t('productKnowledge.table.changeFeature', 'Change feature')}>
              <SelectValue className="sr-only" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="placeholder" disabled>
                {t('productKnowledge.table.selectFeature', 'Select Feature')}
              </SelectItem>
              {masterFeatures
                .filter((m) => (m.service_id ?? null) === (item.service_id ?? null))
                .map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.feature_name || '-'}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </td>

      {/* Fitur Description - read-only: klik hanya untuk baca */}
      <td style={{ width: '200px', minWidth: '200px', maxWidth: '200px' }} className="px-2 py-1 border-r border-gray-200">
        {!isFeatureSelected ? (
          <div className="text-sm text-gray-400 italic min-h-[32px] flex items-center" title={t('productKnowledge.table.selectFeatureFirst', 'Select feature first')}>
            {t('productKnowledge.table.selectFeatureFirst', 'Select feature first')}
          </div>
        ) : (
          (() => {
            const plainFeatureDescription = stripHtml(item.feature_description || '');
            return (
          <div
            className="text-sm text-gray-700 cursor-pointer hover:bg-gray-100 p-1 rounded min-h-[32px] truncate"
            onClick={() => openViewPopup('featureDescription', t('productKnowledge.table.headers.featureDescription', 'Feature Description'), item.feature_description || '', true, true)}
            title={plainFeatureDescription || '-'}
          >
            {plainFeatureDescription || '-'}
          </div>
            );
          })()
        )}
      </td>

      {/* Solusi - read-only: klik hanya untuk baca */}
      <td style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }} className="px-2 py-1 border-r border-gray-200">
        {!isFeatureSelected ? (
          <div className="text-sm text-gray-400 italic min-h-[32px] flex items-center" title={t('productKnowledge.table.selectFeatureFirst', 'Select feature first')}>
            {t('productKnowledge.table.selectFeatureFirst', 'Select feature first')}
          </div>
        ) : (
          (() => {
            const plainSolution = stripHtml(item.solusi || '');
            return (
              <div
                className="text-sm text-gray-700 cursor-pointer hover:bg-gray-100 p-1 rounded min-h-[32px] truncate"
                onClick={() => openViewPopup('solution', t('productKnowledge.table.headers.solution', 'Solution'), item.solusi || '', true, true)}
                title={plainSolution || '-'}
              >
                {plainSolution || '-'}
              </div>
            );
          })()
        )}
      </td>

      {/* Competitive Advantage - read-only: klik hanya untuk baca */}
      <td style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }} className="px-2 py-1 border-r border-gray-200">
        {!isFeatureSelected ? (
          <div className="text-sm text-gray-400 italic min-h-[32px] flex items-center" title={t('productKnowledge.table.selectFeatureFirst', 'Select feature first')}>
            {t('productKnowledge.table.selectFeatureFirst', 'Select feature first')}
          </div>
        ) : (
          (() => {
            const competitiveAdvantageContent = formatCompetitiveAdvantage(item.competitive_advantage);
            const plainCompetitiveAdvantage = stripHtml(competitiveAdvantageContent || '');
            return (
              <div
                className="text-sm text-gray-700 cursor-pointer hover:bg-gray-100 p-1 rounded min-h-[32px] truncate"
                onClick={() =>
                  openViewPopup(
                    'competitiveAdvantage',
                    t('productKnowledge.table.headers.competitiveAdvantage', 'Competitive Advantage'),
                    competitiveAdvantageContent,
                    true,
                    true
                  )
                }
                title={plainCompetitiveAdvantage || '-'}
              >
                {plainCompetitiveAdvantage || '-'}
              </div>
            );
          })()
        )}
      </td>

      {/* Target Market */}
      <td style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }} className="px-2 py-1 border-r border-gray-200">
        {isEditingTargetMarket ? (
          <textarea
            defaultValue={formatTargetMarket(item.target_audience)}
            onBlur={(e) => handleTargetMarketBlur(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsEditingTargetMarket(false);
              }
            }}
            autoFocus
            className="w-full text-sm border border-gray-300 rounded px-2 py-1 resize-none"
            rows={3}
          />
        ) : (
          <div
            className="text-sm text-gray-700 cursor-pointer hover:bg-gray-100 p-1 rounded min-h-[32px] truncate"
            onClick={() => openViewPopup('targetMarket', t('productKnowledge.table.headers.targetMarket', 'Customer Persona'), formatTargetMarket(item.target_audience))}
            onDoubleClick={() => setIsEditingTargetMarket(true)}
            title={formatTargetMarket(item.target_audience) || '-'}
          >
            {formatTargetMarket(item.target_audience) || '-'}
          </div>
        )}
      </td>

      {/* Problem */}
      <td style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }} className="px-2 py-1 border-r border-gray-200">
        {isEditingProblems ? (
          <textarea
            defaultValue={formatProblems(item.problems_solved)}
            onBlur={(e) => handleProblemsBlur(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsEditingProblems(false);
              }
            }}
            autoFocus
            className="w-full text-sm border border-gray-300 rounded px-2 py-1 resize-none whitespace-pre-wrap"
            rows={5}
            placeholder="Masalah 1: ...&#10;Masalah 2: ..."
          />
        ) : (
          <div
            className="text-sm text-gray-700 cursor-pointer hover:bg-gray-100 p-1 rounded min-h-[32px] truncate"
            onClick={() => openViewPopup('problems', t('productKnowledge.table.headers.problem', 'Problem'), formatProblems(item.problems_solved))}
            onDoubleClick={() => setIsEditingProblems(true)}
            title={formatProblems(item.problems_solved) || '-'}
          >
            {formatProblems(item.problems_solved) || '-'}
            {item.problem_tags && item.problem_tags.length > 0 && (
              <span className="ml-1 text-xs text-blue-600">({item.problem_tags.length} tags)</span>
            )}
          </div>
        )}
      </td>

      {/* Dampak */}
      <td style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }} className="px-2 py-1 border-r border-gray-200">
        {isEditingImpact ? (
          <textarea
            defaultValue={item.impact || ''}
            onBlur={(e) => handleImpactBlur(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsEditingImpact(false);
              }
            }}
            autoFocus
            className="w-full text-sm border border-gray-300 rounded px-2 py-1 resize-none whitespace-pre-wrap"
            rows={5}
            placeholder="Impact 1: ...&#10;&#10;Impact 2: ..."
          />
        ) : (
          <div
            className="text-sm text-gray-700 cursor-pointer hover:bg-gray-100 p-1 rounded min-h-[32px] truncate"
            onClick={() => openViewPopup('impact', t('productKnowledge.table.headers.impact', 'Impact'), item.impact || '')}
            onDoubleClick={() => setIsEditingImpact(true)}
            title={item.impact || '-'}
          >
            {item.impact || '-'}
          </div>
        )}
      </td>

      {/* Wants */}
      <td style={{ width: '200px', minWidth: '200px', maxWidth: '200px' }} className="px-2 py-1 border-r border-gray-200">
        {isEditingWants ? (
          <textarea
            defaultValue={item.wants || ''}
            onBlur={(e) => handleWantsBlur(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsEditingWants(false);
              }
            }}
            autoFocus
            className="w-full text-sm border border-gray-300 rounded px-2 py-1 resize-none"
            rows={3}
          />
        ) : (
          <div
            className="text-sm text-gray-700 cursor-pointer hover:bg-gray-100 p-1 rounded min-h-[32px] truncate"
            onClick={() => openViewPopup('wants', t('productKnowledge.table.headers.wants', 'Wants'), item.wants || '')}
            onDoubleClick={() => setIsEditingWants(true)}
            title={item.wants || '-'}
          >
            {item.wants || '-'}
          </div>
        )}
      </td>

      {/* Needs */}
      <td style={{ width: '200px', minWidth: '200px', maxWidth: '200px' }} className="px-2 py-1 border-r border-gray-200">
        {isEditingNeeds ? (
          <textarea
            defaultValue={item.needs || ''}
            onBlur={(e) => handleNeedsBlur(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsEditingNeeds(false);
              }
            }}
            autoFocus
            className="w-full text-sm border border-gray-300 rounded px-2 py-1 resize-none"
            rows={3}
          />
        ) : (
          <div
            className="text-sm text-gray-700 cursor-pointer hover:bg-gray-100 p-1 rounded min-h-[32px] truncate"
            onClick={() => openViewPopup('needs', t('productKnowledge.table.headers.needs', 'Needs'), item.needs || '')}
            onDoubleClick={() => setIsEditingNeeds(true)}
            title={item.needs || '-'}
          >
            {item.needs || '-'}
          </div>
        )}
      </td>

      {/* Hidden Needs */}
      <td style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }} className="px-2 py-1 border-r border-gray-200">
        {isEditingHiddenNeeds ? (
          <textarea
            defaultValue={item.hidden_needs || ''}
            onBlur={(e) => handleHiddenNeedsBlur(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsEditingHiddenNeeds(false);
              }
            }}
            autoFocus
            className="w-full text-sm border border-gray-300 rounded px-2 py-1 resize-none whitespace-pre-wrap"
            rows={5}
            placeholder="Hidden Needs 1: ...&#10;Hidden Needs 2: ..."
          />
        ) : (
          <div
            className="text-sm text-gray-700 cursor-pointer hover:bg-gray-100 p-1 rounded min-h-[32px] truncate"
            onClick={() => openViewPopup('hiddenNeeds', t('productKnowledge.table.headers.hiddenNeeds', 'Hidden Needs'), item.hidden_needs || '')}
            onDoubleClick={() => setIsEditingHiddenNeeds(true)}
            title={item.hidden_needs || '-'}
          >
            {item.hidden_needs || '-'}
          </div>
        )}
      </td>

      {/* False Belief */}
      <td style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }} className="px-2 py-1 border-r border-gray-200">
        {isEditingFalseBelief ? (
          <textarea
            defaultValue={item.false_belief || ''}
            onBlur={(e) => handleFalseBeliefBlur(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsEditingFalseBelief(false);
              }
            }}
            autoFocus
            className="w-full text-sm border border-gray-300 rounded px-2 py-1 resize-none whitespace-pre-wrap"
            rows={5}
            placeholder="False Belief 1: ...&#10;&#10;False Belief 2: ..."
          />
        ) : (
          <div
            className="text-sm text-gray-700 cursor-pointer hover:bg-gray-100 p-1 rounded min-h-[32px] truncate"
            onClick={() => openViewPopup('falseBelief', t('productKnowledge.table.headers.falseBelief', 'False Belief'), item.false_belief || '')}
            onDoubleClick={() => setIsEditingFalseBelief(true)}
            title={item.false_belief || '-'}
          >
            {item.false_belief || '-'}
          </div>
        )}
      </td>

      {/* False Belief Impact */}
      <td style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }} className="px-2 py-1 border-r border-gray-200">
        {isEditingFalseBeliefImpact ? (
          <textarea
            defaultValue={item.false_belief_impact || ''}
            onBlur={(e) => handleFalseBeliefImpactBlur(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsEditingFalseBeliefImpact(false);
              }
            }}
            autoFocus
            className="w-full text-sm border border-gray-300 rounded px-2 py-1 resize-none whitespace-pre-wrap"
            rows={5}
            placeholder="False Belief Impact 1: ...&#10;&#10;False Belief Impact 2: ..."
          />
        ) : (
          <div
            className="text-sm text-gray-700 cursor-pointer hover:bg-gray-100 p-1 rounded min-h-[32px] truncate"
            onClick={() => openViewPopup('falseBeliefImpact', t('productKnowledge.table.headers.falseBeliefImpact', 'False Belief Impact'), item.false_belief_impact || '')}
            onDoubleClick={() => setIsEditingFalseBeliefImpact(true)}
            title={item.false_belief_impact || '-'}
          >
            {item.false_belief_impact || '-'}
          </div>
        )}
      </td>

      {/* What Makes Them Stop */}
      <td style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }} className="px-2 py-1 border-r border-gray-200">
        {isEditingWhatMakesThemStop ? (
          <textarea
            defaultValue={item.what_makes_them_stop || ''}
            onBlur={(e) => handleWhatMakesThemStopBlur(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsEditingWhatMakesThemStop(false);
              }
            }}
            autoFocus
            className="w-full text-sm border border-gray-300 rounded px-2 py-1 resize-none whitespace-pre-wrap"
            rows={5}
            placeholder="What Makes Them Stop 1: ...&#10;&#10;What Makes Them Stop 2: ..."
          />
        ) : (
          <div
            className="text-sm text-gray-700 cursor-pointer hover:bg-gray-100 p-1 rounded min-h-[32px] truncate"
            onClick={() => openViewPopup('whatMakesThemStop', t('productKnowledge.table.headers.whatMakesThemStop', 'What Makes Them Stop?'), item.what_makes_them_stop || '')}
            onDoubleClick={() => setIsEditingWhatMakesThemStop(true)}
            title={item.what_makes_them_stop || '-'}
          >
            {item.what_makes_them_stop || '-'}
          </div>
        )}
      </td>

      {/* Generate prompt (tanpa AI) / See Detail - ujung kolom What Makes Them Stop */}
      {onGeneratePromptForRow && (
        <td style={{ width: '200px', minWidth: '200px', maxWidth: '200px' }} className="px-2 py-1 text-center border-gray-200">
          {isRowFullyFilled(item) ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRowDetailOpen(true)}
              className="gap-1.5 text-xs whitespace-nowrap"
            >
              <Eye className="h-4 w-4 shrink-0" />
              {t('productKnowledge.generate.seeDetail', 'See Detail')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!item.feature_name?.trim() || !item.feature_description?.trim()}
              onClick={() => onGeneratePromptForRow(item.id)}
              className="gap-1.5 text-xs whitespace-nowrap"
              title={!(item.feature_name?.trim() && item.feature_description?.trim()) ? t('productKnowledge.generate.fillFeatureFirst', 'Isi minimal Feature dan Feature Description di satu baris.') : undefined}
            >
              <FileText className="h-4 w-4 shrink-0" />
              {t('productKnowledge.generate.generatePromptNoAI', 'Generate prompt (tanpa AI)')}
            </Button>
          )}
        </td>
      )}

      {/* View/Edit Popup Dialog */}
      <Dialog open={popupState.isOpen} onOpenChange={(open) => {
        if (!open) {
          handlePopupCancel();
        } else {
          setPopupState({ ...popupState, isOpen: open });
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{popupState.title}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 flex-1 overflow-y-auto">
            {popupState.readOnly ? (
              <div className="min-h-[200px] text-sm whitespace-pre-wrap p-3 bg-gray-50 rounded border border-gray-200">
                {popupState.isHtml ? (
                  <div
                    className="[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_p]:mb-2"
                    dangerouslySetInnerHTML={{ __html: popupState.content || '<p>-</p>' }}
                  />
                ) : (
                  popupState.content || '-'
                )}
              </div>
            ) : (
              <Textarea
                value={popupState.editedContent}
                onChange={(e) => setPopupState({ ...popupState, editedContent: e.target.value })}
                className="min-h-[300px] text-sm whitespace-pre-wrap font-mono"
                placeholder="Enter content here..."
              />
            )}
          </div>
          <DialogFooter className="mt-4">
            {popupState.readOnly ? (
              <Button variant="outline" onClick={handlePopupCancel}>
                {t('common.close', 'Close')}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={handlePopupCancel}>
                  Cancel
                </Button>
                <Button onClick={handlePopupSave}>
                  Save
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Row detail modal: Product/Service, Sub Service, dan semua kolom */}
      <Dialog open={rowDetailOpen} onOpenChange={(open) => !open && setRowDetailOpen(false)}>
        <DialogContent className="flex flex-col p-0 gap-0 w-[min(560px,85vmin)] h-[min(560px,85vmin)] max-w-[95vw] max-h-[85vh] overflow-hidden">
          <DialogHeader className="flex-shrink-0 px-4 pt-4 pb-2">
            <DialogTitle className="text-base">
              {t('productKnowledge.table.rowDetailTitle', 'Detail Baris')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-2 seamless-scroll">
            <div className="space-y-4 pr-2">
              <MainTableDetailSection
                label={t('productKnowledge.table.headers.productService', 'Product/Service')}
                value={getProductServiceName(item) || '—'}
              />
              <MainTableDetailSection
                label={t('productKnowledge.table.headers.subService', 'Sub Service')}
                value={item.sub_service_name || '—'}
              />
              <MainTableDetailSection
                label={t('productKnowledge.table.headers.feature', 'Feature')}
                value={item.feature_name || '—'}
              />
              <MainTableDetailSection
                label={t('productKnowledge.table.headers.featureDescription', 'Feature Description')}
                value={item.feature_description || '—'}
                isRichText
              />
              <MainTableDetailSection
                label={t('productKnowledge.table.headers.solution', 'Solution')}
                value={item.solusi || '—'}
                isRichText
              />
              <MainTableDetailSection
                label={t('productKnowledge.table.headers.competitiveAdvantage', 'Competitive Advantage')}
                value={formatCompetitiveAdvantage(item.competitive_advantage) || '—'}
                isRichText
              />
              <MainTableDetailSection
                label={t('productKnowledge.table.headers.targetMarket', 'Customer Persona')}
                value={formatTargetMarket(item.target_audience) || '—'}
              />
              <MainTableDetailSection
                label={t('productKnowledge.table.headers.problem', 'Problem')}
                value={formatProblems(item.problems_solved) || '—'}
              />
              <MainTableDetailSection
                label={t('productKnowledge.table.headers.impact', 'Impact')}
                value={item.impact || '—'}
              />
              <MainTableDetailSection
                label={t('productKnowledge.table.headers.wants', 'Wants')}
                value={item.wants || '—'}
              />
              <MainTableDetailSection
                label={t('productKnowledge.table.headers.needs', 'Needs')}
                value={item.needs || '—'}
              />
              <MainTableDetailSection
                label={t('productKnowledge.table.headers.hiddenNeeds', 'Hidden Needs')}
                value={item.hidden_needs || '—'}
              />
              <MainTableDetailSection
                label={t('productKnowledge.table.headers.falseBelief', 'False Belief')}
                value={item.false_belief || '—'}
              />
              <MainTableDetailSection
                label={t('productKnowledge.table.headers.falseBeliefImpact', 'False Belief Impact')}
                value={item.false_belief_impact || '—'}
              />
              <MainTableDetailSection
                label={t('productKnowledge.table.headers.whatMakesThemStop', 'What Makes Them Stop?')}
                value={item.what_makes_them_stop || '—'}
              />
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 border-t border-gray-200 px-4 py-3 bg-gray-50">
            <Button variant="outline" onClick={() => setRowDetailOpen(false)}>
              {t('common.close', 'Tutup')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </tr>
  );
};

