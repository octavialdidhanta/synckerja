import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { HeaderAndTab } from '@/6-1-content-calendar/container/HeaderAndTab';
import { RealtimeSocialMediaProvider } from '@/6-1-dashboard/hook/RealtimeSocialMediaProvider';
import OptimizedErrorBoundary from '@/6-1-dashboard/components/OptimizedErrorBoundary';
import { PICFilterProvider } from '@/6-1-dashboard/context/PICFilterContext';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useScriptAIConfig } from '@/6-1-script-generator/hooks/useScriptAIConfig';
import { useProductKnowledge } from './hooks/useProductKnowledge';
import type { ProductKnowledge } from './hooks/useProductKnowledge';
import { useProductKnowledgeFeatures } from './hooks/useProductKnowledgeFeatures';
import type { ProductKnowledgeFeature } from './hooks/useProductKnowledgeFeatures';
import { useProductKnowledgeMutations } from './hooks/useProductKnowledgeMutations';
import { useProductKnowledgeDetail } from './hooks/useProductKnowledgeDetail';
import { useProductKnowledgeStyle } from './hooks/useProductKnowledgeStyle';
import { useProductKnowledgeHooks } from './hooks/useProductKnowledgeHooks';
import { useKeywords } from './hooks/useKeywords';
import { useServices } from './hooks/useServices';
import { useSubServices } from './hooks/useSubServices';
import { ProductKnowledgePageSkeleton } from './skeletons/ProductKnowledgePageSkeleton';
import { useProductKnowledgePageSkeletonGate } from './hooks/useProductKnowledgePageSkeletonGate';
import { ProductKnowledgeTable } from './components/ProductKnowledgeTable';
import { ProductKnowledgeFilters } from './components/ProductKnowledgeFilters';
import { ProductKnowledgeTableFooter } from './components/ProductKnowledgeTableFooter';
import { ProductKnowledgeGeneratePanel } from './components/ProductKnowledgeGeneratePanel';
import { buildProductKnowledgePrompt } from './utils/buildProductKnowledgePrompt';
import type { ProductKnowledgeAiRow } from './utils/parseProductKnowledgeAiTable';
import { toast } from 'sonner';
import { useUserData } from '@/shared/auth/hooks/useUserData';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { ProductKnowledgeSidebar } from './components/ProductKnowledgeSidebar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';

const ProductKnowledgeContent: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useAppTranslation();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const [activeMainTab, setActiveMainTab] = useState('product-knowledge');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('all');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedSidebarItemId, setSelectedSidebarItemId] = useState<string | null>(null);
  const [industri, setIndustri] = useState('');
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [defaultRowIdForAdd, setDefaultRowIdForAdd] = useState<string | null>(null);
  const [hasUpdatedTargetOnce, setHasUpdatedTargetOnce] = useState(false);
  const [addChoiceModal, setAddChoiceModal] = useState<{ open: boolean; aiRow: ProductKnowledgeAiRow | null }>({ open: false, aiRow: null });
  
  const { data: productKnowledgeData = [], isPending: productKnowledgePending } = useProductKnowledge();
  const { data: masterFeatures = [], isPending: featuresPending } = useProductKnowledgeFeatures();
  const { data: services = [], isPending: servicesPending } = useServices();
  const { data: subServices = [], isPending: subServicesPending } = useSubServices();
  const { isPending: detailPending } = useProductKnowledgeDetail();
  const { isPending: stylePending } = useProductKnowledgeStyle();
  const { isPending: hooksPending } = useProductKnowledgeHooks();
  const { isPending: keywordsPending } = useKeywords();
  const { isPending: scriptAiPending } = useScriptAIConfig();
  const { addProductKnowledge, updateProductKnowledge, deleteProductKnowledge } = useProductKnowledgeMutations();
  const { profile } = useUserData();

  const hasOrg = Boolean(organizationId);
  const rawPagePending =
    orgLoading ||
    (hasOrg &&
      (productKnowledgePending ||
        featuresPending ||
        servicesPending ||
        subServicesPending ||
        detailPending ||
        stylePending ||
        hooksPending ||
        keywordsPending ||
        scriptAiPending));

  const showPageSkeleton = useProductKnowledgePageSkeletonGate(rawPagePending);

  const handleTabChange = (newTab: string) => {
    setActiveMainTab(newTab);
    navigate(`/digital-marketing/social-media/${newTab}`);
  };

  // Filter data based on search term and service
  const filteredData = useMemo(() => {
    let filtered = productKnowledgeData;

    // Filter by service
    if (selectedServiceId && selectedServiceId !== 'all') {
      filtered = filtered.filter(item => item.service_id === selectedServiceId);
    }

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        const competitiveAdvantageStr = Array.isArray(item.competitive_advantage) 
          ? item.competitive_advantage.join(' ') 
          : (typeof item.competitive_advantage === 'string' ? item.competitive_advantage : JSON.stringify(item.competitive_advantage || ''));
        
        return item.feature_name?.toLowerCase().includes(searchLower) ||
          item.feature_description?.toLowerCase().includes(searchLower) ||
          item.impact?.toLowerCase().includes(searchLower) ||
          item.solusi?.toLowerCase().includes(searchLower) ||
          item.problems_solved?.some(p => p.toLowerCase().includes(searchLower)) ||
          item.service_name?.toLowerCase().includes(searchLower) ||
          item.sub_service_name?.toLowerCase().includes(searchLower) ||
          item.false_belief?.toLowerCase().includes(searchLower) ||
          item.false_belief_impact?.toLowerCase().includes(searchLower) ||
          item.what_makes_them_stop?.toLowerCase().includes(searchLower) ||
          competitiveAdvantageStr?.toLowerCase().includes(searchLower);
      });
    }

    return filtered;
  }, [productKnowledgeData, searchTerm, selectedServiceId]);

  // Handle select item
  const handleSelectItem = useCallback((id: string, checked: boolean) => {
    setSelectedItems(prev => {
      if (checked) {
        return [...prev, id];
      } else {
        return prev.filter(itemId => itemId !== id);
      }
    });
  }, []);

  // Handle add new product knowledge
  const handleAdd = useCallback(async () => {
    if (!profile?.id) {
      toast.error(t('productKnowledge.toast.errorValidatingUser', 'Error validating user data'));
      return;
    }

    try {
      addProductKnowledge({
        feature_name: '',
        feature_description: '',
        problems_solved: [],
        impact: '',
        solusi: null,
        target_audience: null,
        competitive_advantage: null,
        // Don't set fields that don't exist in the table
      });
    } catch (error) {
      console.error('Error adding new row:', error);
      toast.error(t('productKnowledge.toast.errorAddingRow', 'Error adding new row'));
    }
  }, [profile?.id, addProductKnowledge, t]);

  // Handle delete selected (semua baris di tabel adalah data rows; master feature ada di table terpisah)
  const handleDeleteSelected = useCallback(async () => {
    if (selectedItems.length === 0) {
      toast.error(t('productKnowledge.toast.noItemsSelected', 'No items selected'));
      return;
    }

    const confirmMessage = t('productKnowledge.toast.confirmDelete', 'Are you sure you want to delete {{count}} selected item(s)?', {
      count: selectedItems.length,
    });
    if (window.confirm(confirmMessage)) {
      try {
        selectedItems.forEach((id) => deleteProductKnowledge(id));
        setSelectedItems([]);
      } catch (error) {
        console.error('Error deleting items:', error);
        toast.error(t('productKnowledge.toast.errorDeletingItems', 'Error deleting items'));
      }
    }
  }, [selectedItems, deleteProductKnowledge, t]);

  // Handle field change
  const handleFieldChange = useCallback((id: string, field: string, value: any) => {
    updateProductKnowledge(id, { [field]: value });
  }, [updateProductKnowledge]);

  // Single update when user selects or clears a feature (pre-fill from master in product_knowledge_features)
  const handleFeatureSelect = useCallback(
    (id: string, master: ProductKnowledgeFeature | null) => {
      if (master) {
        updateProductKnowledge(id, {
          feature_id: master.id,
          feature_name: master.feature_name ?? '',
          feature_description: master.feature_description ?? '',
          solusi: master.solution ?? null,
          competitive_advantage: master.competitive_advantage ?? null,
        });
      } else {
        updateProductKnowledge(id, {
          feature_id: null,
          feature_name: '',
          feature_description: '',
          solusi: null,
          competitive_advantage: null,
        });
      }
    },
    [updateProductKnowledge]
  );

  const handleMasterDataChange = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['product-knowledge'] });
    queryClient.invalidateQueries({ queryKey: ['product-knowledge-features'] });
    queryClient.invalidateQueries({ queryKey: ['services'] });
    queryClient.invalidateQueries({ queryKey: ['sub_services'] });
  }, [queryClient]);

  // Saat master feature di-update dari Edit Feature modal, sync ke semua baris tabel yang pakai feature tersebut
  const handleMasterFeatureUpdated = useCallback(
    (featureId: string, payload: { feature_name: string; feature_description: string | null; solution: string | null; competitive_advantage: unknown }) => {
      const rowsToUpdate = productKnowledgeData.filter((row) => row.feature_id === featureId);
      rowsToUpdate.forEach((row) => {
        updateProductKnowledge(row.id, {
          feature_name: payload.feature_name ?? '',
          feature_description: payload.feature_description ?? '',
          solusi: payload.solution ?? null,
          competitive_advantage: payload.competitive_advantage ?? null,
        });
      });
    },
    [productKnowledgeData, updateProductKnowledge]
  );

  const handleGeneratePromptForRow = useCallback(
    (rowId: string) => {
      const prompt = buildProductKnowledgePrompt('B2B', industri.trim(), productKnowledgeData, rowId);
      setEditedPrompt(prompt);
      setDefaultRowIdForAdd(rowId);
      setHasUpdatedTargetOnce(false);
      setPromptModalOpen(true);
    },
    [industri, productKnowledgeData]
  );

  const buildAiRowPayload = useCallback((aiRow: ProductKnowledgeAiRow, targetRow: ProductKnowledge) => {
    const problemsArray = aiRow.problem
      ? aiRow.problem.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
      : [];
    if (problemsArray.length === 0 && aiRow.problem) problemsArray.push(aiRow.problem);
    return {
      solusi: (aiRow.solution?.trim() || targetRow.solusi) ?? null,
      target_audience: aiRow.customerPersona || null,
      problems_solved: problemsArray,
      impact: aiRow.impact || '',
      wants: aiRow.wants || null,
      needs: aiRow.needs || null,
      hidden_needs: aiRow.hiddenNeeds || null,
      false_belief: aiRow.falseBelief || null,
      false_belief_impact: aiRow.falseBeliefImpact || null,
      what_makes_them_stop: aiRow.whatMakesThemStop || null,
    };
  }, []);

  const handleAddToProductKnowledgeAsNewRow = useCallback(
    (aiRow: ProductKnowledgeAiRow) => {
      const targetRow = defaultRowIdForAdd
        ? productKnowledgeData.find((p) => p.id === defaultRowIdForAdd)
        : null;
      if (!targetRow) {
        toast.error(
          t(
            'productKnowledge.generate.clickRowFirst',
            "Klik 'Generate prompt (tanpa AI)' dari baris tabel terlebih dahulu agar baris bisa diperbarui dengan hasil AI."
          )
        );
        return;
      }
      if (!hasUpdatedTargetOnce) {
        const updates = buildAiRowPayload(aiRow, targetRow);
        updateProductKnowledge(targetRow.id, updates);
        setHasUpdatedTargetOnce(true);
        toast.success(t('productKnowledge.generate.applySuccess', 'Data hasil AI berhasil diterapkan ke baris yang dipilih.'));
        return;
      }
      setAddChoiceModal({ open: true, aiRow });
    },
    [defaultRowIdForAdd, productKnowledgeData, hasUpdatedTargetOnce, buildAiRowPayload, updateProductKnowledge, t]
  );

  const handleAddChoiceUpdate = useCallback(() => {
    if (!addChoiceModal.aiRow || !defaultRowIdForAdd) return;
    const targetRow = productKnowledgeData.find((p) => p.id === defaultRowIdForAdd);
    if (!targetRow) return;
    const updates = buildAiRowPayload(addChoiceModal.aiRow, targetRow);
    updateProductKnowledge(targetRow.id, updates);
    setAddChoiceModal({ open: false, aiRow: null });
    toast.success(t('productKnowledge.generate.applySuccess', 'Data hasil AI berhasil diterapkan ke baris yang dipilih.'));
  }, [addChoiceModal.aiRow, defaultRowIdForAdd, productKnowledgeData, buildAiRowPayload, updateProductKnowledge, t]);

  const handleAddChoiceNewRow = useCallback(() => {
    if (!addChoiceModal.aiRow || !defaultRowIdForAdd) return;
    const targetRow = productKnowledgeData.find((p) => p.id === defaultRowIdForAdd);
    if (!targetRow) return;
    const payload = buildAiRowPayload(addChoiceModal.aiRow, targetRow);
    addProductKnowledge({
      service_id: targetRow.service_id,
      sub_service_id: targetRow.sub_service_id,
      feature_id: targetRow.feature_id,
      feature_name: targetRow.feature_name ?? '',
      feature_description: targetRow.feature_description ?? '',
      competitive_advantage: targetRow.competitive_advantage ?? null,
      ...payload,
    });
    setAddChoiceModal({ open: false, aiRow: null });
    toast.success(t('productKnowledge.generate.newRowSuccess', 'Baris baru berhasil ditambahkan.'));
  }, [addChoiceModal.aiRow, defaultRowIdForAdd, productKnowledgeData, buildAiRowPayload, addProductKnowledge, t]);

  return (
    <>
      <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
            <div className="flex h-full min-h-0 flex-col">
              <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="relative flex min-h-full flex-1 flex-col">
                  <div
                    className={
                      showPageSkeleton
                        ? 'invisible pointer-events-none flex min-h-full min-h-0 flex-1 flex-col'
                        : 'flex min-h-full min-h-0 flex-1 flex-col'
                    }
                    aria-hidden={showPageSkeleton}
                  >
                    <div className="flex-shrink-0">
                      <HeaderAndTab
                        activeMainTab={activeMainTab}
                        handleTabChange={handleTabChange}
                        flushBottom
                      />
                    </div>

                    <div className="grid min-h-[calc(100vh-120px)] max-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch">
                      <div className="col-span-9 flex h-full min-h-0 min-w-0 flex-col gap-0 overflow-hidden">
                        <div className="min-h-0 flex-shrink-0">
                          <ProductKnowledgeGeneratePanel
                            productKnowledgeData={productKnowledgeData}
                            onAddAsNewRow={handleAddToProductKnowledgeAsNewRow}
                            industri={industri}
                            setIndustri={setIndustri}
                            promptModalOpen={promptModalOpen}
                            setPromptModalOpen={setPromptModalOpen}
                            editedPrompt={editedPrompt}
                            setEditedPrompt={setEditedPrompt}
                            defaultRowIdForAdd={defaultRowIdForAdd}
                            setDefaultRowIdForAdd={setDefaultRowIdForAdd}
                          />
                        </div>
                        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                          <div className="z-20 flex min-h-11 shrink-0 items-center border-b-2 border-gray-300 bg-white px-4 py-2">
                          <ProductKnowledgeFilters
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            selectedServiceId={selectedServiceId}
                            setSelectedServiceId={setSelectedServiceId}
                            selectedItems={selectedItems}
                            services={services}
                            onAdd={handleAdd}
                            onDeleteSelected={handleDeleteSelected}
                          />
                          </div>
                          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <div className="w-full min-w-0 p-6">
                              <ProductKnowledgeTable
                                data={filteredData}
                                isLoading={false}
                                selectedItems={selectedItems}
                                onSelectItem={handleSelectItem}
                                onFieldChange={handleFieldChange}
                                services={services}
                                subServices={subServices}
                                masterFeatures={masterFeatures}
                                onFeatureSelect={handleFeatureSelect}
                                onGeneratePromptForRow={handleGeneratePromptForRow}
                              />
                            </div>
                          </div>
                          <div className="z-10 flex-shrink-0 border-t border-gray-200 bg-white">
                            <ProductKnowledgeTableFooter
                              masterFeatures={masterFeatures}
                              allProductKnowledgeRows={productKnowledgeData}
                              services={services}
                              onDataChange={handleMasterDataChange}
                              onMasterFeatureUpdated={handleMasterFeatureUpdated}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="col-span-3 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
                        <ProductKnowledgeSidebar
                          selectedItemId={selectedSidebarItemId}
                          onSelectItem={(id) => setSelectedSidebarItemId(id)}
                        />
                      </div>
                    </div>

                    <div
                      className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                      aria-hidden
                    />
                  </div>

                  {showPageSkeleton && (
                    <div
                      className="absolute inset-0 z-20 flex min-h-0 flex-col overflow-hidden bg-gray-100"
                      aria-busy
                      aria-label="Memuat product knowledge"
                    >
                      <span className="sr-only">Memuat product knowledge</span>
                      <ProductKnowledgePageSkeleton mode="overlay" headerActiveTabId={activeMainTab} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    {/* Popup pilihan: Update baris yang sama atau Buat baris baru (setelah add pertama) */}
    <Dialog open={addChoiceModal.open} onOpenChange={(open) => !open && setAddChoiceModal({ open: false, aiRow: null })}>
      <DialogContent className="max-w-md px-6 py-6 gap-0">
        <DialogHeader className="pb-3">
          <DialogTitle>{t('productKnowledge.generate.addChoiceTitle', 'Pilih aksi')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600 py-4">
          {t('productKnowledge.generate.addChoiceDescription', 'Baris target sudah pernah diperbarui. Ingin memperbarui baris yang sama atau membuat baris baru?')}
        </p>
        <DialogFooter className="pt-4 pb-0 gap-3 flex-wrap">
          <Button variant="outline" onClick={() => setAddChoiceModal({ open: false, aiRow: null })}>
            {t('common.cancel', 'Batal')}
          </Button>
          <Button variant="outline" onClick={handleAddChoiceUpdate}>
            {t('productKnowledge.generate.addChoiceUpdate', 'Update baris yang sama')}
          </Button>
          <Button onClick={handleAddChoiceNewRow}>
            {t('productKnowledge.generate.addChoiceNewRow', 'Buat baris baru')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

// Main export with providers (matching ContentCalendarPage pattern)
const ProductKnowledgePage = () => {
  return (
    <OptimizedErrorBoundary>
      <RealtimeSocialMediaProvider>
        <PICFilterProvider>
          <ProductKnowledgeContent />
        </PICFilterProvider>
      </RealtimeSocialMediaProvider>
    </OptimizedErrorBoundary>
  );
};

export default ProductKnowledgePage;

