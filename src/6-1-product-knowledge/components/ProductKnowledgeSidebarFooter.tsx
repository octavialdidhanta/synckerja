import { BookOpen, FileText } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface ProductKnowledgeSidebarFooterProps {
  totalItems: number;
}

export const ProductKnowledgeSidebarFooter = ({ 
  totalItems 
}: ProductKnowledgeSidebarFooterProps) => {
  const { t } = useAppTranslation();

  return (
    <div className="flex-shrink-0 px-2 py-2.5 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between gap-2 px-2 text-xs text-gray-500">
        <span className="flex items-center gap-1 truncate">
          <BookOpen className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">
            {t('productKnowledge.sidebar.footer.totalItems', 'Product Knowledge')}
          </span>
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
          <FileText className="h-3 w-3" />
          {totalItems} {t('productKnowledge.sidebar.footer.items', 'items')}
        </span>
      </div>
    </div>
  );
};

