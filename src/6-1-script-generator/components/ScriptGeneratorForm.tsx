import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/components/ui/command';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';
import { Sparkles, Loader2, X, ChevronDown, Check, Copy } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import {
  ScriptGeneratorRequest,
  isStoryTellingContentPillar,
  type ScriptBreakdownTableSnapshot,
} from '../services/scriptGeneratorService';
import { useScriptBreakdownTableTemplates } from '@/6-1-product-knowledge/hooks/useScriptBreakdownTableTemplates';
import { useScriptGeneratorFormMasterData } from '../hooks/useScriptGeneratorFormMasterData';
import { useProductKnowledge } from '@/6-1-product-knowledge/hooks/useProductKnowledge';
import { useProductKnowledgeDetail } from '@/6-1-product-knowledge/hooks/useProductKnowledgeDetail';
import type { ProductKnowledgeDetail } from '@/6-1-product-knowledge/hooks/useProductKnowledgeDetail';
import { useProductKnowledgeStyle } from '@/6-1-product-knowledge/hooks/useProductKnowledgeStyle';
import { useProductKnowledgeHooks } from '@/6-1-product-knowledge/hooks/useProductKnowledgeHooks';
import { useKeywords } from '@/6-1-product-knowledge/hooks/useKeywords';
import { toast } from 'sonner';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { cn } from '@/shared/lib/utils';
import { DrawerSelectField } from '@/mobile-app/components/DrawerSelectField';

/** Judul di trigger: hilang halus saat expand (diganti bar primary di dalam konten). */
const SCRIPT_GEN_ACCORDION_TRIGGER_TITLE_CLASS =
  'block min-w-0 truncate text-left overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-smooth motion-reduce:transition-none motion-reduce:duration-0 group-data-[state=closed]:max-w-full group-data-[state=closed]:opacity-100 group-data-[state=closed]:translate-x-0 group-data-[state=open]:max-w-0 group-data-[state=open]:opacity-0 group-data-[state=open]:-translate-x-1';

/** Nilai Select untuk "tanpa hook" (bukan nama template dari Product Knowledge). */
const HOOK_NAME_SELECT_NONE = '__hook_none__';

const BREAKDOWN_TABLE_SELECT_NONE = '__breakdown_table_none__';

interface ScriptGeneratorFormProps {
  onGenerate: (data: ScriptGeneratorRequest) => Promise<void>;
  isGenerating: boolean;
  /** Mobile Persona Form: open options in a bottom drawer instead of a popover. */
  selectAsDrawer?: boolean;
}

type FormSelectDrawerId =
  | 'contentType'
  | 'durationUnit'
  | 'service'
  | 'subService'
  | 'contentPillar'
  | 'sellingApproach'
  | 'storyContext'
  | 'feature'
  | 'persona'
  | 'gender'
  | 'keywords'
  | 'keinginan'
  | 'kebutuhan'
  | 'breakdown'
  | 'hook'
  | 'style'
  | 'cta'
  | 'judul';

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function richTextToPlainText(value: string | null | undefined): string {
  if (!value) return '';
  let text = decodeHtmlEntities(String(value).replace(/\u200B/g, ''));
  text = text.replace(/<\s*br\s*\/?>/gi, '\n');
  text = text.replace(/<\/\s*p\s*>/gi, '\n');
  text = text.replace(/<\s*p[^>]*>/gi, '');
  text = text.replace(/<\/\s*li\s*>/gi, '\n');
  text = text.replace(/<\s*li[^>]*>/gi, '- ');
  text = text.replace(/<\/?\s*(ul|ol)[^>]*>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  return text;
}

/** Target Audience untuk prompt Story Telling dari baris Creative (`product_knowledge_detail`). */
function buildTargetMarketFromCreativeDetail(d: ProductKnowledgeDetail): string {
  const parts: string[] = [];
  const title = d.title?.trim();
  if (title) parts.push(`**Target market:** ${title}`);
  const pers = d.perspective?.trim();
  if (pers) parts.push(`**Dari perspective:** ${pers}`);
  const body = richTextToPlainText(d.product_knowledge_content).trim();
  if (body) parts.push(body);
  return parts.join('\n\n');
}

function sanitizeScriptRequestPayload(request: ScriptGeneratorRequest): ScriptGeneratorRequest {
  return {
    ...request,
    keinginan: richTextToPlainText(request.keinginan),
    kebutuhan: richTextToPlainText(request.kebutuhan),
    hidden_needs: richTextToPlainText(request.hidden_needs),
    problem: richTextToPlainText(request.problem),
    impact: richTextToPlainText(request.impact),
    false_belief: richTextToPlainText(request.false_belief),
    false_belief_impact: richTextToPlainText(request.false_belief_impact),
    what_makes_them_stop: richTextToPlainText(request.what_makes_them_stop),
    feature_name: richTextToPlainText(request.feature_name),
    feature_description: richTextToPlainText(request.feature_description),
    competitive_advantage: richTextToPlainText(request.competitive_advantage),
    solution: richTextToPlainText(request.solution),
    hook_description: richTextToPlainText(request.hook_description),
    hook_content: richTextToPlainText(request.hook_content),
    style_instruksi: richTextToPlainText(request.style_instruksi),
    structure: richTextToPlainText(request.structure),
    judul: richTextToPlainText(request.judul),
    judul_custom: richTextToPlainText(request.judul_custom),
    target_market: richTextToPlainText(request.target_market),
    gender: richTextToPlainText(request.gender),
    age: richTextToPlainText(request.age),
    buying_roles: richTextToPlainText(request.buying_roles),
    service_name: richTextToPlainText(request.service_name),
    sub_service_name: richTextToPlainText(request.sub_service_name),
    content_pillar: richTextToPlainText(request.content_pillar),
    content_type: richTextToPlainText(request.content_type),
    story_context_mode: request.story_context_mode,
    script_breakdown_table: sanitizeScriptBreakdownSnapshotForPayload(request.script_breakdown_table),
  };
}

function sanitizeScriptBreakdownSnapshotForPayload(
  snapshot: ScriptBreakdownTableSnapshot | undefined
): ScriptBreakdownTableSnapshot | undefined {
  if (!snapshot?.columns?.length) return undefined;
  const columns = snapshot.columns
    .map((c) => ({
      header_label: richTextToPlainText(c.header_label).trim(),
      placeholder_example:
        c.placeholder_example != null ? richTextToPlainText(c.placeholder_example) : null,
      detail_body: c.detail_body != null ? richTextToPlainText(c.detail_body) : null,
      fill_rule: c.fill_rule === 'honest_empty' ? 'honest_empty' : 'strict',
      keyword_hint:
        c.keyword_hint === 'narasi' ? 'narasi' : c.keyword_hint === 'visual' ? 'visual' : 'none',
    }))
    .filter((c) => c.header_label !== '');
  if (!columns.length) return undefined;
  const name = snapshot.templateName != null ? richTextToPlainText(snapshot.templateName).trim() : '';
  return {
    ...(name ? { templateName: name } : {}),
    columns,
  };
}

// Judul templates - bisa digunakan oleh semua multi tenant
const judulTemplates = [
  {
    value: 'cara-melakukan',
    label: 'Cara [Melakukan Sesuatu] Dalam [Waktu Singkat] Dengan [Hasil Hebat]',
    template: 'Cara [Melakukan Sesuatu] Dalam [Waktu Singkat] Dengan [Hasil Hebat]'
  },
  {
    value: 'tips-mencapai',
    label: '[#] Tips untuk [Mencapai Tujuan/Hasil] yang Lebih Baik',
    template: '[#] Tips untuk [Mencapai Tujuan/Hasil] yang Lebih Baik'
  },
  {
    value: 'orang-tidak-tahu',
    label: '[#%] Orang Tidak Tahu [Fakta atau Statistik Penting]',
    template: '[#%] Orang Tidak Tahu [Fakta atau Statistik Penting]'
  },
  {
    value: 'testimoni',
    label: 'Pelanggan Kami Berkata: [Kutipan Positif Tentang Produk/Layanan]',
    template: 'Pelanggan Kami Berkata: [Kutipan Positif Tentang Produk/Layanan]'
  },
  {
    value: 'jangan-pernah',
    label: 'Jangan Pernah [Lakukan Sesuatu] Jika Anda Ingin [Hasil yang Lebih Baik]',
    template: 'Jangan Pernah [Lakukan Sesuatu] Jika Anda Ingin [Hasil yang Lebih Baik]'
  },
  {
    value: 'masalah-solusi',
    label: 'Masalah [Masalah Umum]? Inilah Solusinya!',
    template: 'Masalah [Masalah Umum]? Inilah Solusinya!'
  },
  {
    value: 'garansi',
    label: '100% Garansi [Manfaat atau Hasil] atau Uang Anda Kembali!',
    template: '100% Garansi [Manfaat atau Hasil] atau Uang Anda Kembali!'
  },
  {
    value: 'rahasia',
    label: 'Rahasia Terbesar dalam [Industri atau Topik] Terungkap!',
    template: 'Rahasia Terbesar dalam [Industri atau Topik] Terungkap!'
  },
  {
    value: 'perbandingan',
    label: '[Produk/Layanan A] vs. [Produk/Layanan B]: Mana yang Lebih Baik?',
    template: '[Produk/Layanan A] vs. [Produk/Layanan B]: Mana yang Lebih Baik?'
  },
  {
    value: 'panduan-langkah',
    label: 'Langkah-demi-Langkah Panduan Mendapatkan [Hasil yang Diinginkan]',
    template: 'Langkah-demi-Langkah Panduan Mendapatkan [Hasil yang Diinginkan]'
  },
  {
    value: 'panduan-khusus',
    label: 'Panduan Khusus Hanya untuk [Audience/Target Market]',
    template: 'Panduan Khusus Hanya untuk [Audience/Target Market]'
  },
  {
    value: 'seberapa-aman',
    label: 'Seberapa Aman [Sesuatu yang Berharga] dari [Ancaman]?',
    template: 'Seberapa Aman [Sesuatu yang Berharga] dari [Ancaman]?'
  },
  {
    value: 'tanda-peringatan',
    label: '[#Tanda] Peringatan Bahwa Ada [Sesuatu Yang Buruk]',
    template: '[#Tanda] Peringatan Bahwa Ada [Sesuatu Yang Buruk]'
  },
  {
    value: 'peringatan',
    label: 'Peringatan! [Masukan Sesuatu yang Buruk]',
    template: 'Peringatan! [Masukan Sesuatu yang Buruk]'
  },
  {
    value: 'resiko-faktor',
    label: '[#] Resiko/Faktor yang Sedikit Diketahui yang Dapat Menjadi [Sesuatu yang Buruk] pada [Sesuatu yang Berharga]',
    template: '[#] Resiko/Faktor yang Sedikit Diketahui yang Dapat Menjadi [Sesuatu yang Buruk] pada [Sesuatu yang Berharga]'
  },
  {
    value: 'kebenaran',
    label: 'Kebenaran Mengejutkan tentang [Sesuatu yang Berharga]',
    template: 'Kebenaran Mengejutkan tentang [Sesuatu yang Berharga]'
  }
];

export const ScriptGeneratorForm: React.FC<ScriptGeneratorFormProps> = ({
  onGenerate,
  isGenerating,
  selectAsDrawer = false,
}) => {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  
  const [formData, setFormData] = useState<ScriptGeneratorRequest>({
    content_type: '',
    service_name: '',
    sub_service_name: '',
    content_pillar: '',
    duration_minutes: undefined,
    slide: undefined,
    duration_value: undefined,
    duration_unit: 'detik',
    target_market: '',
    gender: '',
    age: '',
    buying_roles: '',
    keywords: [],
    keinginan: '',
    kebutuhan: '',
    hidden_needs: '',
    problem: '',
    impact: '',
    false_belief: '',
    false_belief_impact: '',
    what_makes_them_stop: '',
    feature_name: '',
    feature_description: '',
    competitive_advantage: '',
    solution: '',
    hook_name: '',
    hook_description: '',
    hook_content: '',
    style_name: '',
    style_instruksi: '',
    structure: '',
    judul: '',
    judul_custom: '',
    selling_approach: undefined,
    cta_type: undefined,
    script_breakdown_table: undefined,
  });
  
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedHookName, setSelectedHookName] = useState<string>('');
  const [selectedStyleName, setSelectedStyleName] = useState<string>('');
  const [selectedJudulTemplate, setSelectedJudulTemplate] = useState<string>('');
  const [errors, setErrors] = useState<{ target_market?: string; keywords?: string }>({});
  /** Mode Creative: value = id baris `product_knowledge_detail`, atau `__none__`. */
  const [storyCreativeDetailId, setStoryCreativeDetailId] = useState<string>('__none__');
  /** Semua pillar: Creative = sembunyikan Product/Service Details, pilih baris Creative; Product Knowledge = alur PK (fitur, insight, dll.). */
  const [storyContextMode, setStoryContextMode] = useState<'creative' | 'product_knowledge'>('product_knowledge');
  const [keywordSearchOpen, setKeywordSearchOpen] = useState<boolean>(false);
  const [keywordSearchQuery, setKeywordSearchQuery] = useState<string>('');
  const [useKeyword, setUseKeyword] = useState<boolean>(false);
  const [breakdownTableTemplateId, setBreakdownTableTemplateId] = useState<string>(BREAKDOWN_TABLE_SELECT_NONE);
  const [openFormDrawer, setOpenFormDrawer] = useState<FormSelectDrawerId | null>(null);

  const [filteredSubServices, setFilteredSubServices] = useState<any[]>([]);
  const prevContentPillarRef = useRef<string | undefined>(undefined);

  const {
    data: masterData,
    isError: masterQueryIsError,
    error: masterQueryError,
  } = useScriptGeneratorFormMasterData();

  const contentTypes = masterData?.contentTypes ?? [];
  const services = masterData?.services ?? [];
  const subServices = masterData?.subServices ?? [];
  const contentPillars = masterData?.contentPillars ?? [];

  const masterError =
    masterQueryIsError && masterQueryError
      ? masterQueryError instanceof Error
        ? masterQueryError.message
        : String(masterQueryError)
      : null;

  // Fetch product knowledge for wants and needs
  const { data: productKnowledgeData = [] } = useProductKnowledge();
  const { data: productKnowledgeDetailData = [] } = useProductKnowledgeDetail();
  
  // Fetch product knowledge style for style instructions
  const { data: productKnowledgeStyles = [] } = useProductKnowledgeStyle();
  
  // Fetch product knowledge hooks
  const { data: productKnowledgeHooks = [] } = useProductKnowledgeHooks();
  
  // Fetch keywords
  const { data: keywords = [] } = useKeywords();
  const { data: scriptBreakdownTemplates = [] } = useScriptBreakdownTableTemplates();

  const isStoryTelling = useMemo(
    () => isStoryTellingContentPillar(formData.content_pillar),
    [formData.content_pillar]
  );

  const useCreativeContextFlow = useMemo(
    () => storyContextMode === 'creative',
    [storyContextMode]
  );

  const selectedSubServiceIdForFilter = useMemo(() => {
    if (!formData.sub_service_name?.trim()) return '';
    const row = filteredSubServices.find((ss: { name: string }) => ss.name === formData.sub_service_name);
    return row?.id ?? '';
  }, [filteredSubServices, formData.sub_service_name]);

  /** UUID pillar dari master — dipakai menyamakan filter Creative dengan `content_pillar_ids` di baris Creative. */
  const selectedFormContentPillarId = useMemo(() => {
    const name = formData.content_pillar?.trim();
    if (!name) return '';
    return contentPillars.find((p: { name: string; id?: string }) => p.name === name)?.id ?? '';
  }, [formData.content_pillar, contentPillars]);

  const storyCreativeDetailOptions = useMemo(() => {
    if (!useCreativeContextFlow || !selectedServiceId) return [];
    if (!selectedFormContentPillarId) return [];
    return productKnowledgeDetailData.filter((d) => {
      if (d.service_id !== selectedServiceId) return false;
      if (selectedSubServiceIdForFilter) {
        if (d.sub_service_id && d.sub_service_id !== selectedSubServiceIdForFilter) return false;
      }
      const rowPillarIds = d.content_pillar_ids ?? [];
      if (!rowPillarIds.includes(selectedFormContentPillarId)) return false;
      return true;
    });
  }, [
    useCreativeContextFlow,
    selectedServiceId,
    productKnowledgeDetailData,
    selectedSubServiceIdForFilter,
    selectedFormContentPillarId,
  ]);

  const selectedStoryCreativeDetail = useMemo((): ProductKnowledgeDetail | null => {
    if (!useCreativeContextFlow || !storyCreativeDetailId || storyCreativeDetailId === '__none__') return null;
    return productKnowledgeDetailData.find((d) => d.id === storyCreativeDetailId) ?? null;
  }, [useCreativeContextFlow, storyCreativeDetailId, productKnowledgeDetailData]);
  
  // Filter product knowledge that has wants and needs
  const productKnowledgeWithWantsNeeds = productKnowledgeData.filter(
    (pk) => pk.wants && pk.wants.trim() !== '' && pk.needs && pk.needs.trim() !== ''
  );
  
  // Extract unique target_audience (Customer Persona) from product knowledge
  const extractTargetAudienceAsString = (targetAudience: any): string => {
    if (!targetAudience) return '';
    if (typeof targetAudience === 'string') return targetAudience.trim();
    if (typeof targetAudience === 'object') {
      // If it's an object, try to stringify it or extract meaningful string
      try {
        const str = JSON.stringify(targetAudience);
        // If it's a simple object with one key-value, return the value
        if (Object.keys(targetAudience).length === 1) {
          return String(Object.values(targetAudience)[0]).trim();
        }
        return str;
      } catch {
        return String(targetAudience);
      }
    }
    return String(targetAudience).trim();
  };
  
  // Get unique customer personas from product knowledge filtered by selected service AND feature
  const customerPersonas = useMemo(() => {
    // Only show personas if service and feature are selected
    if (!selectedServiceId || !formData.feature_name?.trim()) {
      return [];
    }
    
    const personasSet = new Set<string>();
    const selectedFeature = formData.feature_name.trim();
    
    // Filter product knowledge by selected service AND selected feature
    productKnowledgeData.forEach((pk) => {
      if (pk.service_id === selectedServiceId && pk.feature_name?.trim() === selectedFeature && pk.target_audience) {
        const personaStr = extractTargetAudienceAsString(pk.target_audience);
        if (personaStr && personaStr.trim() !== '') {
          personasSet.add(personaStr);
        }
      }
    });
    
    return Array.from(personasSet).sort();
  }, [productKnowledgeData, selectedServiceId, formData.feature_name]);

  // Unique feature names from product_knowledge, filtered by selected service, sorted alphabetically
  const featureOptions = useMemo(() => {
    if (!selectedServiceId) return [];
    const names = new Set<string>();
    productKnowledgeData
      .filter((pk) => pk.service_id === selectedServiceId && pk.feature_name?.trim())
      .forEach((pk) => names.add(pk.feature_name.trim()));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [productKnowledgeData, selectedServiceId]);

  const filteredStyleOptions = useMemo(() => {
    return productKnowledgeStyles.filter((style) => {
      if (!style.name || style.name.trim() === '') return false;
      if (!formData.content_pillar) return true;
      const selectedPillar = contentPillars.find((pillar) => pillar.name === formData.content_pillar);
      if (!selectedPillar) return true;
      const pillarIds = style.content_pillar_ids || [];
      return pillarIds.length === 0 || pillarIds.includes(selectedPillar.id);
    });
  }, [productKnowledgeStyles, formData.content_pillar, contentPillars]);

  const kebutuhanSelectOptions = useMemo(() => {
    if (!formData.target_market?.trim()) return [] as { value: string; label: string }[];
    const uniqueNeeds = new Map<string, string>();
    const kebutuhanValue = (formData.kebutuhan || '').replace(/\r\n/g, '\n').trim();
    if (kebutuhanValue) uniqueNeeds.set(kebutuhanValue, 'autofilled');

    const keinginanTrim = (formData.keinginan || '').trim();
    const personaTrim = (formData.target_market || '').trim();
    const selectedFeature = formData.feature_name?.trim() || '';

    let matchingPKs = productKnowledgeWithWantsNeeds;
    if (keinginanTrim) {
      matchingPKs = matchingPKs.filter((pk) => (pk.wants || '').trim() === keinginanTrim);
    }
    if (selectedServiceId) {
      matchingPKs = matchingPKs.filter((pk) => pk.service_id === selectedServiceId);
    }
    if (selectedFeature) {
      matchingPKs = matchingPKs.filter((pk) => pk.feature_name?.trim() === selectedFeature);
    }
    if (personaTrim) {
      matchingPKs = matchingPKs.filter((pk) => {
        if (!pk.target_audience) return false;
        return extractTargetAudienceAsString(pk.target_audience).trim() === personaTrim;
      });
    }
    if (matchingPKs.length > 0) {
      matchingPKs.forEach((pk) => {
        if (!pk.needs) return;
        const needsValue = (pk.needs || '').replace(/\r\n/g, '\n').trim();
        if (needsValue && !uniqueNeeds.has(needsValue)) uniqueNeeds.set(needsValue, pk.id);
      });
    }
    if (uniqueNeeds.size === 0) {
      productKnowledgeWithWantsNeeds.forEach((pk) => {
        if (!pk.needs) return;
        const needsValue = pk.needs.trim();
        if (needsValue && !uniqueNeeds.has(needsValue)) uniqueNeeds.set(needsValue, pk.id);
      });
    }
    return Array.from(uniqueNeeds.keys()).map((needsValue) => ({ value: needsValue, label: needsValue }));
  }, [
    formData.target_market,
    formData.kebutuhan,
    formData.keinginan,
    formData.feature_name,
    selectedServiceId,
    productKnowledgeWithWantsNeeds,
  ]);

  // Reset Customer Insights when Customer Persona is not selected (safety net)
  useEffect(() => {
    if (!formData.target_market?.trim()) {
      setFormData((prev) => {
        const hasInsights =
          prev.keinginan ||
          prev.kebutuhan ||
          prev.hidden_needs ||
          prev.problem ||
          prev.impact ||
          prev.false_belief ||
          prev.false_belief_impact ||
          prev.what_makes_them_stop;
        if (!hasInsights) return prev;
        return {
          ...prev,
          keinginan: '',
          kebutuhan: '',
          hidden_needs: '',
          problem: '',
          impact: '',
          false_belief: '',
          false_belief_impact: '',
          what_makes_them_stop: '',
        };
      });
    }
  }, [formData.target_market]);

  // Helper function to parse hidden_needs string into array
  const parseHiddenNeeds = (hiddenNeeds: string | null | undefined): string[] => {
    const normalized = richTextToPlainText(hiddenNeeds);
    if (!normalized || normalized.trim() === '') return [];
    
    // Split by double newline first (like problems_solved format)
    if (normalized.includes('\n\n')) {
      return normalized
        .split(/\n\n+/)
        .map((item) => item.trim())
        .filter((item) => item !== '');
    }
    
    // Fallback to single newline
    return normalized
      .split('\n')
      .map((item) => item.trim())
      .filter((item) => item !== '');
  };
  
  // Helper function to parse impact string into array
  const parseImpact = (impact: string | null | undefined): string[] => {
    const normalized = richTextToPlainText(impact);
    if (!normalized || normalized.trim() === '') return [];
    
    // Split by double newline first (like problems_solved format)
    if (normalized.includes('\n\n')) {
      return normalized
        .split(/\n\n+/)
        .map((item) => item.trim())
        .filter((item) => item !== '');
    }
    
    // Fallback to single newline
    return normalized
      .split('\n')
      .map((item) => item.trim())
      .filter((item) => item !== '');
  };
  
  // Helper function to format problems array to display string
  const formatProblemsForDisplay = (problems: string[] | null | undefined): string => {
    if (!problems || problems.length === 0) return '';
    // Format dengan newline dan baris kosong di antara setiap masalah untuk pemisahan visual
    return problems.filter(Boolean).join('\n\n');
  };

  // Helper function to parse competitive_advantage (can be array or string)
  const parseCompetitiveAdvantage = (competitiveAdvantage: any): string => {
    if (!competitiveAdvantage) return '';
    
    if (typeof competitiveAdvantage === 'string') {
      return richTextToPlainText(competitiveAdvantage);
    }
    
    if (Array.isArray(competitiveAdvantage)) {
      // Format dengan newline dan baris kosong di antara setiap advantage
      return richTextToPlainText(competitiveAdvantage.filter(Boolean).join('\n\n'));
    }
    
    if (typeof competitiveAdvantage === 'object') {
      return richTextToPlainText(JSON.stringify(competitiveAdvantage));
    }
    
    return richTextToPlainText(String(competitiveAdvantage));
  };

  useEffect(() => {
    if (!masterQueryIsError || !masterQueryError) return;
    toast.error('Gagal memuat data form. Coba refresh halaman.');
  }, [masterQueryIsError, masterQueryError]);

  useEffect(() => {
    if (breakdownTableTemplateId === BREAKDOWN_TABLE_SELECT_NONE) return;
    const exists = scriptBreakdownTemplates.some((t) => t.id === breakdownTableTemplateId);
    if (!exists) {
      setBreakdownTableTemplateId(BREAKDOWN_TABLE_SELECT_NONE);
      setFormData((p) => ({ ...p, script_breakdown_table: undefined }));
    }
  }, [scriptBreakdownTemplates, breakdownTableTemplateId]);

  // Filter sub services based on selected service
  useEffect(() => {
    if (selectedServiceId && subServices.length > 0) {
      const filtered = subServices.filter(
        (ss: any) => ss.service_id === selectedServiceId && ss.name && ss.name.trim() !== ''
      );
      setFilteredSubServices(filtered);
    } else {
      setFilteredSubServices([]);
    }
  }, [selectedServiceId, subServices]);

  // Clear selected style if it doesn't match the selected content pillar
  useEffect(() => {
    if (!formData.content_pillar || !formData.style_name) {
      return;
    }
    
    // Find the selected style
    const selectedStyle = productKnowledgeStyles.find(
      (style) => style.name === formData.style_name
    );
    
    if (!selectedStyle) {
      return;
    }
    
    // Find the content pillar ID from the pillar name
    const selectedPillar = contentPillars.find(
      (pillar) => pillar.name === formData.content_pillar
    );
    
    if (!selectedPillar) {
      return;
    }
    
    // Check if style is compatible with selected pillar
    const pillarIds = selectedStyle.content_pillar_ids || [];
    const isUniversal = pillarIds.length === 0;
    const includesSelectedPillar = pillarIds.includes(selectedPillar.id);
    
    // If style is not universal and doesn't include selected pillar, clear it
    if (!isUniversal && !includesSelectedPillar) {
      setSelectedStyleName('');
      setFormData((prev) => ({
        ...prev,
        style_name: '',
        style_instruksi: '',
        structure: '',
      }));
    }
  }, [formData.content_pillar, formData.style_name, productKnowledgeStyles, contentPillars]);

  // Story Telling: masuk → default Creative; keluar → default Product Knowledge. Pillar lain tetap pakai mode yang dipilih user.
  useEffect(() => {
    const prev = prevContentPillarRef.current;
    const current = formData.content_pillar;
    prevContentPillarRef.current = current;
    const nowStory = isStoryTellingContentPillar(current);
    const wasStory = prev !== undefined && isStoryTellingContentPillar(prev);

    if (nowStory && !wasStory) {
      setStoryContextMode('creative');
      setStoryCreativeDetailId('__none__');
      setUseKeyword(false);
      setFormData((p) => ({
        ...p,
        feature_name: '',
        feature_description: '',
        solution: '',
        competitive_advantage: '',
        target_market: '',
        gender: '',
        age: '',
        buying_roles: '',
        keywords: [],
        keinginan: '',
        kebutuhan: '',
        hidden_needs: '',
        problem: '',
        impact: '',
        false_belief: '',
        false_belief_impact: '',
        what_makes_them_stop: '',
      }));
      return;
    }
    if (!nowStory && wasStory) {
      setStoryContextMode('product_knowledge');
      setStoryCreativeDetailId('__none__');
      setFormData((p) => ({
        ...p,
        target_market: '',
        keinginan: '',
        kebutuhan: '',
        hidden_needs: '',
        problem: '',
        impact: '',
        false_belief: '',
        false_belief_impact: '',
        what_makes_them_stop: '',
      }));
    }
  }, [formData.content_pillar]);

  // Creative row: reset jika baris yang dipilih tidak lagi cocok (pillar/service/sub berubah atau data refresh).
  useEffect(() => {
    if (!useCreativeContextFlow) return;
    if (storyCreativeDetailId === '__none__') return;
    const stillValid = storyCreativeDetailOptions.some((d) => d.id === storyCreativeDetailId);
    if (stillValid) return;
    setStoryCreativeDetailId('__none__');
    setFormData((prev) => ({
      ...prev,
      target_market: '',
      keinginan: '',
      kebutuhan: '',
      hidden_needs: '',
      problem: '',
      impact: '',
      false_belief: '',
      false_belief_impact: '',
      what_makes_them_stop: '',
    }));
  }, [useCreativeContextFlow, storyCreativeDetailId, storyCreativeDetailOptions]);

  const handleInputChange = (field: keyof ScriptGeneratorRequest, value: any) => {
    if (field === 'content_pillar' && storyContextMode === 'creative') {
      setStoryCreativeDetailId('__none__');
      setFormData((prev) => ({
        ...prev,
        content_pillar: value,
        target_market: '',
        keinginan: '',
        kebutuhan: '',
        hidden_needs: '',
        problem: '',
        impact: '',
        false_belief: '',
        false_belief_impact: '',
        what_makes_them_stop: '',
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Reset sub_service when service changes
    if (field === 'service_name') {
      setFormData(prev => ({
        ...prev,
        service_name: value,
        sub_service_name: ''
      }));
    }
  };

  const applyBreakdownTemplateSelection = (templateId: string) => {
    setBreakdownTableTemplateId(templateId);
    if (templateId === BREAKDOWN_TABLE_SELECT_NONE || !templateId) {
      setFormData((prev) => ({ ...prev, script_breakdown_table: undefined }));
      return;
    }
    const row = scriptBreakdownTemplates.find((r) => r.id === templateId);
    if (!row) {
      setFormData((prev) => ({ ...prev, script_breakdown_table: undefined }));
      return;
    }
    const columns = (row.script_breakdown_table_columns || []).map((c) => ({
      header_label: c.header_label,
      placeholder_example: c.placeholder_example,
      detail_body: c.detail_body,
      fill_rule: c.fill_rule,
      keyword_hint: c.keyword_hint,
    }));
    setFormData((prev) => ({
      ...prev,
      script_breakdown_table: { templateName: row.name, columns },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation: Customer Persona and Keywords are required (keywords only if useKeyword is checked)
    const newErrors: { target_market?: string; keywords?: string } = {};
    
    if (!formData.target_market || formData.target_market.trim() === '') {
      newErrors.target_market = 'Customer Persona wajib diisi';
    }
    
    // Keywords are only required if useKeyword checkbox is checked
    if (useKeyword && (!formData.keywords || formData.keywords.length === 0)) {
      newErrors.keywords = 'Keyword wajib diisi (minimal 1 keyword)';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Mohon lengkapi field yang wajib diisi');
      return;
    }
    
    // Clear errors if validation passes
    setErrors({});
    // Compute plan IDs for Save to Plan auto-fill
    const content_type_id = contentTypes.find((ct: { name: string }) => ct.name === formData.content_type)?.id ?? '';
    const service_id = selectedServiceId || '';
    const sub_service_id = filteredSubServices.find((ss: { name: string }) => ss.name === formData.sub_service_name)?.id ?? '';
    const content_pillar_id = contentPillars.find((cp: { name: string }) => cp.name === formData.content_pillar)?.id ?? '';
    // Pass useKeyword flag and plan IDs to the service
    await onGenerate(
      sanitizeScriptRequestPayload({
        ...formData,
        useKeyword,
        story_context_mode: storyContextMode,
        content_type_id,
        service_id,
        sub_service_id,
        content_pillar_id,
      }),
    );
  };

  const handleReset = () => {
    setFormData({
      content_type: '',
      service_name: '',
      sub_service_name: '',
      content_pillar: '',
      duration_minutes: undefined,
      slide: undefined,
      duration_value: undefined,
      duration_unit: 'detik',
      target_market: '',
      gender: '',
      age: '',
      buying_roles: '',
      keywords: [],
      keinginan: '',
      kebutuhan: '',
      hidden_needs: '',
      problem: '',
      impact: '',
      false_belief: '',
      false_belief_impact: '',
      what_makes_them_stop: '',
      feature_name: '',
      feature_description: '',
      competitive_advantage: '',
      solution: '',
      hook_name: '',
      hook_description: '',
      hook_content: '',
      style_name: '',
      style_instruksi: '',
      structure: '',
      judul: '',
      judul_custom: '',
      selling_approach: undefined,
      cta_type: undefined,
      script_breakdown_table: undefined,
    });
    setSelectedServiceId('');
    setSelectedHookName('');
    setSelectedStyleName('');
    setSelectedJudulTemplate('');
    setBreakdownTableTemplateId(BREAKDOWN_TABLE_SELECT_NONE);
    setUseKeyword(false);
    setStoryCreativeDetailId('__none__');
    setStoryContextMode('product_knowledge');
    setErrors({});
  };

  // Filter keywords by selected service
  const filteredKeywords = useMemo(() => {
    if (!selectedServiceId) return [];
    return keywords.filter(k => k.service_id === selectedServiceId);
  }, [keywords, selectedServiceId]);

  // Filter keywords by search query
  const searchableKeywords = useMemo(() => {
    const availableKeywords = filteredKeywords.filter(
      (kw) => !formData.keywords?.includes(kw.keyword)
    );
    
    if (!keywordSearchQuery.trim()) {
      return availableKeywords;
    }
    
    const query = keywordSearchQuery.toLowerCase();
    return availableKeywords.filter((kw) =>
      kw.keyword.toLowerCase().includes(query)
    );
  }, [filteredKeywords, formData.keywords, keywordSearchQuery]);

  // Reset search query when popover closes
  useEffect(() => {
    if (!keywordSearchOpen) {
      setKeywordSearchQuery('');
    }
  }, [keywordSearchOpen]);

  const handleAddKeyword = (keywordText: string) => {
    if (formData.keywords && formData.keywords.length >= 3) {
      toast.error('Maksimal 3 keyword');
      return;
    }
    if (formData.keywords?.includes(keywordText)) {
      toast.error('Keyword sudah ada');
      return;
    }
    setFormData(prev => ({
      ...prev,
      keywords: [...(prev.keywords || []), keywordText]
    }));
    // Clear error when keyword is added
    if (errors.keywords) {
      setErrors(prev => ({ ...prev, keywords: undefined }));
    }
  };

  const handleRemoveKeyword = (keywordToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      keywords: prev.keywords?.filter(k => k !== keywordToRemove) || []
    }));
    // Validate after removal
    const remainingKeywords = formData.keywords?.filter(k => k !== keywordToRemove) || [];
    if (remainingKeywords.length === 0 && errors.keywords) {
      setErrors(prev => ({ ...prev, keywords: 'Keyword wajib diisi (minimal 1 keyword)' }));
    } else if (remainingKeywords.length > 0 && errors.keywords) {
      setErrors(prev => ({ ...prev, keywords: undefined }));
    }
  };

  // Determine field type based on content type
  const contentTypeLower = (formData.content_type || '').toLowerCase();
  const isPostOrCarousel = contentTypeLower === 'post' || contentTypeLower === 'carousel';
  const isReelStoryYoutube = contentTypeLower === 'reel' || contentTypeLower === 'story' || contentTypeLower === 'youtube';

  const handlePersonaValueChange = (value: string) => {
    if (errors.target_market) {
      setErrors((prev) => ({ ...prev, target_market: undefined }));
    }

    if (useCreativeContextFlow) {
      if (value === '__none__') {
        setStoryCreativeDetailId('__none__');
        setFormData((prev) => ({
          ...prev,
          target_market: '',
          keinginan: '',
          kebutuhan: '',
          hidden_needs: '',
          problem: '',
          impact: '',
          false_belief: '',
          false_belief_impact: '',
          what_makes_them_stop: '',
        }));
        return;
      }
      const d = productKnowledgeDetailData.find((x) => x.id === value);
      if (!d) return;
      setStoryCreativeDetailId(value);
      setFormData((prev) => ({
        ...prev,
        target_market: buildTargetMarketFromCreativeDetail(d),
        keinginan: '',
        kebutuhan: '',
        hidden_needs: '',
        problem: '',
        impact: '',
        false_belief: '',
        false_belief_impact: '',
        what_makes_them_stop: '',
      }));
      return;
    }

    if (value === '__none__') {
      setFormData((prev) => ({
        ...prev,
        target_market: '',
        keinginan: '',
        kebutuhan: '',
        hidden_needs: '',
        problem: '',
        impact: '',
        false_belief: '',
        false_belief_impact: '',
        what_makes_them_stop: '',
      }));
      return;
    }

    const normalizePersona = (s: string) => (s || '').trim();
    const selectedFeature = formData.feature_name?.trim() || '';
    const matchingPKs = productKnowledgeData.filter((pk) => {
      if (pk.service_id !== selectedServiceId) return false;
      if (pk.feature_name?.trim() !== selectedFeature) return false;
      if (!pk.target_audience) return false;
      const pkPersonaStr = normalizePersona(extractTargetAudienceAsString(pk.target_audience));
      return pkPersonaStr === normalizePersona(value);
    });

    const matchingWithWantsNeeds = productKnowledgeWithWantsNeeds.filter((pk) => {
      if (pk.service_id !== selectedServiceId) return false;
      if (pk.feature_name?.trim() !== selectedFeature) return false;
      if (!pk.target_audience) return false;
      const pkPersonaStr = normalizePersona(extractTargetAudienceAsString(pk.target_audience));
      return pkPersonaStr === normalizePersona(value);
    });

    const selectedPK =
      matchingWithWantsNeeds.length > 0 ? matchingWithWantsNeeds[0] : matchingPKs[0];

    const updates: Partial<ScriptGeneratorRequest> = { target_market: value };

    if (matchingPKs.length > 0 && selectedPK) {
      const wantsVal = selectedPK.wants?.trim() || '';
      const rawNeeds =
        selectedPK.needs?.trim() ||
        matchingPKs.find((pk) => pk.needs?.trim())?.needs?.trim() ||
        '';
      const needsVal = rawNeeds ? rawNeeds.replace(/\r\n/g, '\n') : '';

      updates.keinginan = wantsVal;
      updates.kebutuhan = needsVal;
      updates.hidden_needs = selectedPK.hidden_needs
        ? parseHiddenNeeds(selectedPK.hidden_needs).join('\n\n') || ''
        : '';
      updates.problem =
        selectedPK.problems_solved && Array.isArray(selectedPK.problems_solved)
          ? selectedPK.problems_solved.filter(Boolean).join('\n\n')
          : '';
      updates.impact = selectedPK.impact
        ? parseImpact(selectedPK.impact).join('\n\n') || ''
        : '';
      updates.false_belief = selectedPK.false_belief?.trim() || '';
      updates.false_belief_impact = richTextToPlainText(selectedPK.false_belief_impact) || '';
      updates.what_makes_them_stop = richTextToPlainText(selectedPK.what_makes_them_stop) || '';
      updates.solution = richTextToPlainText(selectedPK.solusi) || '';
      updates.feature_name = selectedPK.feature_name?.trim() || '';
      updates.feature_description = richTextToPlainText(selectedPK.feature_description) || '';
      updates.competitive_advantage = selectedPK.competitive_advantage
        ? parseCompetitiveAdvantage(selectedPK.competitive_advantage)
        : '';
    } else {
      updates.keinginan = '';
      updates.kebutuhan = '';
      updates.hidden_needs = '';
      updates.problem = '';
      updates.impact = '';
      updates.false_belief = '';
      updates.false_belief_impact = '';
      updates.what_makes_them_stop = '';
      updates.solution = '';
      updates.feature_name = '';
      updates.feature_description = '';
      updates.competitive_advantage = '';
    }

    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleKeinginanValueChange = (value: string) => {
    handleInputChange('keinginan', value);
    const selectedPK = productKnowledgeWithWantsNeeds.find((pk) => pk.wants?.trim() === value);

    handleInputChange('kebutuhan', selectedPK?.needs?.trim() || '');
    handleInputChange('solution', selectedPK?.solusi ? richTextToPlainText(selectedPK.solusi) : '');

    if (selectedPK?.hidden_needs) {
      const hiddenNeedsArray = parseHiddenNeeds(selectedPK.hidden_needs);
      handleInputChange('hidden_needs', hiddenNeedsArray.length > 0 ? hiddenNeedsArray.join('\n\n') : '');
    } else {
      handleInputChange('hidden_needs', '');
    }

    if (selectedPK?.problems_solved && Array.isArray(selectedPK.problems_solved) && selectedPK.problems_solved.length > 0) {
      const problemsArray = selectedPK.problems_solved.filter(Boolean);
      handleInputChange('problem', problemsArray.length > 0 ? problemsArray.join('\n\n') : '');
    } else {
      handleInputChange('problem', '');
    }

    if (selectedPK?.impact) {
      const impactArray = parseImpact(selectedPK.impact);
      handleInputChange('impact', impactArray.length > 0 ? impactArray.join('\n\n') : '');
    } else {
      handleInputChange('impact', '');
    }

    handleInputChange('false_belief', selectedPK?.false_belief?.trim() || '');
    handleInputChange(
      'false_belief_impact',
      selectedPK?.false_belief_impact ? richTextToPlainText(selectedPK.false_belief_impact) : '',
    );
    handleInputChange(
      'what_makes_them_stop',
      selectedPK?.what_makes_them_stop ? richTextToPlainText(selectedPK.what_makes_them_stop) : '',
    );
    handleInputChange('feature_name', selectedPK?.feature_name?.trim() || '');
    handleInputChange(
      'feature_description',
      selectedPK?.feature_description ? richTextToPlainText(selectedPK.feature_description) : '',
    );
    handleInputChange(
      'competitive_advantage',
      selectedPK?.competitive_advantage ? parseCompetitiveAdvantage(selectedPK.competitive_advantage) : '',
    );
  };

  const renderFormSelect = (
    id: FormSelectDrawerId,
    args: {
      title: string;
      value: string;
      placeholder: string;
      options: { value: string; label: string }[];
      onSelect: (value: string) => void;
      disabled?: boolean;
      triggerClassName?: string;
      wrapLabel?: boolean;
      emptyText?: string;
      searchPlaceholder?: string;
      desktop: React.ReactNode;
    },
  ) => {
    if (!selectAsDrawer) return args.desktop;
    return (
      <DrawerSelectField
        open={openFormDrawer === id}
        onOpenChange={(open) => setOpenFormDrawer(open ? id : null)}
        title={args.title}
        value={args.value}
        placeholder={args.placeholder}
        options={args.options}
        onSelect={args.onSelect}
        disabled={args.disabled}
        triggerClassName={args.triggerClassName}
        wrapLabel={args.wrapLabel}
        emptyText={args.emptyText}
        searchPlaceholder={args.searchPlaceholder}
        overlayClassName="z-[80]"
        contentClassName="z-[80]"
      />
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {masterError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {masterError}
        </div>
      )}
      <Accordion type="single" defaultValue="basic-info" collapsible className="w-full space-y-2">
        {/* Section 1: Basic Information */}
        <AccordionItem value="basic-info" className="group border rounded-lg px-3 transition-colors data-[state=open]:bg-primary/10 data-[state=open]:border-primary/25 data-[state=closed]:bg-white data-[state=closed]:border-gray-200">
          <AccordionTrigger className="py-2 text-base font-semibold group-data-[state=closed]:text-gray-700 group-data-[state=open]:justify-end group-data-[state=closed]:justify-between">
            <span className={SCRIPT_GEN_ACCORDION_TRIGGER_TITLE_CLASS}>
              {t('scriptGenerator.form.basicInfo', 'Informasi Dasar')}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-2 pt-0">
            <div className="mb-4 overflow-hidden rounded-lg border-2 border-primary/50 shadow-sm">
              <div className="bg-primary px-4 py-2.5">
                <h4 className="text-sm font-semibold text-primary-foreground">
                  {t('scriptGenerator.form.basicInfo', 'Informasi Dasar')}
                </h4>
              </div>
              <div className="space-y-2 bg-primary/10 px-4 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Content Type — full row width when paired with Durasi (reel/story/youtube) so numeric field is not squeezed */}
              <div className={cn('space-y-1', isReelStoryYoutube && 'md:col-span-2')}>
                <Label htmlFor="content_type">Content Type</Label>
                {renderFormSelect('contentType', {
                  title: 'Content Type',
                  value: formData.content_type || '',
                  placeholder: 'Pilih Content Type',
                  triggerClassName: 'min-h-11 text-base',
                  options: contentTypes
                    .filter((type) => {
                      const name = type?.name;
                      return name && typeof name === 'string' && name.trim() !== '' && type?.id;
                    })
                    .map((type) => ({ value: String(type.name).trim(), label: type.name })),
                  onSelect: (value) => {
                    handleInputChange('content_type', value);
                    setFormData((prev) => ({
                      ...prev,
                      content_type: value,
                      slide: undefined,
                      duration_value: undefined,
                      duration_unit: 'detik',
                    }));
                  },
                  desktop: (
                <Select
                  value={formData.content_type || ""}
                  onValueChange={(value) => {
                    handleInputChange('content_type', value);
                    // Reset duration/slide when content type changes
                    setFormData(prev => ({
                      ...prev,
                      content_type: value,
                      slide: undefined,
                      duration_value: undefined,
                      duration_unit: 'detik'
                    }));
                  }}
                >
                  <SelectTrigger className="min-h-11 text-base">
                    <SelectValue placeholder="Pilih Content Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {contentTypes
                      .filter((type) => {
                        const name = type?.name;
                        return name && typeof name === 'string' && name.trim() !== '' && type?.id;
                      })
                      .map((type) => {
                        const value = String(type.name).trim();
                        return (
                          <SelectItem key={type.id} value={value}>
                            {type.name}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
                  ),
                })}
              </div>

              {/* Slide or Duration - conditional based on Content Type */}
              {isPostOrCarousel ? (
                <div className="space-y-1">
                  <Label htmlFor="slide">Slide</Label>
                  <Input
                    id="slide"
                    type="number"
                    min="1"
                    value={formData.slide || ''}
                    onChange={(e) => handleInputChange('slide', parseInt(e.target.value) || undefined)}
                    placeholder="Contoh: 5"
                    className="min-h-11 text-base"
                  />
                </div>
              ) : isReelStoryYoutube ? (
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="duration_value">Durasi</Label>
                  <div className="grid min-w-0 grid-cols-2 gap-3">
                    <Input
                      id="duration_value"
                      type="number"
                      min="1"
                      value={formData.duration_value || ''}
                      onChange={(e) => handleInputChange('duration_value', parseInt(e.target.value) || undefined)}
                      placeholder="Contoh: 60"
                      className="min-h-11 min-w-0 text-base"
                    />
                    {renderFormSelect('durationUnit', {
                      title: 'Durasi',
                      value: formData.duration_unit || 'detik',
                      placeholder: 'Detik',
                      triggerClassName: 'h-11 min-h-11 w-full min-w-0 text-base',
                      options: [
                        { value: 'menit', label: 'Menit' },
                        { value: 'detik', label: 'Detik' },
                      ],
                      onSelect: (value) => handleInputChange('duration_unit', value as 'menit' | 'detik'),
                      desktop: (
                    <Select
                      value={formData.duration_unit || 'detik'}
                      onValueChange={(value) => handleInputChange('duration_unit', value as 'menit' | 'detik')}
                    >
                      <SelectTrigger className="h-11 min-h-11 w-full min-w-0 text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="menit">Menit</SelectItem>
                        <SelectItem value="detik">Detik</SelectItem>
                      </SelectContent>
                    </Select>
                      ),
                    })}
                  </div>
                </div>
              ) : null}

              {/* Service */}
              <div className="space-y-1">
                <Label htmlFor="service_name">Service</Label>
                {renderFormSelect('service', {
                  title: 'Service',
                  value: selectedServiceId || '',
                  placeholder: 'Pilih Service',
                  triggerClassName: 'min-h-11 text-base',
                  options: services
                    .filter((service) => {
                      const id = service?.id;
                      const name = service?.name;
                      return id && name && typeof name === 'string' && name.trim() !== '' && typeof id === 'string' && id.trim() !== '';
                    })
                    .map((service) => ({ value: String(service.id).trim(), label: service.name })),
                  onSelect: (serviceId) => {
                    const selectedService = services.find((s) => s.id === serviceId);
                    setSelectedServiceId(serviceId);
                    handleInputChange('service_name', selectedService?.name || '');
                    handleInputChange('sub_service_name', '');
                    handleInputChange('target_market', '');
                    handleInputChange('keinginan', '');
                    handleInputChange('kebutuhan', '');
                    handleInputChange('hidden_needs', '');
                    handleInputChange('problem', '');
                    handleInputChange('impact', '');
                    handleInputChange('false_belief', '');
                    handleInputChange('false_belief_impact', '');
                    handleInputChange('what_makes_them_stop', '');
                    handleInputChange('keywords', []);
                    handleInputChange('feature_name', '');
                    handleInputChange('feature_description', '');
                    handleInputChange('solution', '');
                    handleInputChange('competitive_advantage', '');
                    setStoryCreativeDetailId('__none__');
                  },
                  desktop: (
                <Select
                  value={selectedServiceId || ""}
                  onValueChange={(serviceId) => {
                    const selectedService = services.find(s => s.id === serviceId);
                    setSelectedServiceId(serviceId);
                    handleInputChange('service_name', selectedService?.name || '');
                    handleInputChange('sub_service_name', ''); // Reset sub service
                    handleInputChange('target_market', ''); // Reset Customer Persona when service changes
                    handleInputChange('keinginan', ''); // Reset Customer Insights when service changes
                    handleInputChange('kebutuhan', '');
                    handleInputChange('hidden_needs', '');
                    handleInputChange('problem', '');
                    handleInputChange('impact', '');
                    handleInputChange('false_belief', '');
                    handleInputChange('false_belief_impact', '');
                    handleInputChange('what_makes_them_stop', '');
                    handleInputChange('keywords', []); // Reset keywords when service changes
                    handleInputChange('feature_name', ''); // Reset Product/Service Details when service changes
                    handleInputChange('feature_description', '');
                    handleInputChange('solution', '');
                    handleInputChange('competitive_advantage', '');
                    setStoryCreativeDetailId('__none__');
                  }}
                >
                  <SelectTrigger className="min-h-11 text-base">
                    <SelectValue placeholder="Pilih Service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services
                      .filter((service) => {
                        const id = service?.id;
                        const name = service?.name;
                        return id && name && typeof name === 'string' && name.trim() !== '' && typeof id === 'string' && id.trim() !== '';
                      })
                      .map((service) => {
                        const value = String(service.id).trim();
                        return (
                          <SelectItem key={service.id} value={value}>
                            {service.name}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
                  ),
                })}
              </div>

              {/* Sub Service */}
              <div className="space-y-1">
                <Label htmlFor="sub_service_name">Sub Service</Label>
                {renderFormSelect('subService', {
                  title: 'Sub Service',
                  value: formData.sub_service_name || '',
                  placeholder: selectedServiceId ? 'Pilih Sub Service' : 'Pilih Service dulu',
                  triggerClassName: 'min-h-11 text-base',
                  disabled: !selectedServiceId,
                  options: filteredSubServices
                    .filter((subService) => {
                      const name = subService?.name;
                      return name && typeof name === 'string' && name.trim() !== '' && subService?.id;
                    })
                    .map((subService) => ({
                      value: String(subService.name).trim(),
                      label: subService.name,
                    })),
                  onSelect: (value) => {
                    if (useCreativeContextFlow) {
                      setStoryCreativeDetailId('__none__');
                      setFormData((prev) => ({
                        ...prev,
                        sub_service_name: value,
                        target_market: '',
                        keinginan: '',
                        kebutuhan: '',
                        hidden_needs: '',
                        problem: '',
                        impact: '',
                        false_belief: '',
                        false_belief_impact: '',
                        what_makes_them_stop: '',
                      }));
                      return;
                    }
                    handleInputChange('sub_service_name', value);
                  },
                  desktop: (
                <Select
                  value={formData.sub_service_name || ""}
                  onValueChange={(value) => {
                    if (useCreativeContextFlow) {
                      setStoryCreativeDetailId('__none__');
                      setFormData((prev) => ({
                        ...prev,
                        sub_service_name: value,
                        target_market: '',
                        keinginan: '',
                        kebutuhan: '',
                        hidden_needs: '',
                        problem: '',
                        impact: '',
                        false_belief: '',
                        false_belief_impact: '',
                        what_makes_them_stop: '',
                      }));
                      return;
                    }
                    handleInputChange('sub_service_name', value);
                  }}
                  disabled={!selectedServiceId}
                >
                  <SelectTrigger className="min-h-11 text-base">
                    <SelectValue placeholder={selectedServiceId ? "Pilih Sub Service" : "Pilih Service dulu"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSubServices
                      .filter((subService) => {
                        const name = subService?.name;
                        return name && typeof name === 'string' && name.trim() !== '' && subService?.id;
                      })
                      .map((subService) => {
                        const value = String(subService.name).trim();
                        return (
                          <SelectItem key={subService.id} value={value}>
                            {subService.name}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
                  ),
                })}
              </div>

              {/* Content Pillar & Pendekatan Content - sejajar dalam satu baris, keduanya punya wrapper */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch md:col-span-2">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1 flex flex-col min-h-[72px]">
                  <Label htmlFor="content_pillar">{t('scriptGenerator.form.contentPillar', 'Content Pillar')}</Label>
                  {renderFormSelect('contentPillar', {
                    title: t('scriptGenerator.form.contentPillar', 'Content Pillar'),
                    value: formData.content_pillar || '',
                    placeholder: t('scriptGenerator.form.contentPillarPlaceholder', 'Pilih Content Pillar'),
                    triggerClassName: 'flex-1 min-h-[40px]',
                    options: contentPillars
                      .filter((pillar) => {
                        const name = pillar?.name;
                        return name && typeof name === 'string' && name.trim() !== '' && pillar?.id;
                      })
                      .map((pillar) => ({ value: String(pillar.name).trim(), label: pillar.name })),
                    onSelect: (value) => handleInputChange('content_pillar', value),
                    desktop: (
                  <Select
                    value={formData.content_pillar || ""}
                    onValueChange={(value) => handleInputChange('content_pillar', value)}
                  >
                    <SelectTrigger id="content_pillar" className="flex-1 min-h-[40px]">
                      <SelectValue placeholder={t('scriptGenerator.form.contentPillarPlaceholder', 'Pilih Content Pillar')} />
                    </SelectTrigger>
                    <SelectContent
                      className="w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-trigger-width)] border-2 border-gray-200 bg-white shadow-lg"
                      position="popper"
                    >
                      {contentPillars
                        .filter((pillar) => {
                          const name = pillar?.name;
                          return name && typeof name === 'string' && name.trim() !== '' && pillar?.id;
                        })
                        .flatMap((pillar, index) => {
                          const value = String(pillar.name).trim();
                          return [
                            index > 0 && <SelectSeparator key={`sep-${pillar.id}`} className="my-1 bg-gray-200" />,
                            <SelectItem
                              key={pillar.id}
                              value={value}
                              className={cn(
                                "break-words whitespace-normal",
                                index % 2 === 1 && "bg-gray-50/80"
                              )}
                            >
                              {pillar.name}
                            </SelectItem>
                          ];
                        }).filter(Boolean)}
                    </SelectContent>
                  </Select>
                    ),
                  })}
                </div>

                {/* Pendekatan Content - wrapper dengan warna: Tanpa Produk=hijau, Soft Selling=kuning, Hard Selling=merah */}
                {(() => {
                  const sellingApproach = formData.selling_approach;
                  const wrapperClasses = cn(
                    'rounded-lg border p-3 space-y-1 transition-colors flex flex-col min-h-[72px]',
                    sellingApproach === 'Tanpa Produk' && 'bg-green-50 border-green-200',
                    sellingApproach === 'Soft Selling' && 'bg-amber-50 border-amber-200',
                    sellingApproach === 'Hard Selling' && 'bg-red-50 border-red-200',
                    !sellingApproach && 'bg-gray-50 border-gray-200'
                  );
                  const triggerClasses = cn(
                    'min-w-0 overflow-hidden [&>span]:min-w-0 [&>span]:truncate flex-1 min-h-[40px]',
                    sellingApproach === 'Tanpa Produk' && 'border-green-300 bg-white focus:ring-green-500',
                    sellingApproach === 'Soft Selling' && 'border-amber-300 bg-white focus:ring-amber-500',
                    sellingApproach === 'Hard Selling' && 'border-red-300 bg-white focus:ring-red-500'
                  );
                  return (
                    <div className={wrapperClasses}>
                      <Label htmlFor="selling_approach">
                        {t('scriptGenerator.form.approachLabel', 'Pendekatan Content')}
                      </Label>
                      {renderFormSelect('sellingApproach', {
                        title: t('scriptGenerator.form.approachLabel', 'Pendekatan Content'),
                        value: formData.selling_approach || '',
                        placeholder: t('scriptGenerator.form.approachPlaceholder', 'Pilih Pendekatan Content'),
                        triggerClassName: triggerClasses,
                        wrapLabel: true,
                        options: [
                          {
                            value: 'Tanpa Produk',
                            label: t('scriptGenerator.form.approachTanpaProduk', 'Tanpa Produk - Tidak membahas produk sama sekali'),
                          },
                          {
                            value: 'Soft Selling',
                            label: t('scriptGenerator.form.approachSoftSelling', 'Soft Selling - Bicara produk tetapi sangat soft'),
                          },
                          {
                            value: 'Hard Selling',
                            label: t('scriptGenerator.form.approachHardSelling', 'Hard Selling - 100% bicara Produk, keunggulan dan fitur'),
                          },
                        ],
                        onSelect: (value) =>
                          handleInputChange('selling_approach', value as 'Tanpa Produk' | 'Soft Selling' | 'Hard Selling'),
                        desktop: (
                      <Select
                        value={formData.selling_approach || ""}
                        onValueChange={(value) => handleInputChange('selling_approach', value as 'Tanpa Produk' | 'Soft Selling' | 'Hard Selling')}
                      >
                        <SelectTrigger id="selling_approach" className={triggerClasses}>
                          <SelectValue placeholder={t('scriptGenerator.form.approachPlaceholder', 'Pilih Pendekatan Content')} />
                        </SelectTrigger>
                        <SelectContent
                          className="w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-trigger-width)] border-2 border-gray-200 bg-white shadow-lg"
                          position="popper"
                        >
                          <SelectItem value="Tanpa Produk" className="break-words whitespace-normal text-green-800 data-[highlighted]:bg-green-100 data-[state=checked]:bg-green-100">
                            {t('scriptGenerator.form.approachTanpaProduk', 'Tanpa Produk - Tidak membahas produk sama sekali')}
                          </SelectItem>
                          <SelectSeparator className="my-1 bg-gray-200" />
                          <SelectItem value="Soft Selling" className="break-words whitespace-normal text-amber-800 data-[highlighted]:bg-amber-100 data-[state=checked]:bg-amber-100 bg-gray-50/80">
                            {t('scriptGenerator.form.approachSoftSelling', 'Soft Selling - Bicara produk tetapi sangat soft')}
                          </SelectItem>
                          <SelectSeparator className="my-1 bg-gray-200" />
                          <SelectItem value="Hard Selling" className="break-words whitespace-normal text-red-800 data-[highlighted]:bg-red-100 data-[state=checked]:bg-red-100">
                            {t('scriptGenerator.form.approachHardSelling', 'Hard Selling - 100% bicara Produk, keunggulan dan fitur')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                        ),
                      })}
                    </div>
                  );
                })()}
              </div>

              {formData.content_pillar?.trim() ? (
                <div className="space-y-1 md:col-span-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
                  <Label htmlFor="story_context_mode">
                    {t('scriptGenerator.form.contextSource', 'Sumber konteks')}
                  </Label>
                  {renderFormSelect('storyContext', {
                    title: t('scriptGenerator.form.contextSource', 'Sumber konteks'),
                    value: storyContextMode,
                    placeholder: t('scriptGenerator.form.storyContextProductKnowledge', 'Product Knowledge'),
                    triggerClassName: 'min-h-11 text-base bg-white',
                    options: [
                      {
                        value: 'creative',
                        label: t('scriptGenerator.form.storyContextCreative', 'Creative'),
                      },
                      {
                        value: 'product_knowledge',
                        label: t('scriptGenerator.form.storyContextProductKnowledge', 'Product Knowledge'),
                      },
                    ],
                    onSelect: (v) => {
                      const next = v as 'creative' | 'product_knowledge';
                      if (next === storyContextMode) return;
                      setStoryContextMode(next);
                      if (next === 'product_knowledge') {
                        setStoryCreativeDetailId('__none__');
                        setFormData((p) => ({
                          ...p,
                          target_market: '',
                          keinginan: '',
                          kebutuhan: '',
                          hidden_needs: '',
                          problem: '',
                          impact: '',
                          false_belief: '',
                          false_belief_impact: '',
                          what_makes_them_stop: '',
                        }));
                      } else {
                        setStoryCreativeDetailId('__none__');
                        setFormData((p) => ({
                          ...p,
                          feature_name: '',
                          feature_description: '',
                          solution: '',
                          competitive_advantage: '',
                          target_market: '',
                          keinginan: '',
                          kebutuhan: '',
                          hidden_needs: '',
                          problem: '',
                          impact: '',
                          false_belief: '',
                          false_belief_impact: '',
                          what_makes_them_stop: '',
                        }));
                      }
                    },
                    desktop: (
                  <Select
                    value={storyContextMode}
                    onValueChange={(v) => {
                      const next = v as 'creative' | 'product_knowledge';
                      if (next === storyContextMode) return;
                      setStoryContextMode(next);
                      if (next === 'product_knowledge') {
                        setStoryCreativeDetailId('__none__');
                        setFormData((p) => ({
                          ...p,
                          target_market: '',
                          keinginan: '',
                          kebutuhan: '',
                          hidden_needs: '',
                          problem: '',
                          impact: '',
                          false_belief: '',
                          false_belief_impact: '',
                          what_makes_them_stop: '',
                        }));
                      } else {
                        setStoryCreativeDetailId('__none__');
                        setFormData((p) => ({
                          ...p,
                          feature_name: '',
                          feature_description: '',
                          solution: '',
                          competitive_advantage: '',
                          target_market: '',
                          keinginan: '',
                          kebutuhan: '',
                          hidden_needs: '',
                          problem: '',
                          impact: '',
                          false_belief: '',
                          false_belief_impact: '',
                          what_makes_them_stop: '',
                        }));
                      }
                    }}
                  >
                    <SelectTrigger id="story_context_mode" className="min-h-11 text-base bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="creative">
                        {t('scriptGenerator.form.storyContextCreative', 'Creative')}
                      </SelectItem>
                      <SelectItem value="product_knowledge">
                        {t('scriptGenerator.form.storyContextProductKnowledge', 'Product Knowledge')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                    ),
                  })}
                  <p className="text-xs text-muted-foreground">
                    {storyContextMode === 'creative'
                      ? t(
                          'scriptGenerator.form.storyContextCreativeHint',
                          'Product/Service Details disembunyikan; pilih baris Creative di Target Audience.',
                        )
                      : isStoryTelling
                        ? t(
                            'scriptGenerator.form.storyContextPkHint',
                            'Isi Product/Service Details dan insight seperti pillar lain; prompt Story Telling tetap memakai format narasi.',
                          )
                        : t(
                            'scriptGenerator.form.contextPkHint',
                            'Isi Product/Service Details dan insight dari Product Knowledge seperti biasa.',
                          )}
                  </p>
                </div>
              ) : null}
            </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 2: Product/Service Details (disembunyikan untuk mode Creative) */}
        {!useCreativeContextFlow && (
        <AccordionItem value="product-details" className="group border rounded-lg px-3 transition-colors data-[state=open]:bg-primary/10 data-[state=open]:border-primary/25 data-[state=closed]:bg-white data-[state=closed]:border-gray-200">
          <AccordionTrigger className="py-2 text-base font-semibold group-data-[state=closed]:text-gray-700 group-data-[state=open]:justify-end group-data-[state=closed]:justify-between">
            <span className={SCRIPT_GEN_ACCORDION_TRIGGER_TITLE_CLASS}>Product/Service Details</span>
          </AccordionTrigger>
          <AccordionContent className="pb-2 pt-0">
            <div className="mb-4 overflow-hidden rounded-lg border-2 border-primary/50 shadow-sm">
              <div className="bg-primary px-4 py-2.5">
                <h4 className="text-sm font-semibold text-primary-foreground">Product/Service Details</h4>
              </div>
              <div className="space-y-2 bg-primary/10 px-4 py-3">
              <div className="space-y-1">
                <Label htmlFor="feature_name">Feature</Label>
                {renderFormSelect('feature', {
                  title: 'Feature',
                  value: formData.feature_name?.trim() || '__none__',
                  placeholder: selectedServiceId ? 'Pilih Feature' : 'Pilih Service terlebih dahulu',
                  triggerClassName: !selectedServiceId ? 'opacity-70' : '',
                  disabled: !selectedServiceId,
                  options: [
                    { value: '__none__', label: 'Pilih Feature' },
                    ...featureOptions.map((name) => ({ value: name, label: name })),
                  ],
                  onSelect: (value) => {
                    if (value === '__need_service__' || value === '__none__' || !value) {
                      handleInputChange('feature_name', '');
                      handleInputChange('target_market', '');
                      handleInputChange('feature_description', '');
                      handleInputChange('solution', '');
                      handleInputChange('competitive_advantage', '');
                      handleInputChange('keinginan', '');
                      handleInputChange('kebutuhan', '');
                      handleInputChange('hidden_needs', '');
                      handleInputChange('problem', '');
                      handleInputChange('impact', '');
                      handleInputChange('false_belief', '');
                      handleInputChange('false_belief_impact', '');
                      handleInputChange('what_makes_them_stop', '');
                      return;
                    }
                    const selectedPK = productKnowledgeData.find(
                      (pk) =>
                        pk.service_id === selectedServiceId &&
                        pk.feature_name?.trim() === value
                    );
                    handleInputChange('target_market', '');
                    handleInputChange('keinginan', '');
                    handleInputChange('kebutuhan', '');
                    handleInputChange('hidden_needs', '');
                    handleInputChange('problem', '');
                    handleInputChange('impact', '');
                    handleInputChange('false_belief', '');
                    handleInputChange('false_belief_impact', '');
                    handleInputChange('what_makes_them_stop', '');
                    if (selectedPK) {
                      handleInputChange('feature_name', selectedPK.feature_name?.trim() || '');
                      handleInputChange('feature_description', richTextToPlainText(selectedPK.feature_description) || '');
                      handleInputChange('solution', richTextToPlainText(selectedPK.solusi) || '');
                      handleInputChange(
                        'competitive_advantage',
                        selectedPK.competitive_advantage
                          ? parseCompetitiveAdvantage(selectedPK.competitive_advantage)
                          : ''
                      );
                    }
                  },
                  desktop: (
                <Select
                  value={!selectedServiceId ? '__need_service__' : (formData.feature_name?.trim() || '__none__')}
                  onValueChange={(value) => {
                    if (value === '__need_service__' || value === '__none__' || !value) {
                      handleInputChange('feature_name', '');
                      handleInputChange('target_market', '');
                      handleInputChange('feature_description', '');
                      handleInputChange('solution', '');
                      handleInputChange('competitive_advantage', '');
                      handleInputChange('keinginan', '');
                      handleInputChange('kebutuhan', '');
                      handleInputChange('hidden_needs', '');
                      handleInputChange('problem', '');
                      handleInputChange('impact', '');
                      handleInputChange('false_belief', '');
                      handleInputChange('false_belief_impact', '');
                      handleInputChange('what_makes_them_stop', '');
                      return;
                    }
                    const selectedPK = productKnowledgeData.find(
                      (pk) =>
                        pk.service_id === selectedServiceId &&
                        pk.feature_name?.trim() === value
                    );
                    handleInputChange('target_market', ''); // Reset Customer Persona when Feature changes
                    handleInputChange('keinginan', ''); // Reset Customer Insights when Feature changes
                    handleInputChange('kebutuhan', '');
                    handleInputChange('hidden_needs', '');
                    handleInputChange('problem', '');
                    handleInputChange('impact', '');
                    handleInputChange('false_belief', '');
                    handleInputChange('false_belief_impact', '');
                    handleInputChange('what_makes_them_stop', '');
                    if (selectedPK) {
                      handleInputChange('feature_name', selectedPK.feature_name?.trim() || '');
                      handleInputChange('feature_description', richTextToPlainText(selectedPK.feature_description) || '');
                      handleInputChange('solution', richTextToPlainText(selectedPK.solusi) || '');
                      handleInputChange(
                        'competitive_advantage',
                        selectedPK.competitive_advantage
                          ? parseCompetitiveAdvantage(selectedPK.competitive_advantage)
                          : ''
                      );
                    }
                  }}
                  disabled={!selectedServiceId}
                >
                  <SelectTrigger className={!selectedServiceId ? 'opacity-70' : ''}>
                    <SelectValue placeholder="Pilih Feature" />
                  </SelectTrigger>
                  <SelectContent>
                    {!selectedServiceId && (
                      <SelectItem value="__need_service__">Pilih Service terlebih dahulu</SelectItem>
                    )}
                    <SelectItem value="__none__">Pilih Feature</SelectItem>
                    {featureOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                  ),
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="feature_description">Feature Description</Label>
                  <Textarea
                    id="feature_description"
                    value={formData.feature_description || ''}
                    onChange={(e) => handleInputChange('feature_description', e.target.value)}
                    placeholder="Deskripsi detail fitur produk/layanan"
                    rows={3}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="solution">Solution</Label>
                  <Textarea
                    id="solution"
                    value={formData.solution || ''}
                    onChange={(e) => handleInputChange('solution', e.target.value)}
                    placeholder="Solusi yang ditawarkan"
                    rows={3}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="competitive_advantage">Competitive Advantage</Label>
                <Textarea
                  id="competitive_advantage"
                  value={formData.competitive_advantage || ''}
                  onChange={(e) => handleInputChange('competitive_advantage', e.target.value)}
                  placeholder="Keunggulan kompetitif produk/layanan"
                  rows={3}
                />
              </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
        )}

        {/* Section 3: Target Audience & Customer Insights (combined - lihat insight saat persona dipilih) */}
        <AccordionItem value="target-audience" className="border rounded-lg px-3 transition-colors data-[state=open]:bg-primary/10 data-[state=open]:border-primary/25 data-[state=closed]:bg-white data-[state=closed]:border-gray-200">
          <AccordionTrigger className="py-2 text-base font-semibold data-[state=open]:text-primary data-[state=closed]:text-gray-700">
            Target Audience & Customer Insights
          </AccordionTrigger>
          <AccordionContent className="pb-2 pt-0">
            {/* Target Audience — brand (bar primary + area isi) */}
            <div className="mb-4 overflow-hidden rounded-lg border-2 border-primary/50 shadow-sm">
              <div className="bg-primary px-4 py-2.5">
                <h4 className="text-sm font-semibold text-primary-foreground">Target Audience</h4>
              </div>
              <div className="space-y-2 bg-primary/10 px-4 py-3">
              <div className={cn('grid grid-cols-1 gap-3', !useCreativeContextFlow && 'md:grid-cols-2')}>
              {/* Customer Persona / pemilih baris Creative (mode Creative) */}
              <div className="space-y-1">
                <Label htmlFor="target_market">
                  Customer Persona <span className="text-red-500">*</span>
                </Label>
                {renderFormSelect('persona', {
                  title: useCreativeContextFlow ? 'Creative' : 'Customer Persona',
                  value: useCreativeContextFlow
                    ? storyCreativeDetailId || '__none__'
                    : formData.target_market?.trim() || '__none__',
                  placeholder: useCreativeContextFlow
                    ? !selectedServiceId
                      ? 'Pilih Service terlebih dahulu'
                      : !selectedFormContentPillarId
                        ? 'Pilih Content Pillar terlebih dahulu'
                        : storyCreativeDetailOptions.length === 0
                          ? 'Tidak ada baris Creative untuk pillar & layanan ini'
                          : 'Pilih baris Creative (Target market)'
                    : !selectedServiceId
                      ? 'Pilih Service terlebih dahulu'
                      : !formData.feature_name?.trim()
                        ? 'Pilih Feature terlebih dahulu'
                        : customerPersonas.length === 0
                          ? 'Tidak ada Customer Persona untuk Feature ini'
                          : 'Pilih Customer Persona',
                  triggerClassName: cn(
                    'min-w-0 overflow-hidden',
                    (useCreativeContextFlow
                      ? !selectedServiceId || !selectedFormContentPillarId
                      : !selectedServiceId || !formData.feature_name?.trim()) && 'opacity-70',
                    errors.target_market && 'border-red-500',
                  ),
                  wrapLabel: true,
                  disabled: useCreativeContextFlow
                    ? !selectedServiceId || !selectedFormContentPillarId
                    : !selectedServiceId || !formData.feature_name?.trim(),
                  emptyText: useCreativeContextFlow
                    ? 'Tidak ada baris Creative untuk pillar & layanan ini'
                    : 'Tidak ada Customer Persona untuk Feature ini',
                  options: useCreativeContextFlow
                    ? [
                        { value: '__none__', label: 'Pilih baris Creative' },
                        ...storyCreativeDetailOptions.map((row) => {
                          const label =
                            row.title?.trim() ||
                            richTextToPlainText(row.product_knowledge_content).slice(0, 80) ||
                            row.id;
                          return { value: row.id, label };
                        }),
                      ]
                    : [
                        { value: '__none__', label: 'Pilih Customer Persona' },
                        ...customerPersonas.map((persona) => ({ value: persona, label: persona })),
                      ],
                  onSelect: handlePersonaValueChange,
                  desktop: (
                <Select
                  value={
                    useCreativeContextFlow
                      ? storyCreativeDetailId || '__none__'
                      : formData.target_market?.trim() || '__none__'
                  }
                  onValueChange={handlePersonaValueChange}
                  disabled={
                    useCreativeContextFlow
                      ? !selectedServiceId || !selectedFormContentPillarId
                      : !selectedServiceId || !formData.feature_name?.trim()
                  }
                >
                  <SelectTrigger
                    className={cn(
                      'min-w-0 overflow-hidden [&>span]:min-w-0 [&>span]:truncate',
                      (useCreativeContextFlow
                        ? !selectedServiceId || !selectedFormContentPillarId
                        : !selectedServiceId || !formData.feature_name?.trim()) && 'opacity-70',
                      errors.target_market && 'border-red-500'
                    )}
                  >
                    <SelectValue
                      placeholder={
                        useCreativeContextFlow
                          ? !selectedServiceId
                            ? 'Pilih Service terlebih dahulu'
                            : !selectedFormContentPillarId
                              ? 'Pilih Content Pillar terlebih dahulu'
                            : storyCreativeDetailOptions.length === 0
                              ? 'Tidak ada baris Creative untuk pillar & layanan ini'
                              : 'Pilih baris Creative (Target market)'
                          : !selectedServiceId
                            ? 'Pilih Service terlebih dahulu'
                            : !formData.feature_name?.trim()
                              ? 'Pilih Feature terlebih dahulu'
                              : customerPersonas.length === 0
                                ? 'Tidak ada Customer Persona untuk Feature ini'
                                : 'Pilih Customer Persona'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent
                    className="max-w-[var(--radix-select-trigger-width)] w-[var(--radix-select-trigger-width)]"
                    position="popper"
                  >
                    {useCreativeContextFlow ? (
                      !selectedServiceId ? (
                        <SelectItem value="select-service-first" disabled>
                          Pilih Service terlebih dahulu
                        </SelectItem>
                      ) : !selectedFormContentPillarId ? (
                        <SelectItem value="select-pillar-first" disabled>
                          Pilih Content Pillar terlebih dahulu
                        </SelectItem>
                      ) : storyCreativeDetailOptions.length === 0 ? (
                        <SelectItem value="no-creative" disabled>
                          Tidak ada baris Creative untuk pillar & layanan ini
                        </SelectItem>
                      ) : (
                        <>
                          <SelectItem value="__none__">Pilih baris Creative</SelectItem>
                          {storyCreativeDetailOptions.map((row) => {
                            const label =
                              row.title?.trim() ||
                              richTextToPlainText(row.product_knowledge_content).slice(0, 80) ||
                              row.id;
                            return (
                              <SelectItem
                                key={row.id}
                                value={row.id}
                                className="break-words whitespace-normal items-start py-2"
                              >
                                <span className="line-clamp-3 block break-words" title={label}>
                                  {label}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </>
                      )
                    ) : !selectedServiceId ? (
                      <SelectItem value="select-service-first" disabled>
                        Pilih Service terlebih dahulu
                      </SelectItem>
                    ) : !formData.feature_name?.trim() ? (
                      <SelectItem value="select-feature-first" disabled>
                        Pilih Feature terlebih dahulu
                      </SelectItem>
                    ) : customerPersonas.length === 0 ? (
                      <SelectItem value="no-data" disabled>
                        Tidak ada Customer Persona untuk Feature ini
                      </SelectItem>
                    ) : (
                      <>
                        <SelectItem value="__none__">Pilih Customer Persona</SelectItem>
                        {customerPersonas.map((persona, index) => (
                          <SelectItem
                            key={index}
                            value={persona}
                            className="break-words whitespace-normal items-start py-2"
                          >
                            <span className="line-clamp-3 block break-words" title={persona}>
                              {persona}
                            </span>
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
                  ),
                })}
                {errors.target_market && (
                  <p className="text-sm text-red-500 mt-1">{errors.target_market}</p>
                )}
              </div>

              {!useCreativeContextFlow && (
              <>
              {/* Gender */}
              <div className="space-y-1">
                <Label htmlFor="gender">Gender</Label>
                {renderFormSelect('gender', {
                  title: 'Gender',
                  value: formData.gender || '',
                  placeholder: 'Pilih Gender',
                  options: [
                    { value: 'Laki-laki', label: 'Laki-laki' },
                    { value: 'Perempuan', label: 'Perempuan' },
                    { value: 'Semua', label: 'Semua' },
                  ],
                  onSelect: (value) => handleInputChange('gender', value),
                  desktop: (
                <Select
                  value={formData.gender || ""}
                  onValueChange={(value) => handleInputChange('gender', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Gender" />
                  </SelectTrigger>
                  <SelectContent
                    className="w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-trigger-width)] border-2 border-gray-200 bg-white shadow-lg"
                    position="popper"
                  >
                    <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                    <SelectSeparator className="my-1 bg-gray-200" />
                    <SelectItem value="Perempuan" className="bg-gray-50/80">Perempuan</SelectItem>
                    <SelectSeparator className="my-1 bg-gray-200" />
                    <SelectItem value="Semua">Semua</SelectItem>
                  </SelectContent>
                </Select>
                  ),
                })}
              </div>

              {/* Age */}
              <div className="space-y-1">
                <Label htmlFor="age">Umur</Label>
                <Input
                  id="age"
                  value={formData.age || ''}
                  onChange={(e) => handleInputChange('age', e.target.value)}
                  placeholder="Contoh: 25-40 tahun"
                />
              </div>

              {/* Buying Roles */}
              <div className="space-y-1">
                <Label htmlFor="buying_roles">Buying Roles</Label>
                <Input
                  id="buying_roles"
                  value={formData.buying_roles || ''}
                  onChange={(e) => handleInputChange('buying_roles', e.target.value)}
                  placeholder="Contoh: Decision Maker, Influencer"
                />
              </div>

              {/* Keywords - Full width */}
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="keywords" className="cursor-pointer">
                    Keyword (Maksimal 3)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="use-keyword"
                      checked={useKeyword}
                      onCheckedChange={(checked) => {
                        setUseKeyword(checked === true);
                        // Clear keywords error when checkbox is unchecked
                        if (!checked && errors.keywords) {
                          setErrors(prev => ({ ...prev, keywords: undefined }));
                        }
                        // Validate when checkbox is checked
                        if (checked && (!formData.keywords || formData.keywords.length === 0)) {
                          setErrors(prev => ({ ...prev, keywords: 'Keyword wajib diisi (minimal 1 keyword)' }));
                        }
                      }}
                    />
                    <Label htmlFor="use-keyword" className="text-sm font-normal cursor-pointer">
                      Gunakan Keyword
                    </Label>
                  </div>
                  {useKeyword && <span className="text-red-500">*</span>}
                </div>
                {renderFormSelect('keywords', {
                  title: 'Keyword',
                  value: '',
                  placeholder: !useKeyword
                    ? 'Aktifkan checkbox untuk menggunakan keyword'
                    : !selectedServiceId
                      ? 'Pilih Service terlebih dahulu'
                      : formData.keywords && formData.keywords.length >= 3
                        ? 'Maksimal 3 keyword sudah tercapai'
                        : 'Pilih Keyword',
                  triggerClassName: errors.keywords ? 'border-red-500' : '',
                  disabled: !useKeyword || !selectedServiceId || (formData.keywords && formData.keywords.length >= 3),
                  searchPlaceholder: 'Cari keyword...',
                  emptyText: !selectedServiceId
                    ? 'Pilih Service terlebih dahulu'
                    : 'Tidak ada keyword tersedia untuk Service ini',
                  options: filteredKeywords
                    .filter((kw) => !formData.keywords?.includes(kw.keyword))
                    .map((kw) => ({ value: kw.keyword, label: kw.keyword })),
                  onSelect: (keyword) => handleAddKeyword(keyword),
                  desktop: (
                <Popover open={keywordSearchOpen} onOpenChange={setKeywordSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="keywords"
                      variant="outline"
                      role="combobox"
                      aria-expanded={keywordSearchOpen}
                      className={`w-full justify-between ${errors.keywords ? 'border-red-500' : ''}`}
                      disabled={!useKeyword || !selectedServiceId || (formData.keywords && formData.keywords.length >= 3)}
                    >
                      {!useKeyword
                        ? "Aktifkan checkbox untuk menggunakan keyword"
                        : !selectedServiceId
                        ? "Pilih Service terlebih dahulu"
                        : formData.keywords && formData.keywords.length >= 3
                        ? "Maksimal 3 keyword sudah tercapai"
                        : "Pilih Keyword"}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Cari keyword..."
                        value={keywordSearchQuery}
                        onValueChange={setKeywordSearchQuery}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {!selectedServiceId
                            ? "Pilih Service terlebih dahulu"
                            : filteredKeywords.length === 0
                            ? "Tidak ada keyword tersedia untuk Service ini"
                            : "Keyword tidak ditemukan"}
                        </CommandEmpty>
                        <CommandGroup>
                          {searchableKeywords.map((kw) => (
                            <CommandItem
                              key={kw.id}
                              value={kw.keyword}
                              onSelect={() => {
                                handleAddKeyword(kw.keyword);
                                setKeywordSearchQuery('');
                                setKeywordSearchOpen(false);
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  formData.keywords?.includes(kw.keyword)
                                    ? 'opacity-100'
                                    : 'opacity-0'
                                }`}
                              />
                              {kw.keyword}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                  ),
                })}
                {formData.keywords && formData.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.keywords.map((keyword, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-sm text-primary"
                      >
                        <span>{keyword}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyword(keyword)}
                          className="ml-1 rounded-full p-0.5 hover:bg-primary/25"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {formData.keywords && formData.keywords.length >= 3 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Maksimal 3 keyword sudah tercapai
                  </p>
                )}
                {useKeyword && !selectedServiceId && (
                  <p className="text-xs text-gray-500 mt-1">
                    Pilih Service terlebih dahulu untuk memilih keyword
                  </p>
                )}
                {errors.keywords && (
                  <p className="text-sm text-red-500 mt-1">{errors.keywords}</p>
                )}
              </div>
              </>
              )}

              {useCreativeContextFlow && selectedStoryCreativeDetail ? (
                <div className="space-y-3 md:col-span-2">
                  {selectedStoryCreativeDetail.title?.trim() ? (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-800">
                        {t('productKnowledge.detail.title', 'Target Market')}
                      </h3>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <p className="text-sm font-medium text-gray-900">
                          {selectedStoryCreativeDetail.title.trim()}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {selectedStoryCreativeDetail.perspective?.trim() ? (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-800">
                        {t('productKnowledge.detail.perspective', 'Dari Perspective')}
                      </h3>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <p className="whitespace-pre-wrap break-words text-sm text-gray-800">
                          {richTextToPlainText(selectedStoryCreativeDetail.perspective)}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-800">
                        {t('productKnowledge.detail.content', 'Creative Content')}
                      </h3>
                      {selectedStoryCreativeDetail.product_knowledge_content ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          title={t('productKnowledgeDetail.copy', 'Copy content')}
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                selectedStoryCreativeDetail.product_knowledge_content || ''
                              );
                              toast.success(
                                t(
                                  'productKnowledgeDetail.toast.copySuccess',
                                  'Content copied to clipboard'
                                )
                              );
                            } catch {
                              toast.error(
                                t('productKnowledgeDetail.toast.copyError', 'Error copying content')
                              );
                            }
                          }}
                        >
                          <Copy className="mr-1.5 h-3.5 w-3.5" />
                          {t('productKnowledgeDetail.copy', 'Copy')}
                        </Button>
                      ) : null}
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p
                        className="whitespace-pre-wrap break-words text-sm text-gray-700"
                        style={{ wordBreak: 'break-word' }}
                      >
                        {richTextToPlainText(selectedStoryCreativeDetail.product_knowledge_content) ||
                          t('productKnowledge.detail.noContent', 'No content available')}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              </div>
              </div>
            </div>

            {!useCreativeContextFlow && (
            <>
            {/* Customer Insights — pola sama: bar primary + area isi */}
            <div className="overflow-hidden rounded-lg border-2 border-primary/50 shadow-sm">
              <div className="bg-primary px-4 py-2.5">
                <h4 className="text-sm font-semibold text-primary-foreground">Customer Insights</h4>
              </div>
              <div className="space-y-2 bg-primary/15 px-4 py-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="keinginan">Keinginan</Label>
                  {renderFormSelect('keinginan', {
                    title: 'Keinginan',
                    value: formData.keinginan || '',
                    placeholder: formData.target_market?.trim()
                      ? 'Pilih Keinginan dari Creative'
                      : 'Pilih Customer Persona terlebih dahulu',
                    triggerClassName: cn(
                      'min-w-0',
                      !formData.target_market?.trim() && 'bg-gray-100 opacity-70',
                    ),
                    wrapLabel: true,
                    disabled: !formData.target_market?.trim(),
                    emptyText: 'Tidak ada data Creative dengan Wants dan Needs',
                    options: productKnowledgeWithWantsNeeds
                      .filter((pk) => pk.wants && pk.wants.trim() !== '')
                      .map((pk) => ({ value: pk.wants!.trim(), label: pk.wants!.trim() })),
                    onSelect: handleKeinginanValueChange,
                    desktop: (
                  <Select
                    value={formData.keinginan || ""}
                    disabled={!formData.target_market?.trim()}
                    onValueChange={handleKeinginanValueChange}
                  >
                    <SelectTrigger className={cn(
                      'min-w-0 overflow-hidden [&>span]:min-w-0 [&>span]:truncate',
                      !formData.target_market?.trim() && 'bg-gray-100 opacity-70'
                    )}>
                      <SelectValue placeholder={formData.target_market?.trim() ? "Pilih Keinginan dari Creative" : "Pilih Customer Persona terlebih dahulu"} />
                    </SelectTrigger>
                    <SelectContent
                      className="max-w-[var(--radix-select-trigger-width)] w-[var(--radix-select-trigger-width)]"
                      position="popper"
                    >
                      {productKnowledgeWithWantsNeeds.length === 0 ? (
                        <SelectItem value="no-data" disabled>
                          Tidak ada data Creative dengan Wants dan Needs
                        </SelectItem>
                      ) : (
                        productKnowledgeWithWantsNeeds
                          .filter((pk) => pk.wants && pk.wants.trim() !== '')
                          .map((pk) => {
                            const wantsValue = pk.wants!.trim();
                            return (
                              <SelectItem
                                key={pk.id}
                                value={wantsValue}
                                className="break-words whitespace-normal items-start py-2"
                              >
                                <span className="block break-words line-clamp-3" title={wantsValue}>
                                  {wantsValue}
                                </span>
                              </SelectItem>
                            );
                          })
                      )}
                    </SelectContent>
                  </Select>
                    ),
                  })}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="kebutuhan">Kebutuhan</Label>
                  {renderFormSelect('kebutuhan', {
                    title: 'Kebutuhan',
                    value: formData.kebutuhan || '',
                    placeholder: formData.target_market?.trim()
                      ? formData.kebutuhan
                        ? formData.kebutuhan
                        : 'Pilih Kebutuhan'
                      : 'Pilih Customer Persona terlebih dahulu',
                    triggerClassName: cn(
                      'min-w-0',
                      !formData.target_market?.trim() && 'bg-gray-100 opacity-70',
                    ),
                    wrapLabel: true,
                    disabled: !formData.target_market?.trim(),
                    emptyText: 'Pilih Keinginan atau Customer Persona terlebih dahulu',
                    options: kebutuhanSelectOptions,
                    onSelect: (value) => handleInputChange('kebutuhan', value),
                    desktop: (
                  <Select
                    value={formData.kebutuhan || ""}
                    onValueChange={(value) => handleInputChange('kebutuhan', value)}
                    disabled={!formData.target_market?.trim()}
                  >
                    <SelectTrigger className={cn(
                      'min-w-0 overflow-hidden [&>span]:min-w-0 [&>span]:truncate',
                      !formData.target_market?.trim() && 'bg-gray-100 opacity-70'
                    )}>
                      <SelectValue placeholder={formData.target_market?.trim() ? (formData.kebutuhan ? "" : "Pilih Kebutuhan") : "Pilih Customer Persona terlebih dahulu"} />
                    </SelectTrigger>
                    <SelectContent
                      className="max-w-[var(--radix-select-trigger-width)] w-[var(--radix-select-trigger-width)]"
                      position="popper"
                    >
                      {formData.target_market?.trim() ? (
                        // Show needs: from wants match, or from Customer Persona match when target_market is set
                        (() => {
                          const keinginanTrim = (formData.keinginan || '').trim();
                          const personaTrim = (formData.target_market || '').trim();
                          const selectedFeature = formData.feature_name?.trim() || '';
                          
                          const uniqueNeeds = new Map<string, string>();
                          
                          // CRITICAL: Add auto-filled kebutuhan FIRST so it's always available as SelectItem
                          // Radix Select requires value to match a SelectItem - without this, auto-fill won't display
                          const kebutuhanValue = (formData.kebutuhan || '').replace(/\r\n/g, '\n').trim();
                          if (kebutuhanValue) {
                            uniqueNeeds.set(kebutuhanValue, 'autofilled');
                          }
                          
                          let matchingPKs = productKnowledgeWithWantsNeeds;
                          
                          if (keinginanTrim) {
                            matchingPKs = matchingPKs.filter(
                              (pk) => (pk.wants || '').trim() === keinginanTrim
                            );
                          }
                          
                          if (selectedServiceId) {
                            matchingPKs = matchingPKs.filter(
                              (pk) => pk.service_id === selectedServiceId
                            );
                          }
                          if (selectedFeature) {
                            matchingPKs = matchingPKs.filter(
                              (pk) => pk.feature_name?.trim() === selectedFeature
                            );
                          }
                          
                          if (personaTrim) {
                            const normalizePersona = (s: string) => (s || '').trim();
                            matchingPKs = matchingPKs.filter((pk) => {
                              if (!pk.target_audience) return false;
                              const pkPersonaStr = normalizePersona(extractTargetAudienceAsString(pk.target_audience));
                              return pkPersonaStr === normalizePersona(personaTrim);
                            });
                          }
                          
                          if (matchingPKs.length > 0) {
                            matchingPKs.forEach((pk) => {
                              if (pk.needs) {
                                const needsValue = (pk.needs || '').replace(/\r\n/g, '\n').trim();
                                if (needsValue && !uniqueNeeds.has(needsValue)) {
                                  uniqueNeeds.set(needsValue, pk.id);
                                }
                              }
                            });
                          }
                          
                          if (uniqueNeeds.size === 0) {
                            productKnowledgeWithWantsNeeds.forEach((pk) => {
                              if (pk.needs) {
                                const needsValue = pk.needs.trim();
                                if (needsValue && !uniqueNeeds.has(needsValue)) {
                                  uniqueNeeds.set(needsValue, pk.id);
                                }
                              }
                            });
                          }
                          
                          return Array.from(uniqueNeeds.entries()).map(([needsValue, pkId]) => (
                            <SelectItem
                              key={pkId}
                              value={needsValue}
                              className="break-words whitespace-normal items-start py-2"
                            >
                              <span className="block break-words line-clamp-3" title={needsValue}>
                                {needsValue}
                              </span>
                            </SelectItem>
                          ));
                        })()
                      ) : (
                        <SelectItem value="select-wants-first" disabled>
                          Pilih Keinginan atau Customer Persona terlebih dahulu
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                    ),
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="hidden_needs">Hidden Needs</Label>
                <Textarea
                  id="hidden_needs"
                  value={formData.hidden_needs || ''}
                  onChange={(e) => handleInputChange('hidden_needs', e.target.value)}
                  placeholder={formData.target_market?.trim() ? "Kebutuhan tersembunyi (pisahkan dengan baris kosong untuk multiple needs)" : "Pilih Customer Persona terlebih dahulu"}
                  rows={4}
                  disabled={!formData.target_market?.trim()}
                  className={cn(!formData.target_market?.trim() && 'bg-gray-100 opacity-70')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="problem">Problem</Label>
                  <Textarea
                    id="problem"
                    value={formData.problem || ''}
                    onChange={(e) => handleInputChange('problem', e.target.value)}
                    placeholder={formData.target_market?.trim() ? "Masalah yang dihadapi (pisahkan dengan baris kosong untuk multiple problems)" : "Pilih Customer Persona terlebih dahulu"}
                    rows={4}
                    disabled={!formData.target_market?.trim()}
                    className={cn(!formData.target_market?.trim() && 'bg-gray-100 opacity-70')}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="impact">Impact</Label>
                  <Textarea
                    id="impact"
                    value={formData.impact || ''}
                    onChange={(e) => handleInputChange('impact', e.target.value)}
                    placeholder={formData.target_market?.trim() ? "Dampak dari masalah (pisahkan dengan baris kosong untuk multiple impacts)" : "Pilih Customer Persona terlebih dahulu"}
                    rows={4}
                    disabled={!formData.target_market?.trim()}
                    className={cn(!formData.target_market?.trim() && 'bg-gray-100 opacity-70')}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 border border-muted">
                  {t('scriptGenerator.form.falseBeliefTip', 'Tip: Yang dianggap enteng bikin orang nggak waspada → nggak ada pencegahan → masalah makin gede. Pakai bahasa casual dan relatable.')}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="false_belief">{t('scriptGenerator.form.falseBeliefLabel', 'Yang suka dianggap enteng')}</Label>
                  <Textarea
                    id="false_belief"
                    value={formData.false_belief || ''}
                    onChange={(e) => handleInputChange('false_belief', e.target.value)}
                    placeholder={formData.target_market?.trim() ? t('scriptGenerator.form.falseBeliefPlaceholder', 'Contoh: anggap sepele, nggak perlu buru-buru, kayaknya aman-aman aja...') : t('scriptGenerator.form.selectPersonaFirst', 'Pilih Customer Persona terlebih dahulu')}
                    rows={2}
                    disabled={!formData.target_market?.trim()}
                    className={cn(!formData.target_market?.trim() && 'bg-gray-100 opacity-70')}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="false_belief_impact">{t('scriptGenerator.form.falseBeliefImpactLabel', 'Dampaknya kalau dianggap enteng')}</Label>
                  <Textarea
                    id="false_belief_impact"
                    value={formData.false_belief_impact || ''}
                    onChange={(e) => handleInputChange('false_belief_impact', e.target.value)}
                    placeholder={formData.target_market?.trim() ? t('scriptGenerator.form.falseBeliefImpactPlaceholder', 'Contoh: baru sadar pas udah parah, keluar duit lebih banyak, reputasi kena...') : t('scriptGenerator.form.selectPersonaFirst', 'Pilih Customer Persona terlebih dahulu')}
                    rows={2}
                    disabled={!formData.target_market?.trim()}
                    className={cn(!formData.target_market?.trim() && 'bg-gray-100 opacity-70')}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="what_makes_them_stop">What Makes Them Stop?</Label>
                <Textarea
                  id="what_makes_them_stop"
                  value={formData.what_makes_them_stop || ''}
                  onChange={(e) => handleInputChange('what_makes_them_stop', e.target.value)}
                  placeholder={formData.target_market?.trim() ? "Apa yang membuat pelanggan berhenti atau ragu-ragu" : "Pilih Customer Persona terlebih dahulu"}
                  rows={2}
                  disabled={!formData.target_market?.trim()}
                  className={cn(!formData.target_market?.trim() && 'bg-gray-100 opacity-70')}
                />
              </div>
              </div>
            </div>
            </>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Section 4: Content Structure */}
        <AccordionItem value="content-structure" className="group border rounded-lg px-3 transition-colors data-[state=open]:bg-primary/10 data-[state=open]:border-primary/25 data-[state=closed]:bg-white data-[state=closed]:border-gray-200">
          <AccordionTrigger className="py-2 text-base font-semibold group-data-[state=closed]:text-gray-700 group-data-[state=open]:justify-end group-data-[state=closed]:justify-between">
            <span className={SCRIPT_GEN_ACCORDION_TRIGGER_TITLE_CLASS}>Content Structure</span>
          </AccordionTrigger>
          <AccordionContent className="pb-2 pt-0">
            <div className="mb-4 overflow-hidden rounded-lg border-2 border-primary/50 shadow-sm">
              <div className="bg-primary px-4 py-2.5">
                <h4 className="text-sm font-semibold text-primary-foreground">Content Structure</h4>
              </div>
              <div className="space-y-2 bg-primary/10 px-4 py-3">
              <div className="space-y-1">
                <Label htmlFor="script_breakdown_table_template">Template tabel breakdown</Label>
                {renderFormSelect('breakdown', {
                  title: 'Template tabel breakdown',
                  value: breakdownTableTemplateId,
                  placeholder: 'Tanpa template tabel',
                  disabled: !organizationId || scriptBreakdownTemplates.length === 0,
                  wrapLabel: true,
                  options: [
                    { value: BREAKDOWN_TABLE_SELECT_NONE, label: 'Tanpa template tabel' },
                    ...scriptBreakdownTemplates.map((tpl) => ({ value: tpl.id, label: tpl.name })),
                  ],
                  onSelect: (value) => applyBreakdownTemplateSelection(value),
                  desktop: (
                <Select
                  value={breakdownTableTemplateId}
                  onValueChange={(value) => applyBreakdownTemplateSelection(value)}
                  disabled={!organizationId || scriptBreakdownTemplates.length === 0}
                >
                  <SelectTrigger id="script_breakdown_table_template">
                    <SelectValue placeholder="Tanpa template tabel" />
                  </SelectTrigger>
                  <SelectContent
                    className="w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-trigger-width)] border-2 border-gray-200 bg-white shadow-lg"
                    position="popper"
                  >
                    <SelectItem value={BREAKDOWN_TABLE_SELECT_NONE} className="break-words whitespace-normal">
                      Tanpa template tabel
                    </SelectItem>
                    {scriptBreakdownTemplates.length > 0 ? <SelectSeparator className="my-1 bg-gray-200" /> : null}
                    {scriptBreakdownTemplates.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id} className="break-words whitespace-normal">
                        {tpl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                  ),
                })}
                <p className="text-xs text-muted-foreground">
                  Opsional. Jika dipilih, prompt memakai kolom ini untuk blok ## FORMAT TABLE ##. Durasi breakdown:
                  video mengikuti durasi konten; selain video mengikuti field durasi (menit/detik) bila diisi, atau default{' '}
                  <span className="font-medium">60 detik</span>.
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="hook_name">Hook Name</Label>
                {renderFormSelect('hook', {
                  title: 'Hook Name',
                  value:
                    (selectedHookName || formData.hook_name || '').trim()
                      ? selectedHookName || formData.hook_name || ''
                      : HOOK_NAME_SELECT_NONE,
                  placeholder: 'Pilih Hook Name',
                  wrapLabel: true,
                  emptyText: 'Tidak ada template Hook di Product Knowledge',
                  options: [
                    { value: HOOK_NAME_SELECT_NONE, label: 'Tanpa hook' },
                    ...productKnowledgeHooks
                      .filter((hook) => hook.name && hook.name.trim() !== '')
                      .map((hook) => ({ value: hook.name, label: hook.name })),
                  ],
                  onSelect: (value) => {
                    if (value === HOOK_NAME_SELECT_NONE) {
                      setSelectedHookName('');
                      handleInputChange('hook_name', '');
                      handleInputChange('hook_description', '');
                      handleInputChange('hook_content', '');
                      return;
                    }
                    setSelectedHookName(value);
                    const selectedHook = productKnowledgeHooks.find((hook) => hook.name === value);
                    if (selectedHook) {
                      handleInputChange('hook_name', value);
                      handleInputChange('hook_description', selectedHook.description || '');
                      handleInputChange('hook_content', selectedHook.hook_content || '');
                    } else {
                      handleInputChange('hook_name', '');
                      handleInputChange('hook_description', '');
                      handleInputChange('hook_content', '');
                    }
                  },
                  desktop: (
                <Select
                  value={
                    (selectedHookName || formData.hook_name || '').trim()
                      ? selectedHookName || formData.hook_name || ''
                      : HOOK_NAME_SELECT_NONE
                  }
                  onValueChange={(value) => {
                    if (value === HOOK_NAME_SELECT_NONE) {
                      setSelectedHookName('');
                      handleInputChange('hook_name', '');
                      handleInputChange('hook_description', '');
                      handleInputChange('hook_content', '');
                      return;
                    }

                    setSelectedHookName(value);

                    const selectedHook = productKnowledgeHooks.find((hook) => hook.name === value);

                    if (selectedHook) {
                      handleInputChange('hook_name', value);
                      handleInputChange('hook_description', selectedHook.description || '');
                      handleInputChange('hook_content', selectedHook.hook_content || '');
                    } else {
                      handleInputChange('hook_name', '');
                      handleInputChange('hook_description', '');
                      handleInputChange('hook_content', '');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Hook Name" />
                  </SelectTrigger>
                  <SelectContent
                    className="w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-trigger-width)] border-2 border-gray-200 bg-white shadow-lg"
                    position="popper"
                  >
                    <SelectItem value={HOOK_NAME_SELECT_NONE} className="break-words whitespace-normal">
                      Tanpa hook
                    </SelectItem>
                    {productKnowledgeHooks.length === 0 ? (
                      <SelectItem value="no-hooks-in-db" disabled className="break-words whitespace-normal">
                        Tidak ada template Hook di Product Knowledge
                      </SelectItem>
                    ) : (
                      <>
                        <SelectSeparator className="my-1 bg-gray-200" />
                        {productKnowledgeHooks
                          .filter((hook) => hook.name && hook.name.trim() !== '')
                          .flatMap((hook, index) => [
                            index > 0 && <SelectSeparator key={`sep-${hook.id}`} className="my-1 bg-gray-200" />,
                            <SelectItem
                              key={hook.id}
                              value={hook.name}
                              className={cn(
                                'break-words whitespace-normal',
                                index % 2 === 1 && 'bg-gray-50/80'
                              )}
                            >
                              {hook.name}
                            </SelectItem>,
                          ])
                          .filter(Boolean)}
                      </>
                    )}
                  </SelectContent>
                </Select>
                  ),
                })}
              </div>

              {formData.hook_description && (
                <div className="space-y-1">
                  <Label htmlFor="hook_description">Hook Description</Label>
                  <Textarea
                    id="hook_description"
                    value={formData.hook_description || ''}
                    readOnly
                    className="bg-gray-50 cursor-not-allowed"
                    placeholder="Deskripsi hook akan muncul di sini"
                    rows={2}
                  />
                </div>
              )}

              {formData.hook_content && (
                <div className="space-y-1">
                  <Label htmlFor="hook_content">Hook Content</Label>
                  <Textarea
                    id="hook_content"
                    value={formData.hook_content || ''}
                    readOnly
                    className="bg-gray-50 cursor-not-allowed"
                    placeholder="Konten hook akan muncul di sini"
                    rows={4}
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="style_name">Style Name</Label>
                {renderFormSelect('style', {
                  title: 'Style Name',
                  value: selectedStyleName || '',
                  placeholder: 'Pilih Style Name',
                  wrapLabel: true,
                  emptyText: formData.content_pillar
                    ? `Tidak ada Style tersedia untuk pillar "${formData.content_pillar}"`
                    : 'Tidak ada Style tersedia',
                  options: filteredStyleOptions.map((style) => ({ value: style.name, label: style.name })),
                  onSelect: (value) => {
                    setSelectedStyleName(value);
                    const selectedStyle = productKnowledgeStyles.find((style) => style.name === value);
                    if (selectedStyle) {
                      handleInputChange('style_name', value);
                      if (selectedStyle.description) {
                        handleInputChange('style_instruksi', selectedStyle.description);
                      }
                      if (selectedStyle.structure) {
                        handleInputChange('structure', selectedStyle.structure);
                      }
                    } else {
                      handleInputChange('style_name', '');
                      handleInputChange('style_instruksi', '');
                      handleInputChange('structure', '');
                    }
                  },
                  desktop: (
                <Select
                  value={selectedStyleName || ""}
                  onValueChange={(value) => {
                    setSelectedStyleName(value);
                    
                    // Find the selected style
                    const selectedStyle = productKnowledgeStyles.find(
                      (style) => style.name === value
                    );
                    
                    // Auto-fill style_name and style_instruksi if found
                    if (selectedStyle) {
                      // Set style_name (the name selected)
                      handleInputChange('style_name', value);
                      
                      if (selectedStyle.description) {
                        handleInputChange('style_instruksi', selectedStyle.description);
                      }
                      
                      // Auto-fill structure if found
                      if (selectedStyle.structure) {
                        handleInputChange('structure', selectedStyle.structure);
                      }
                    } else {
                      // Clear fields if no style found
                      handleInputChange('style_name', '');
                      handleInputChange('style_instruksi', '');
                      handleInputChange('structure', '');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Style Name" />
                  </SelectTrigger>
                  <SelectContent
                    className="w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-trigger-width)] border-2 border-gray-200 bg-white shadow-lg"
                    position="popper"
                  >
                    {(() => {
                      // Filter styles based on selected content pillar
                      const filteredStyles = productKnowledgeStyles.filter((style) => {
                        // Always show styles with valid names
                        if (!style.name || style.name.trim() === '') {
                          return false;
                        }
                        
                        // If no content pillar is selected, show all styles
                        if (!formData.content_pillar) {
                          return true;
                        }
                        
                        // Find the content pillar ID from the pillar name
                        const selectedPillar = contentPillars.find(
                          (pillar) => pillar.name === formData.content_pillar
                        );
                        
                        if (!selectedPillar) {
                          // If pillar not found, show all styles
                          return true;
                        }
                        
                        // Show style if:
                        // 1. Style has no pillars (universal) - content_pillar_ids is null or empty array
                        // 2. Style includes the selected pillar ID
                        const pillarIds = style.content_pillar_ids || [];
                        const isUniversal = pillarIds.length === 0;
                        const includesSelectedPillar = pillarIds.includes(selectedPillar.id);
                        
                        return isUniversal || includesSelectedPillar;
                      });
                      
                      if (filteredStyles.length === 0) {
                        return (
                          <SelectItem value="no-data" disabled className="break-words whitespace-normal">
                            {formData.content_pillar 
                              ? `Tidak ada Style tersedia untuk pillar "${formData.content_pillar}"`
                              : 'Tidak ada Style tersedia'}
                          </SelectItem>
                        );
                      }
                      
                      return filteredStyles.flatMap((style, index) => [
                        index > 0 && <SelectSeparator key={`sep-${style.id}`} className="my-1 bg-gray-200" />,
                        <SelectItem
                          key={style.id}
                          value={style.name}
                          className={cn(
                            "break-words whitespace-normal",
                            index % 2 === 1 && "bg-gray-50/80"
                          )}
                        >
                          {style.name}
                        </SelectItem>
                      ]).filter(Boolean);
                    })()}
                  </SelectContent>
                </Select>
                  ),
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="style_instruksi">Style Instruksi</Label>
                  <Textarea
                    id="style_instruksi"
                    value={formData.style_instruksi || ''}
                    onChange={(e) => handleInputChange('style_instruksi', e.target.value)}
                    placeholder="Instruksi style untuk script (contoh: formal, casual, friendly, dll)"
                    rows={3}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="structure">Structure</Label>
                  <Textarea
                    id="structure"
                    value={formData.structure || ''}
                    onChange={(e) => handleInputChange('structure', e.target.value)}
                    placeholder="Struktur script yang diinginkan (contoh: Hook - Problem - Solution - CTA)"
                    rows={3}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="cta_type">CTA (Call to Action)</Label>
                {renderFormSelect('cta', {
                  title: 'CTA (Call to Action)',
                  value: formData.cta_type || '',
                  placeholder: 'Pilih Tipe CTA',
                  triggerClassName: cn(
                    'min-w-0',
                    !formData.selling_approach && 'bg-gray-100 cursor-not-allowed',
                  ),
                  wrapLabel: true,
                  disabled: !formData.selling_approach,
                  options: [
                    {
                      value: 'use_solution',
                      label: 'Menggunakan Solution - CTA akan menggunakan field Solution dari Product/Service Details',
                    },
                    {
                      value: 'use_comment',
                      label: 'Menggunakan Comment - CTA meminta comment untuk mendapatkan engagement dan leads',
                    },
                  ],
                  onSelect: (value) => handleInputChange('cta_type', value as 'use_solution' | 'use_comment'),
                  desktop: (
                <Select
                  value={formData.cta_type || ""}
                  onValueChange={(value) => handleInputChange('cta_type', value as 'use_solution' | 'use_comment')}
                  disabled={!formData.selling_approach}
                >
                  <SelectTrigger className={cn(
                    'min-w-0 overflow-hidden [&>span]:min-w-0 [&>span]:truncate',
                    !formData.selling_approach && 'bg-gray-100 cursor-not-allowed'
                  )}>
                    <SelectValue placeholder="Pilih Tipe CTA" />
                  </SelectTrigger>
                  <SelectContent
                    className="w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-trigger-width)] border-2 border-gray-200 bg-white shadow-lg"
                    position="popper"
                  >
                    <SelectItem
                      value="use_solution"
                      className="break-words whitespace-normal"
                    >
                      Menggunakan Solution - CTA akan menggunakan field Solution dari Product/Service Details
                    </SelectItem>
                    <SelectSeparator className="my-1 bg-gray-200" />
                    <SelectItem
                      value="use_comment"
                      className="break-words whitespace-normal bg-gray-50/80"
                    >
                      Menggunakan Comment - CTA meminta comment untuk mendapatkan engagement dan leads
                    </SelectItem>
                  </SelectContent>
                </Select>
                  ),
                })}
                {formData.cta_type === 'use_solution' && !formData.solution && !useCreativeContextFlow && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ Pastikan field "Solution" di accordion "Product/Service Details" sudah diisi
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="judul">Judul</Label>
                {renderFormSelect('judul', {
                  title: 'Judul',
                  value: selectedJudulTemplate || '',
                  placeholder: 'Pilih Template Judul',
                  triggerClassName: 'min-w-0',
                  wrapLabel: true,
                  options: judulTemplates.map((template) => ({
                    value: template.value,
                    label: template.label,
                  })),
                  onSelect: (value) => {
                    setSelectedJudulTemplate(value);
                    const template = judulTemplates.find((t) => t.value === value);
                    if (template) {
                      handleInputChange('judul', template.template);
                      handleInputChange('judul_custom', template.template);
                    } else {
                      handleInputChange('judul', '');
                      handleInputChange('judul_custom', '');
                    }
                  },
                  desktop: (
                <Select
                  value={selectedJudulTemplate || ""}
                  onValueChange={(value) => {
                    setSelectedJudulTemplate(value);
                    
                    // Find the selected template
                    const template = judulTemplates.find(t => t.value === value);
                    
                    if (template) {
                      // Set the template as judul and also as judul_custom for editing
                      handleInputChange('judul', template.template);
                      handleInputChange('judul_custom', template.template);
                    } else {
                      handleInputChange('judul', '');
                      handleInputChange('judul_custom', '');
                    }
                  }}
                >
                  <SelectTrigger className="min-w-0 overflow-hidden [&>span]:min-w-0 [&>span]:truncate">
                    <SelectValue placeholder="Pilih Template Judul" />
                  </SelectTrigger>
                  <SelectContent
                    className="w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-trigger-width)] border-2 border-gray-200 bg-white shadow-lg"
                    position="popper"
                  >
                    {judulTemplates.flatMap((template, index) => [
                      index > 0 && <SelectSeparator key={`sep-${template.value}`} className="my-1 bg-gray-200" />,
                      <SelectItem
                        key={template.value}
                        value={template.value}
                        className={cn(
                          "break-words whitespace-normal items-start py-2",
                          index % 2 === 1 && "bg-gray-50/80"
                        )}
                      >
                        <span className="block break-words line-clamp-3" title={template.label}>
                          {template.label}
                        </span>
                      </SelectItem>
                    ]).filter(Boolean)}
                  </SelectContent>
                </Select>
                  ),
                })}
                {formData.judul && (
                  <div className="mt-2 rounded-md border border-primary/25 bg-primary/10 p-3">
                    <Label htmlFor="judul_custom" className="text-sm font-medium text-gray-700 mb-2 block">
                      Edit Judul (Opsional)
                    </Label>
                    <Textarea
                      id="judul_custom"
                      value={formData.judul_custom || ''}
                      onChange={(e) => {
                        handleInputChange('judul_custom', e.target.value);
                        handleInputChange('judul', e.target.value);
                      }}
                      placeholder="Edit template judul sesuai kebutuhan"
                      rows={2}
                      className="text-sm"
                    />
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-gray-600 font-medium">
                        💡 <strong>Cara Menggunakan Template:</strong>
                      </p>
                      <ul className="text-xs text-gray-500 ml-4 list-disc space-y-1">
                        <li>Ganti teks dalam <strong>[kurung siku]</strong> dengan konten yang relevan</li>
                        <li><strong>[#]</strong> = ganti dengan angka (contoh: "5 Tips", "10 Cara")</li>
                        <li><strong>[#%]</strong> = ganti dengan persentase (contoh: "90% Orang", "75% Pelanggan")</li>
                        <li><strong>[#Tanda]</strong> = ganti dengan tanda/ikon (contoh: "⚠️ Peringatan", "🚨 Alert")</li>
                        <li>Pastikan judul relevan dengan produk/layanan dan target audience Anda</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={isGenerating}
          className="flex-1"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Script
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={isGenerating}
        >
          Reset
        </Button>
      </div>
    </form>
  );
};
