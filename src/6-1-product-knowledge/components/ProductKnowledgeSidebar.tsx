import React, { useState, useMemo } from 'react';
import { useProductKnowledgeDetail, ProductKnowledgeDetail } from '../hooks/useProductKnowledgeDetail';
import { useProductKnowledgeStyle, ProductKnowledgeStyle } from '../hooks/useProductKnowledgeStyle';
import { useProductKnowledgeHooks, ProductKnowledgeHook } from '../hooks/useProductKnowledgeHooks';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { LoadingDots } from '@/shared/components/LoadingDots';
import { BookOpen, Search, X, Plus, ChevronLeft, Palette, Edit, Trash2, Link2, Copy, Hash } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import { ProductKnowledgeDetailModal } from './ProductKnowledgeDetailModal';
import { useProductKnowledgeDetailMutations } from '../hooks/useProductKnowledgeDetail';
import { useProductKnowledgeStyleMutations } from '../hooks/useProductKnowledgeStyle';
import { useProductKnowledgeHooksMutations } from '../hooks/useProductKnowledgeHooks';
import { useKeywords, Keyword, useKeywordsMutations } from '../hooks/useKeywords';
import { toast } from 'sonner';
import { ProductKnowledgeSidebarFooter } from './ProductKnowledgeSidebarFooter';
import { StyleModal } from './StyleModal';
import { HooksModal } from './HooksModal';
import { KeywordModal } from './KeywordModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';

interface ProductKnowledgeSidebarProps {
  selectedItemId?: string | null;
  onSelectItem?: (id: string) => void;
}

export const ProductKnowledgeSidebar: React.FC<ProductKnowledgeSidebarProps> = ({
  selectedItemId,
  onSelectItem,
}) => {
  const { t } = useAppTranslation();
  const { data: productKnowledgeDetailData = [], isLoading } = useProductKnowledgeDetail();
  const { data: productKnowledgeStyleData = [], isLoading: isStylesLoading } = useProductKnowledgeStyle();
  const { data: productKnowledgeHooksData = [], isLoading: isHooksLoading } = useProductKnowledgeHooks();
  const { data: keywordsData = [], isLoading: isKeywordsLoading } = useKeywords();
  const [searchTerm, setSearchTerm] = useState('');
  const [styleSearchTerm, setStyleSearchTerm] = useState('');
  const [hooksSearchTerm, setHooksSearchTerm] = useState('');
  const [keywordsSearchTerm, setKeywordsSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
  const [isHooksModalOpen, setIsHooksModalOpen] = useState(false);
  const [isKeywordModalOpen, setIsKeywordModalOpen] = useState(false);
  const [editingDetail, setEditingDetail] = useState<ProductKnowledgeDetail | null>(null);
  const [editingStyle, setEditingStyle] = useState<ProductKnowledgeStyle | null>(null);
  const [editingHook, setEditingHook] = useState<ProductKnowledgeHook | null>(null);
  const [editingKeyword, setEditingKeyword] = useState<Keyword | null>(null);
  const [deletingDetailId, setDeletingDetailId] = useState<string | null>(null);
  const [deletingStyleId, setDeletingStyleId] = useState<string | null>(null);
  const [deletingHookId, setDeletingHookId] = useState<string | null>(null);
  const [deletingKeywordId, setDeletingKeywordId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'knowledge' | 'style' | 'hooks' | 'keywords'>('knowledge');
  const [selectedDetail, setSelectedDetail] = useState<ProductKnowledgeDetail | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<ProductKnowledgeStyle | null>(null);
  const [selectedHook, setSelectedHook] = useState<ProductKnowledgeHook | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteDetailId, setPendingDeleteDetailId] = useState<string | null>(null);
  const {
    createProductKnowledgeDetail,
    updateProductKnowledgeDetail,
    deleteProductKnowledgeDetail,
    isCreating,
    isUpdating: isUpdatingDetail,
    isDeleting: isDeletingDetail,
  } = useProductKnowledgeDetailMutations();
  const {
    createProductKnowledgeStyle,
    updateProductKnowledgeStyle,
    deleteProductKnowledgeStyle,
    isCreating: isCreatingStyle,
    isUpdating: isUpdatingStyle,
    isDeleting: isDeletingStyle,
  } = useProductKnowledgeStyleMutations();
  const {
    createProductKnowledgeHook,
    updateProductKnowledgeHook,
    deleteProductKnowledgeHook,
    isCreating: isCreatingHook,
    isUpdating: isUpdatingHook,
    isDeleting: isDeletingHook,
  } = useProductKnowledgeHooksMutations();
  const {
    createKeyword,
    createMultipleKeywords,
    updateKeyword,
    deleteKeyword,
    isCreating: isCreatingKeyword,
    isCreatingMultiple: isCreatingMultipleKeywords,
    isUpdating: isUpdatingKeyword,
    isDeleting: isDeletingKeyword,
  } = useKeywordsMutations();

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return productKnowledgeDetailData;

    const searchLower = searchTerm.toLowerCase();
    return productKnowledgeDetailData.filter((item) => {
      return (
        item.product_knowledge_content?.toLowerCase().includes(searchLower) ||
        item.service_name?.toLowerCase().includes(searchLower) ||
        item.sub_service_name?.toLowerCase().includes(searchLower)
      );
    });
  }, [productKnowledgeDetailData, searchTerm]);

  // Filter style data based on search term
  const filteredStyleData = useMemo(() => {
    if (!styleSearchTerm) return productKnowledgeStyleData;

    const searchLower = styleSearchTerm.toLowerCase();
    return productKnowledgeStyleData.filter((item) => {
      return (
        item.name?.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower)
      );
    });
  }, [productKnowledgeStyleData, styleSearchTerm]);

  // Filter hooks data based on search term
  const filteredHooksData = useMemo(() => {
    if (!hooksSearchTerm) return productKnowledgeHooksData;

    const searchLower = hooksSearchTerm.toLowerCase();
    return productKnowledgeHooksData.filter((item) => {
      return (
        item.name?.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower) ||
        item.hook_content?.toLowerCase().includes(searchLower)
      );
    });
  }, [productKnowledgeHooksData, hooksSearchTerm]);

  // Filter keywords data based on search term
  const filteredKeywordsData = useMemo(() => {
    if (!keywordsSearchTerm) return keywordsData;

    const searchLower = keywordsSearchTerm.toLowerCase();
    return keywordsData.filter((item) => {
      return (
        item.keyword?.toLowerCase().includes(searchLower) ||
        item.service_name?.toLowerCase().includes(searchLower)
      );
    });
  }, [keywordsData, keywordsSearchTerm]);

  // Get Product/Service name
  const getProductServiceName = (item: ProductKnowledgeDetail): string => {
    if (item.sub_service_name) {
      return `${item.service_name || 'N/A'} / ${item.sub_service_name}`;
    }
    if (item.service_name) {
      return item.service_name;
    }
    return 'N/A';
  };

  const handleItemClick = (id: string) => {
    const item = productKnowledgeDetailData.find((item) => item.id === id);
    if (item) {
      setSelectedDetail(item);
      if (onSelectItem) {
        onSelectItem(id);
      }
    }
  };

  const handleBackToList = () => {
    setSelectedDetail(null);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
  };

  const handleSaveDetail = async (data: {
    service_id: string | null;
    sub_service_id: string | null;
    product_knowledge_content: string;
  }) => {
    try {
      if (editingDetail) {
        // Update existing detail
        await updateProductKnowledgeDetail({
          id: editingDetail.id,
          data: {
            service_id: data.service_id,
            sub_service_id: data.sub_service_id,
            product_knowledge_content: data.product_knowledge_content,
          },
        });
        toast.success(
          t(
            'productKnowledgeDetail.toast.updateSuccess',
            'Product knowledge detail updated successfully'
          )
        );
        setEditingDetail(null);
        setIsModalOpen(false);
      } else {
        // Create new detail
        await createProductKnowledgeDetail(data);
        toast.success(
          t(
            'productKnowledgeDetail.toast.createSuccess',
            'Product knowledge detail created successfully'
          )
        );
        setIsModalOpen(false);
      }
    } catch (error) {
      console.error('Error saving product knowledge detail:', error);
      toast.error(
        editingDetail
          ? t('productKnowledgeDetail.toast.updateError', 'Error updating product knowledge detail')
          : t('productKnowledgeDetail.toast.createError', 'Error creating product knowledge detail')
      );
      throw error;
    }
  };

  const handleEditDetail = (detail: ProductKnowledgeDetail, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the onClick of the parent div
    setEditingDetail(detail);
    setIsModalOpen(true);
  };

  const handleDeleteDetail = (detailId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the onClick of the parent div
    setPendingDeleteDetailId(detailId);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDeleteDetail = async () => {
    if (!pendingDeleteDetailId) return;

    try {
      setDeletingDetailId(pendingDeleteDetailId);
      await deleteProductKnowledgeDetail(pendingDeleteDetailId);
      toast.success(
        t('productKnowledgeDetail.toast.deleteSuccess', 'Product knowledge detail deleted successfully')
      );
      // Clear selected detail if it was the deleted one
      if (selectedDetail?.id === pendingDeleteDetailId) {
        setSelectedDetail(null);
      }
      setDeleteConfirmOpen(false);
      setPendingDeleteDetailId(null);
    } catch (error) {
      console.error('Error deleting product knowledge detail:', error);
      toast.error(t('productKnowledgeDetail.toast.deleteError', 'Error deleting product knowledge detail'));
    } finally {
      setDeletingDetailId(null);
    }
  };

  const handleCopyContent = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success(
        t('productKnowledgeDetail.toast.copySuccess', 'Content copied to clipboard')
      );
    } catch (error) {
      console.error('Error copying content:', error);
      toast.error(t('productKnowledgeDetail.toast.copyError', 'Error copying content'));
    }
  };

  const handleSaveStyle = async (data: { name: string; description: string; structure?: string; content_pillar_ids?: string[] }) => {
    try {
      // Validate name
      const trimmedName = (data.name || '').trim();
      if (!trimmedName) {
        toast.error(t('productKnowledge.style.toast.nameRequired', 'Style name is required'));
        return;
      }

      if (editingStyle) {
        // Update existing style
        const updateInput: { name: string; description?: string; structure?: string; content_pillar_ids?: string[] } = {
          name: trimmedName,
        };
        
        // Only include description if it's provided and not empty
        if (data.description !== undefined && data.description !== null) {
          const trimmedDesc = data.description.trim();
          updateInput.description = trimmedDesc || undefined;
        }
        
        // Only include structure if it's provided and not empty
        if (data.structure !== undefined && data.structure !== null) {
          const trimmedStruct = data.structure.trim();
          updateInput.structure = trimmedStruct || undefined;
        }
        
        // Include content_pillar_ids (empty array means universal)
        if (data.content_pillar_ids !== undefined) {
          updateInput.content_pillar_ids = data.content_pillar_ids.length > 0 ? data.content_pillar_ids : [];
        }
        
        console.log('Updating style:', { 
          id: editingStyle.id, 
          input: updateInput,
          editingStyle: editingStyle 
        });
        
        try {
          await updateProductKnowledgeStyle({ id: editingStyle.id, input: updateInput });
        } catch (error: any) {
          console.error('Update error details:', {
            error,
            message: error?.message,
            code: error?.code,
            details: error?.details,
            hint: error?.hint
          });
          throw error;
        }
        toast.success(
          t('productKnowledge.style.toast.updateSuccess', 'Style updated successfully')
        );
        setEditingStyle(null);
        setIsStyleModalOpen(false);
      } else {
        // Create new style
        await createProductKnowledgeStyle({
          name: trimmedName,
          description: data.description?.trim() || undefined,
          structure: data.structure?.trim() || undefined,
          content_pillar_ids: data.content_pillar_ids && data.content_pillar_ids.length > 0 
            ? data.content_pillar_ids 
            : [],
        });
        toast.success(
          t('productKnowledge.style.toast.createSuccess', 'Style created successfully')
        );
        setIsStyleModalOpen(false);
      }
    } catch (error) {
      console.error('Error saving style:', error);
      toast.error(
        editingStyle
          ? t('productKnowledge.style.toast.updateError', 'Error updating style')
          : t('productKnowledge.style.toast.createError', 'Error creating style')
      );
      throw error;
    }
  };

  const handleEditStyle = (style: ProductKnowledgeStyle, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the onClick of the parent div
    setEditingStyle(style);
    setIsStyleModalOpen(true);
  };

  const handleDeleteStyle = async (styleId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the onClick of the parent div
    
    if (!confirm(t('productKnowledge.style.deleteConfirm', 'Are you sure you want to delete this style?'))) {
      return;
    }

    try {
      setDeletingStyleId(styleId);
      await deleteProductKnowledgeStyle(styleId);
      toast.success(
        t('productKnowledge.style.toast.deleteSuccess', 'Style deleted successfully')
      );
      // Clear selected style if it was the deleted one
      if (selectedStyle?.id === styleId) {
        setSelectedStyle(null);
      }
    } catch (error) {
      console.error('Error deleting style:', error);
      toast.error(t('productKnowledge.style.toast.deleteError', 'Error deleting style'));
    } finally {
      setDeletingStyleId(null);
    }
  };

  const handleStyleClick = (id: string) => {
    const style = productKnowledgeStyleData.find((item) => item.id === id);
    if (style) {
      setSelectedStyle(style);
    }
  };

  const handleBackToStyleList = () => {
    setSelectedStyle(null);
  };

  const handleClearStyleSearch = () => {
    setStyleSearchTerm('');
  };

  const handleClearHooksSearch = () => {
    setHooksSearchTerm('');
  };

  const handleSaveHook = async (data: { name: string; description?: string; hook_content?: string }) => {
    try {
      // Validate name
      const trimmedName = (data.name || '').trim();
      if (!trimmedName) {
        toast.error(t('productKnowledge.hooks.toast.nameRequired', 'Hook name is required'));
        return;
      }

      if (editingHook) {
        // Update existing hook
        const updateInput: { name: string; description?: string; hook_content?: string } = {
          name: trimmedName,
        };
        
        // Only include description if it's provided and not empty
        if (data.description !== undefined && data.description !== null) {
          const trimmedDesc = data.description.trim();
          updateInput.description = trimmedDesc || undefined;
        }
        
        // Only include hook_content if it's provided and not empty
        if (data.hook_content !== undefined && data.hook_content !== null) {
          const trimmedContent = data.hook_content.trim();
          updateInput.hook_content = trimmedContent || undefined;
        }
        
        await updateProductKnowledgeHook({ id: editingHook.id, input: updateInput });
        toast.success(
          t('productKnowledge.hooks.toast.updateSuccess', 'Hook updated successfully')
        );
        setEditingHook(null);
        setIsHooksModalOpen(false);
      } else {
        // Create new hook
        await createProductKnowledgeHook({
          name: trimmedName,
          description: data.description?.trim() || undefined,
          hook_content: data.hook_content?.trim() || undefined,
        });
        toast.success(
          t('productKnowledge.hooks.toast.createSuccess', 'Hook created successfully')
        );
        setIsHooksModalOpen(false);
      }
    } catch (error) {
      console.error('Error saving hook:', error);
      toast.error(
        editingHook
          ? t('productKnowledge.hooks.toast.updateError', 'Error updating hook')
          : t('productKnowledge.hooks.toast.createError', 'Error creating hook')
      );
      throw error;
    }
  };

  const handleEditHook = (hook: ProductKnowledgeHook, e: React.MouseEvent) => {
    e.stopPropagation();
    // Prevent editing default hooks
    if (hook.organization_id === null) {
      toast.error(t('productKnowledge.hooks.cannotEditDefault', 'Default hooks cannot be edited'));
      return;
    }
    setEditingHook(hook);
    setIsHooksModalOpen(true);
  };

  const handleDeleteHook = async (hookId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Find the hook to check if it's a default hook
    const hook = productKnowledgeHooksData.find(h => h.id === hookId);
    if (hook && hook.organization_id === null) {
      toast.error(t('productKnowledge.hooks.cannotDeleteDefault', 'Default hooks cannot be deleted'));
      return;
    }
    
    if (!confirm(t('productKnowledge.hooks.deleteConfirm', 'Are you sure you want to delete this hook?'))) {
      return;
    }

    try {
      setDeletingHookId(hookId);
      await deleteProductKnowledgeHook(hookId);
      toast.success(
        t('productKnowledge.hooks.toast.deleteSuccess', 'Hook deleted successfully')
      );
      // Clear selected hook if it was the deleted one
      if (selectedHook?.id === hookId) {
        setSelectedHook(null);
      }
    } catch (error: any) {
      console.error('Error deleting hook:', error);
      toast.error(error?.message || t('productKnowledge.hooks.toast.deleteError', 'Error deleting hook'));
    } finally {
      setDeletingHookId(null);
    }
  };

  const handleHookClick = (id: string) => {
    const hook = productKnowledgeHooksData.find((item) => item.id === id);
    if (hook) {
      setSelectedHook(hook);
    }
  };

  const handleBackToHooksList = () => {
    setSelectedHook(null);
  };

  const handleClearKeywordsSearch = () => {
    setKeywordsSearchTerm('');
  };

  const handleSaveKeyword = async (data: { service_id: string; keyword: string }) => {
    try {
      if (editingKeyword) {
        // Update existing keyword
        await updateKeyword({
          id: editingKeyword.id,
          input: {
            service_id: data.service_id,
            keyword: data.keyword,
          },
        });
        toast.success(t('productKnowledge.keywords.toast.updateSuccess', 'Keyword updated successfully'));
        setEditingKeyword(null);
        setIsKeywordModalOpen(false);
      } else {
        // Create new keyword
        await createKeyword(data);
        toast.success(t('productKnowledge.keywords.toast.createSuccess', 'Keyword created successfully'));
        setIsKeywordModalOpen(false);
      }
    } catch (error: any) {
      console.error('Error saving keyword:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      toast.error(
        editingKeyword
          ? t('productKnowledge.keywords.toast.updateError', 'Error updating keyword') + ': ' + errorMessage
          : t('productKnowledge.keywords.toast.createError', 'Error creating keyword') + ': ' + errorMessage
      );
      throw error;
    }
  };

  const handleSaveAndAddAnotherKeyword = async (data: { service_id: string; keyword: string }) => {
    try {
      // Only allow save and add another for new keywords (not edit mode)
      if (editingKeyword) {
        // If editing, just save normally
        await handleSaveKeyword(data);
        return;
      }

      // Create new keyword and keep modal open for next entry
      await createKeyword(data);
      toast.success(t('productKnowledge.keywords.toast.createSuccess', 'Keyword created successfully'));
      // Don't close modal - keep it open for next entry
      // Form will be reset by KeywordModal's useEffect
    } catch (error: any) {
      console.error('Error saving keyword:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      toast.error(t('productKnowledge.keywords.toast.createError', 'Error creating keyword') + ': ' + errorMessage);
      throw error;
    }
  };

  const handleSaveMultipleKeywords = async (keywordsList: { service_id: string; keyword: string }[]) => {
    try {
      if (keywordsList.length === 0) {
        throw new Error('No keywords to save');
      }

      await createMultipleKeywords(keywordsList);
      toast.success(
        t('productKnowledge.keywords.toast.createMultipleSuccess', '{count} keywords created successfully', {
          count: keywordsList.length,
        })
      );
      setIsKeywordModalOpen(false);
    } catch (error: any) {
      console.error('Error saving keywords:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      toast.error(
        t('productKnowledge.keywords.toast.createMultipleError', 'Error creating keywords') + ': ' + errorMessage
      );
      throw error;
    }
  };

  const handleEditKeyword = (keyword: Keyword, e: React.MouseEvent) => {
    e.stopPropagation();
    // Set editing keyword and open modal for edit mode
    setEditingKeyword(keyword);
    setIsKeywordModalOpen(true);
  };

  const handleDeleteKeyword = async (keywordId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm(t('productKnowledge.keywords.deleteConfirm', 'Are you sure you want to delete this keyword?'))) {
      return;
    }

    try {
      setDeletingKeywordId(keywordId);
      await deleteKeyword(keywordId);
      toast.success(t('productKnowledge.keywords.toast.deleteSuccess', 'Keyword deleted successfully'));
      if (selectedKeyword?.id === keywordId) {
        setSelectedKeyword(null);
      }
    } catch (error) {
      console.error('Error deleting keyword:', error);
      toast.error(t('productKnowledge.keywords.toast.deleteError', 'Error deleting keyword'));
    } finally {
      setDeletingKeywordId(null);
    }
  };

  const handleKeywordClick = (id: string) => {
    const keyword = keywordsData.find((item) => item.id === id);
    if (keyword) {
      setSelectedKeyword(keyword);
    }
  };

  const handleBackToKeywordsList = () => {
    setSelectedKeyword(null);
  };

  const sidebarTabBaseClass =
    'flex min-h-11 flex-1 items-center justify-center border-b-2 px-2 py-0 text-sm font-medium transition-colors sm:px-4';
  const sidebarTabActiveClass = 'border-primary bg-primary/10 text-primary';
  const sidebarTabInactiveClass =
    'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground';

  const sidebarListSelectedShellClass = 'border-primary/25 bg-primary/10 shadow-sm';
  const sidebarListSelectedTitleClass = 'text-primary';
  const sidebarListSelectedActionClass = 'text-primary hover:text-primary/90';

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white">
        {/* Tab Buttons */}
        <div className="flex min-h-11 shrink-0 items-stretch border-b border-gray-200">
          <button
            onClick={() => {
              setActiveTab('knowledge');
              setSelectedDetail(null);
              setSelectedStyle(null);
              setSelectedHook(null);
              setSelectedKeyword(null);
            }}
            className={cn(
              sidebarTabBaseClass,
              activeTab === 'knowledge' ? sidebarTabActiveClass : sidebarTabInactiveClass
            )}
          >
            {t('productKnowledge.sidebar.tabs.knowledge', 'Product Knowledge')}
          </button>
          <button
            onClick={() => {
              setActiveTab('style');
              setSelectedDetail(null);
              setSelectedStyle(null);
              setSelectedHook(null);
              setSelectedKeyword(null);
            }}
            className={cn(
              sidebarTabBaseClass,
              activeTab === 'style' ? sidebarTabActiveClass : sidebarTabInactiveClass
            )}
          >
            {t('productKnowledge.sidebar.tabs.style', 'Style')}
          </button>
          <button
            onClick={() => {
              setActiveTab('hooks');
              setSelectedDetail(null);
              setSelectedStyle(null);
              setSelectedHook(null);
              setSelectedKeyword(null);
            }}
            className={cn(
              sidebarTabBaseClass,
              activeTab === 'hooks' ? sidebarTabActiveClass : sidebarTabInactiveClass
            )}
          >
            {t('productKnowledge.sidebar.tabs.hooks', 'Hooks')}
          </button>
          <button
            onClick={() => {
              setActiveTab('keywords');
              setSelectedDetail(null);
              setSelectedStyle(null);
              setSelectedHook(null);
              setSelectedKeyword(null);
            }}
            className={cn(
              sidebarTabBaseClass,
              activeTab === 'keywords' ? sidebarTabActiveClass : sidebarTabInactiveClass
            )}
          >
            {t('productKnowledge.sidebar.tabs.keywords', 'Keyword')}
          </button>
        </div>

        {/* Header Content */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {activeTab === 'knowledge' && selectedDetail ? (
              <button
                onClick={handleBackToList}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title={t('productKnowledge.sidebar.backToList', 'Back to list')}
              >
                <ChevronLeft className="h-5 w-5 text-gray-700" />
              </button>
            ) : activeTab === 'style' && selectedStyle ? (
              <button
                onClick={handleBackToStyleList}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title={t('productKnowledge.style.sidebar.backToList', 'Back to list')}
              >
                <ChevronLeft className="h-5 w-5 text-gray-700" />
              </button>
            ) : activeTab === 'hooks' && selectedHook ? (
              <button
                onClick={handleBackToHooksList}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title={t('productKnowledge.hooks.sidebar.backToList', 'Back to list')}
              >
                <ChevronLeft className="h-5 w-5 text-gray-700" />
              </button>
            ) : activeTab === 'keywords' && selectedKeyword ? (
              <button
                onClick={handleBackToKeywordsList}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title={t('productKnowledge.keywords.sidebar.backToList', 'Back to list')}
              >
                <ChevronLeft className="h-5 w-5 text-gray-700" />
              </button>
            ) : activeTab === 'knowledge' ? (
              <BookOpen className="h-5 w-5 text-gray-700" />
            ) : activeTab === 'style' ? (
              <Palette className="h-5 w-5 text-gray-700" />
            ) : activeTab === 'hooks' ? (
              <Link2 className="h-5 w-5 text-gray-700" />
            ) : (
              <Hash className="h-5 w-5 text-gray-700" />
            )}
              <h2 className="text-lg font-semibold text-gray-800">
                {activeTab === 'knowledge'
                  ? selectedDetail
                    ? t('productKnowledge.sidebar.detailTitle', 'Product Knowledge Detail')
                    : t('productKnowledge.sidebar.title', 'Product Knowledge')
                  : activeTab === 'style'
                    ? selectedStyle
                      ? t('productKnowledge.style.sidebar.detailTitle', 'Style Detail')
                      : t('productKnowledge.sidebar.styleTitle', 'Style')
                    : activeTab === 'hooks'
                      ? selectedHook
                        ? t('productKnowledge.hooks.sidebar.detailTitle', 'Hook Detail')
                        : t('productKnowledge.sidebar.hooksTitle', 'Hooks')
                      : selectedKeyword
                        ? t('productKnowledge.keywords.sidebar.detailTitle', 'Keyword Detail')
                        : t('productKnowledge.sidebar.keywordsTitle', 'Keyword')}
              </h2>
            </div>
            {activeTab === 'knowledge' && !selectedDetail && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingDetail(null);
                  setIsModalOpen(true);
                }}
                className="h-8 px-3"
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('productKnowledgeDetail.sidebar.addButton', 'Add')}
              </Button>
            )}
            {activeTab === 'style' && !selectedStyle && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingStyle(null);
                  setIsStyleModalOpen(true);
                }}
                className="h-8 px-3"
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('productKnowledge.style.sidebar.addButton', 'Add Style')}
              </Button>
            )}
            {activeTab === 'hooks' && !selectedHook && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingHook(null);
                  setIsHooksModalOpen(true);
                }}
                className="h-8 px-3"
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('productKnowledge.hooks.sidebar.addButton', 'Add')}
              </Button>
            )}
            {activeTab === 'keywords' && !selectedKeyword && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingKeyword(null);
                  setIsKeywordModalOpen(true);
                }}
                className="h-8 px-3"
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('productKnowledge.keywords.sidebar.addButton', 'Add Keyword')}
              </Button>
            )}
          </div>

          {/* Search Input - Only show in knowledge tab when not viewing detail */}
          {activeTab === 'knowledge' && !selectedDetail && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder={t('productKnowledge.sidebar.searchPlaceholder', 'Search product knowledge...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-9 h-9 text-sm"
                />
                {searchTerm && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Count */}
              <div className="mt-2 text-xs text-gray-500">
                {filteredData.length} {t('productKnowledge.sidebar.items', 'items')}
              </div>
            </>
          )}

          {/* Search Input - Only show in style tab when not viewing detail */}
          {activeTab === 'style' && !selectedStyle && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder={t('productKnowledge.style.sidebar.searchPlaceholder', 'Search styles...')}
                  value={styleSearchTerm}
                  onChange={(e) => setStyleSearchTerm(e.target.value)}
                  className="pl-9 pr-9 h-9 text-sm"
                />
                {styleSearchTerm && (
                  <button
                    onClick={handleClearStyleSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Count */}
              <div className="mt-2 text-xs text-gray-500">
                {filteredStyleData.length} {t('productKnowledge.style.sidebar.items', 'styles')}
              </div>
            </>
          )}

          {/* Search Input - Only show in hooks tab when not viewing detail */}
          {activeTab === 'hooks' && !selectedHook && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder={t('productKnowledge.hooks.sidebar.searchPlaceholder', 'Search hooks...')}
                  value={hooksSearchTerm}
                  onChange={(e) => setHooksSearchTerm(e.target.value)}
                  className="pl-9 pr-9 h-9 text-sm"
                />
                {hooksSearchTerm && (
                  <button
                    onClick={handleClearHooksSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Count */}
              <div className="mt-2 text-xs text-gray-500">
                {filteredHooksData.length} {t('productKnowledge.hooks.sidebar.items', 'hooks')}
              </div>
            </>
          )}

          {/* Search Input - Only show in keywords tab when not viewing detail */}
          {activeTab === 'keywords' && !selectedKeyword && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder={t('productKnowledge.keywords.sidebar.searchPlaceholder', 'Search keywords...')}
                  value={keywordsSearchTerm}
                  onChange={(e) => setKeywordsSearchTerm(e.target.value)}
                  className="pl-9 pr-9 h-9 text-sm"
                />
                {keywordsSearchTerm && (
                  <button
                    onClick={handleClearKeywordsSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Count */}
              <div className="mt-2 text-xs text-gray-500">
                {filteredKeywordsData.length} {t('productKnowledge.keywords.sidebar.items', 'keywords')}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content Area - rule 3.1: satu scroll per panel, seamless-scroll, nested-scroll-touch-chain, min-h-0 */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain">
        {activeTab === 'keywords' ? (
          selectedKeyword ? (
          /* Keyword Detail View */
          <div className="p-4 space-y-4 pb-4">
            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pb-2 border-b border-gray-200">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingKeyword(selectedKeyword);
                  setIsKeywordModalOpen(true);
                }}
                disabled={isUpdatingKeyword || isDeletingKeyword}
                className="h-8 px-3"
              >
                <Edit className="h-3.5 w-3.5 mr-1.5" />
                {t('productKnowledge.keywords.edit', 'Edit')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!confirm(t('productKnowledge.keywords.deleteConfirm', 'Are you sure you want to delete this keyword?'))) {
                    return;
                  }

                  try {
                    setDeletingKeywordId(selectedKeyword.id);
                    await deleteKeyword(selectedKeyword.id);
                    toast.success(
                      t('productKnowledge.keywords.toast.deleteSuccess', 'Keyword deleted successfully')
                    );
                    setSelectedKeyword(null);
                  } catch (error) {
                    console.error('Error deleting keyword:', error);
                    toast.error(t('productKnowledge.keywords.toast.deleteError', 'Error deleting keyword'));
                  } finally {
                    setDeletingKeywordId(null);
                  }
                }}
                disabled={isUpdatingKeyword || isDeletingKeyword || deletingKeywordId === selectedKeyword.id}
                className="h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {t('productKnowledge.keywords.delete', 'Delete')}
              </Button>
            </div>

            {/* Keyword */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-800">
                {t('productKnowledge.keywords.detail.keyword', 'Keyword')}
              </h3>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-900">{selectedKeyword.keyword}</p>
              </div>
            </div>

            {/* Service */}
            {selectedKeyword.service_name && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-800">
                  {t('productKnowledge.keywords.detail.service', 'Service')}
                </h3>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-700">{selectedKeyword.service_name}</p>
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="pt-2 border-t border-gray-200">
              <div className="text-xs text-gray-500 space-y-1">
                {selectedKeyword.created_at && (
                  <div>
                    {t('productKnowledge.keywords.detail.createdAt', 'Created')}:{' '}
                    {new Date(selectedKeyword.created_at).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
                {selectedKeyword.updated_at && selectedKeyword.updated_at !== selectedKeyword.created_at && (
                  <div>
                    {t('productKnowledge.keywords.detail.updatedAt', 'Updated')}:{' '}
                    {new Date(selectedKeyword.updated_at).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Keywords List View */
          <>
            {isKeywordsLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingDots />
              </div>
            ) : filteredKeywordsData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Hash className="h-12 w-12 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">
                  {keywordsSearchTerm
                    ? t('productKnowledge.keywords.sidebar.noResults', 'No results found')
                    : t('productKnowledge.keywords.sidebar.noData', 'No keywords available')}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredKeywordsData.map((keyword) => (
                  <div
                    key={keyword.id}
                    onClick={() => handleKeywordClick(keyword.id)}
                    className={cn(
                      'p-3 rounded-lg cursor-pointer transition-colors border',
                      selectedKeyword?.id === keyword.id
                        ? sidebarListSelectedShellClass
                        : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3
                          className={cn(
                            'font-medium text-sm line-clamp-2',
                            selectedKeyword?.id === keyword.id ? sidebarListSelectedTitleClass : 'text-gray-900'
                          )}
                        >
                          {keyword.keyword}
                        </h3>
                        {keyword.service_name && (
                          <p className="text-xs text-gray-500 line-clamp-1 mt-1">{keyword.service_name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => handleEditKeyword(keyword, e)}
                          className={cn(
                            'p-1.5 rounded hover:bg-gray-200 transition-colors',
                            selectedKeyword?.id === keyword.id ? sidebarListSelectedActionClass : 'text-gray-600'
                          )}
                          title={t('productKnowledge.keywords.edit', 'Edit keyword')}
                          disabled={isUpdatingKeyword || isDeletingKeyword}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteKeyword(keyword.id, e)}
                          className={cn(
                            'p-1.5 rounded hover:bg-red-100 transition-colors',
                            selectedKeyword?.id === keyword.id ? 'text-red-700' : 'text-red-600',
                            deletingKeywordId === keyword.id && 'opacity-50 cursor-not-allowed'
                          )}
                          title={t('productKnowledge.keywords.delete', 'Delete keyword')}
                          disabled={isUpdatingKeyword || isDeletingKeyword || deletingKeywordId === keyword.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )
        ) : activeTab === 'hooks' ? (
          selectedHook ? (
          /* Hook Detail View */
          <div className="p-4 space-y-4 pb-4">
            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pb-2 border-b border-gray-200">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // Prevent editing default hooks
                  if (selectedHook.organization_id === null) {
                    toast.error(t('productKnowledge.hooks.cannotEditDefault', 'Default hooks cannot be edited'));
                    return;
                  }
                  setEditingHook(selectedHook);
                  setIsHooksModalOpen(true);
                }}
                disabled={isUpdatingHook || isDeletingHook || selectedHook.organization_id === null}
                className="h-8 px-3"
                title={selectedHook.organization_id === null ? t('productKnowledge.hooks.cannotEditDefault', 'Default hooks cannot be edited') : undefined}
              >
                <Edit className="h-3.5 w-3.5 mr-1.5" />
                {t('productKnowledge.hooks.edit', 'Edit')}
              </Button>
              <div className="relative flex items-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    // Prevent deleting default hooks
                    if (selectedHook.organization_id === null) {
                      toast.error(t('productKnowledge.hooks.cannotDeleteDefault', 'Default hooks cannot be deleted'));
                      return;
                    }

                    if (!confirm(t('productKnowledge.hooks.deleteConfirm', 'Are you sure you want to delete this hook?'))) {
                      return;
                    }

                    try {
                      setDeletingHookId(selectedHook.id);
                      await deleteProductKnowledgeHook(selectedHook.id);
                      toast.success(
                        t('productKnowledge.hooks.toast.deleteSuccess', 'Hook deleted successfully')
                      );
                      setSelectedHook(null);
                    } catch (error: any) {
                      console.error('Error deleting hook:', error);
                      toast.error(error?.message || t('productKnowledge.hooks.toast.deleteError', 'Error deleting hook'));
                    } finally {
                      setDeletingHookId(null);
                    }
                  }}
                  disabled={isUpdatingHook || isDeletingHook || deletingHookId === selectedHook.id || selectedHook.organization_id === null}
                  className="h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                  title={selectedHook.organization_id === null ? t('productKnowledge.hooks.cannotDeleteDefault', 'Default hooks cannot be deleted') : undefined}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  {t('productKnowledge.hooks.delete', 'Delete')}
                </Button>
                {/* Green vertical strip indicator for default hooks */}
                {selectedHook.organization_id === null && (
                  <div className="w-1 h-6 bg-green-500 rounded ml-1" />
                )}
              </div>
            </div>

            {/* Hook Name */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-800">
                {t('productKnowledge.hooks.detail.name', 'Hook Name')}
              </h3>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-900">{selectedHook.name}</p>
              </div>
            </div>

            {/* Hook Description */}
            {selectedHook.description && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-800">
                  {t('productKnowledge.hooks.detail.description', 'Description')}
                </h3>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p
                    className="text-sm text-gray-700 whitespace-pre-wrap break-words"
                    style={{ wordBreak: 'break-word' }}
                  >
                    {selectedHook.description}
                  </p>
                </div>
              </div>
            )}

            {/* Hook Content */}
            {selectedHook.hook_content && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-800">
                  {t('productKnowledge.hooks.detail.content', 'Hook Content')}
                </h3>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p
                    className="text-sm text-gray-700 whitespace-pre-wrap break-words"
                    style={{ wordBreak: 'break-word' }}
                  >
                    {selectedHook.hook_content}
                  </p>
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="pt-2 border-t border-gray-200">
              <div className="text-xs text-gray-500 space-y-1">
                {selectedHook.created_at && (
                  <div>
                    {t('productKnowledge.hooks.detail.createdAt', 'Created')}:{' '}
                    {new Date(selectedHook.created_at).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
                {selectedHook.updated_at && selectedHook.updated_at !== selectedHook.created_at && (
                  <div>
                    {t('productKnowledge.hooks.detail.updatedAt', 'Updated')}:{' '}
                    {new Date(selectedHook.updated_at).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Hooks List View */
          <>
            {isHooksLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingDots />
              </div>
            ) : filteredHooksData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Link2 className="h-12 w-12 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">
                  {hooksSearchTerm
                    ? t('productKnowledge.hooks.sidebar.noResults', 'No results found')
                    : t('productKnowledge.hooks.sidebar.noData', 'No hooks available')}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredHooksData.map((hook) => (
                  <div
                    key={hook.id}
                    onClick={() => handleHookClick(hook.id)}
                    className={cn(
                      'p-3 rounded-lg cursor-pointer transition-colors border',
                      selectedHook?.id === hook.id
                        ? sidebarListSelectedShellClass
                        : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3
                          className={cn(
                            'font-medium text-sm line-clamp-2',
                            selectedHook?.id === hook.id ? sidebarListSelectedTitleClass : 'text-gray-900'
                          )}
                        >
                          {hook.name}
                        </h3>
                        {hook.description && (
                          <p className="text-xs text-gray-500 line-clamp-2 mt-1">{hook.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => handleEditHook(hook, e)}
                          className={cn(
                            'p-1.5 rounded transition-colors',
                            hook.organization_id === null 
                              ? 'text-gray-400 cursor-not-allowed opacity-50' 
                              : selectedHook?.id === hook.id
                                ? `${sidebarListSelectedActionClass} hover:bg-muted/80`
                                : 'text-gray-600 hover:bg-gray-200'
                          )}
                          title={hook.organization_id === null 
                            ? t('productKnowledge.hooks.cannotEditDefault', 'Default hooks cannot be edited') 
                            : t('productKnowledge.hooks.edit', 'Edit hook')}
                          disabled={isUpdatingHook || isDeletingHook || hook.organization_id === null}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <div className="relative flex items-center">
                          <button
                            onClick={(e) => handleDeleteHook(hook.id, e)}
                            className={cn(
                              'p-1.5 rounded transition-colors',
                              hook.organization_id === null 
                                ? 'text-gray-400 cursor-not-allowed opacity-50' 
                                : selectedHook?.id === hook.id 
                                  ? 'text-red-700 hover:bg-red-100' 
                                  : 'text-red-600 hover:bg-red-100',
                              deletingHookId === hook.id && 'opacity-50 cursor-not-allowed'
                            )}
                            title={hook.organization_id === null 
                              ? t('productKnowledge.hooks.cannotDeleteDefault', 'Default hooks cannot be deleted') 
                              : t('productKnowledge.hooks.delete', 'Delete hook')}
                            disabled={isUpdatingHook || isDeletingHook || deletingHookId === hook.id || hook.organization_id === null}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          {/* Green vertical strip indicator for default hooks */}
                          {hook.organization_id === null && (
                            <div className="w-1 h-6 bg-green-500 rounded ml-1" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )
        ) : activeTab === 'knowledge' ? (
          selectedDetail ? (
          /* Detail View */
          <div className="p-4 space-y-4">
            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pb-2 border-b border-gray-200">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingDetail(selectedDetail);
                  setIsModalOpen(true);
                }}
                disabled={isUpdatingDetail || isDeletingDetail}
                className="h-8 px-3"
              >
                <Edit className="h-3.5 w-3.5 mr-1.5" />
                {t('productKnowledgeDetail.edit', 'Edit')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDeleteDetail(selectedDetail.id, { stopPropagation: () => {} } as React.MouseEvent)}
                disabled={isUpdatingDetail || isDeletingDetail || deletingDetailId === selectedDetail.id}
                className="h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {t('productKnowledgeDetail.delete', 'Delete')}
              </Button>
            </div>

            {/* Service/Sub Service Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="font-medium">
                  {t('productKnowledge.detail.service', 'Service')}:
                </span>
                <span>{selectedDetail.service_name || t('productKnowledge.detail.notSet', 'Not set')}</span>
              </div>
              {selectedDetail.sub_service_name && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="font-medium">
                    {t('productKnowledge.detail.subService', 'Sub Service')}:
                  </span>
                  <span>{selectedDetail.sub_service_name}</span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200"></div>

            {/* Full Content */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-800">
                  {t('productKnowledge.detail.content', 'Product Knowledge Content')}
                </h3>
                {selectedDetail.product_knowledge_content && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyContent(selectedDetail.product_knowledge_content)}
                    className="h-7 px-2 text-xs"
                    title={t('productKnowledgeDetail.copy', 'Copy content')}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    {t('productKnowledgeDetail.copy', 'Copy')}
                  </Button>
                )}
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p
                  className="text-sm text-gray-700 whitespace-pre-wrap break-words"
                  style={{ wordBreak: 'break-word' }}
                >
                  {selectedDetail.product_knowledge_content || t('productKnowledge.detail.noContent', 'No content available')}
                </p>
              </div>
            </div>

            {/* Metadata */}
            <div className="pt-2 border-t border-gray-200">
              <div className="text-xs text-gray-500 space-y-1">
                {selectedDetail.created_at && (
                  <div>
                    {t('productKnowledge.detail.createdAt', 'Created')}:{' '}
                    {new Date(selectedDetail.created_at).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
                {selectedDetail.updated_at && selectedDetail.updated_at !== selectedDetail.created_at && (
                  <div>
                    {t('productKnowledge.detail.updatedAt', 'Updated')}:{' '}
                    {new Date(selectedDetail.updated_at).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* List View */
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingDots />
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <BookOpen className="h-12 w-12 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">
                  {searchTerm
                    ? t('productKnowledge.sidebar.noResults', 'No results found')
                    : t('productKnowledge.sidebar.noData', 'No product knowledge available')}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredData.map((item) => {
                  const isSelected = selectedItemId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item.id)}
                      className={cn(
                        'p-3 rounded-lg cursor-pointer transition-colors border',
                        isSelected
                          ? sidebarListSelectedShellClass
                          : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3
                          className={cn(
                            'font-medium text-sm line-clamp-2 flex-1',
                            isSelected ? sidebarListSelectedTitleClass : 'text-gray-900'
                          )}
                        >
                          {getProductServiceName(item) !== 'N/A'
                            ? getProductServiceName(item)
                            : t('productKnowledge.sidebar.unnamed', 'Unnamed')}
                        </h3>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={(e) => handleEditDetail(item, e)}
                            className={cn(
                              'p-1.5 rounded hover:bg-gray-200 transition-colors',
                              isSelected ? sidebarListSelectedActionClass : 'text-gray-600'
                            )}
                            title={t('productKnowledgeDetail.edit', 'Edit product knowledge detail')}
                            disabled={isUpdatingDetail || isDeletingDetail}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteDetail(item.id, e)}
                            className={cn(
                              'p-1.5 rounded hover:bg-red-100 transition-colors',
                              isSelected ? 'text-red-700' : 'text-red-600',
                              deletingDetailId === item.id && 'opacity-50 cursor-not-allowed'
                            )}
                            title={t('productKnowledgeDetail.delete', 'Delete product knowledge detail')}
                            disabled={isUpdatingDetail || isDeletingDetail || deletingDetailId === item.id}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Product Knowledge Content Preview */}
                      {item.product_knowledge_content && (
                        <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                          {item.product_knowledge_content}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
          )
        ) : selectedStyle ? (
          /* Style Detail View */
          <div className="p-4 space-y-4 pb-4">
            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pb-2 border-b border-gray-200">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingStyle(selectedStyle);
                  setIsStyleModalOpen(true);
                }}
                disabled={isUpdatingStyle || isDeletingStyle}
                className="h-8 px-3"
              >
                <Edit className="h-3.5 w-3.5 mr-1.5" />
                {t('productKnowledge.style.edit', 'Edit')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!confirm(t('productKnowledge.style.deleteConfirm', 'Are you sure you want to delete this style?'))) {
                    return;
                  }

                  try {
                    setDeletingStyleId(selectedStyle.id);
                    await deleteProductKnowledgeStyle(selectedStyle.id);
                    toast.success(
                      t('productKnowledge.style.toast.deleteSuccess', 'Style deleted successfully')
                    );
                    setSelectedStyle(null);
                  } catch (error) {
                    console.error('Error deleting style:', error);
                    toast.error(t('productKnowledge.style.toast.deleteError', 'Error deleting style'));
                  } finally {
                    setDeletingStyleId(null);
                  }
                }}
                disabled={isUpdatingStyle || isDeletingStyle || deletingStyleId === selectedStyle.id}
                className="h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {t('productKnowledge.style.delete', 'Delete')}
              </Button>
            </div>

            {/* Style Name */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-800">
                {t('productKnowledge.style.detail.name', 'Style Name')}
              </h3>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-900">{selectedStyle.name}</p>
              </div>
            </div>

            {/* Style Description */}
            {selectedStyle.description && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-800">
                  {t('productKnowledge.style.detail.description', 'Description')}
                </h3>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p
                    className="text-sm text-gray-700 whitespace-pre-wrap break-words"
                    style={{ wordBreak: 'break-word' }}
                  >
                    {selectedStyle.description}
                  </p>
                </div>
              </div>
            )}

            {/* Style Structure */}
            {selectedStyle.structure && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-800">
                  {t('productKnowledge.style.detail.structure', 'Structure')}
                </h3>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p
                    className="text-sm text-gray-700 whitespace-pre-wrap break-words"
                    style={{ wordBreak: 'break-word' }}
                  >
                    {selectedStyle.structure}
                  </p>
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="pt-2 border-t border-gray-200">
              <div className="text-xs text-gray-500 space-y-1">
                {selectedStyle.created_at && (
                  <div>
                    {t('productKnowledge.style.detail.createdAt', 'Created')}:{' '}
                    {new Date(selectedStyle.created_at).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
                {selectedStyle.updated_at && selectedStyle.updated_at !== selectedStyle.created_at && (
                  <div>
                    {t('productKnowledge.style.detail.updatedAt', 'Updated')}:{' '}
                    {new Date(selectedStyle.updated_at).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Style List View */
          <>
            {isStylesLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingDots />
              </div>
            ) : filteredStyleData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Palette className="h-12 w-12 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">
                  {styleSearchTerm
                    ? t('productKnowledge.style.sidebar.noResults', 'No results found')
                    : t('productKnowledge.style.sidebar.noData', 'No styles available')}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredStyleData.map((style) => (
                  <div
                    key={style.id}
                    onClick={() => handleStyleClick(style.id)}
                    className={cn(
                      'p-3 rounded-lg cursor-pointer transition-colors border',
                      selectedStyle?.id === style.id
                        ? sidebarListSelectedShellClass
                        : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3
                          className={cn(
                            'font-medium text-sm line-clamp-2',
                            selectedStyle?.id === style.id ? sidebarListSelectedTitleClass : 'text-gray-900'
                          )}
                        >
                          {style.name}
                        </h3>
                        {style.description && (
                          <p className="text-xs text-gray-500 line-clamp-2 mt-1">{style.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => handleEditStyle(style, e)}
                          className={cn(
                            'p-1.5 rounded hover:bg-gray-200 transition-colors',
                            selectedStyle?.id === style.id ? sidebarListSelectedActionClass : 'text-gray-600'
                          )}
                          title={t('productKnowledge.style.edit', 'Edit style')}
                          disabled={isUpdatingStyle || isDeletingStyle}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteStyle(style.id, e)}
                          className={cn(
                            'p-1.5 rounded hover:bg-red-100 transition-colors',
                            selectedStyle?.id === style.id ? 'text-red-700' : 'text-red-600',
                            deletingStyleId === style.id && 'opacity-50 cursor-not-allowed'
                          )}
                          title={t('productKnowledge.style.delete', 'Delete style')}
                          disabled={isUpdatingStyle || isDeletingStyle || deletingStyleId === style.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>

      {/* Footer */}
      <ProductKnowledgeSidebarFooter
        totalItems={
          activeTab === 'knowledge'
            ? filteredData.length
            : activeTab === 'style'
              ? filteredStyleData.length
              : activeTab === 'hooks'
                ? filteredHooksData.length
                : filteredKeywordsData.length
        }
      />

      {/* Modals */}
      <ProductKnowledgeDetailModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setEditingDetail(null);
          }
        }}
        onSave={handleSaveDetail}
        isLoading={isCreating || isUpdatingDetail}
        initialData={editingDetail}
      />
      <StyleModal
        open={isStyleModalOpen}
        onOpenChange={(open) => {
          setIsStyleModalOpen(open);
          if (!open) {
            setEditingStyle(null);
          }
        }}
        onSave={handleSaveStyle}
        isLoading={isCreatingStyle || isUpdatingStyle}
        initialData={editingStyle}
      />
      <HooksModal
        open={isHooksModalOpen}
        onOpenChange={(open) => {
          setIsHooksModalOpen(open);
          if (!open) {
            setEditingHook(null);
          }
        }}
        onSave={handleSaveHook}
        isLoading={isCreatingHook || isUpdatingHook}
        initialData={editingHook}
      />
      <KeywordModal
        open={isKeywordModalOpen}
        onOpenChange={(open) => {
          setIsKeywordModalOpen(open);
          if (!open) {
            setEditingKeyword(null);
          }
        }}
        onSave={handleSaveKeyword}
        onSaveMultiple={handleSaveMultipleKeywords}
        onSaveAndAddAnother={handleSaveAndAddAnotherKeyword}
        onSwitchToAddMode={() => {
          setEditingKeyword(null);
        }}
        isLoading={isCreatingKeyword || isCreatingMultipleKeywords || isUpdatingKeyword}
        initialData={editingKeyword}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('productKnowledgeDetail.deleteTitle', 'Delete Product Knowledge Detail')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('productKnowledgeDetail.deleteConfirm', 'Are you sure you want to delete this product knowledge detail? This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteConfirmOpen(false);
                setPendingDeleteDetailId(null);
              }}
            >
              {t('common.cancel', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteDetail}
              disabled={isDeletingDetail}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeletingDetail
                ? t('common.deleting', 'Deleting...')
                : t('productKnowledgeDetail.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

