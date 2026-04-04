import React from 'react';
import { Settings } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { ProductKnowledge } from '../hooks/useProductKnowledge';
import type { ProductKnowledgeFeature } from '../hooks/useProductKnowledgeFeatures';
import { FeatureManager } from './FeatureManager';
import { ServiceManager } from '@/6-1-dashboard/container/master-data/dropdowns/ServiceManager';
import { SubServiceManager } from '@/6-1-dashboard/container/master-data/dropdowns/SubServiceManager';
import type { Service } from '@/6-1-dashboard/types/social-media';

interface ProductKnowledgeTableFooterProps {
  masterFeatures: ProductKnowledgeFeature[];
  allProductKnowledgeRows: ProductKnowledge[];
  services: Service[];
  onDataChange: () => void;
  onMasterFeatureUpdated?: (featureId: string, payload: { feature_name: string; feature_description: string | null; solution: string | null; competitive_advantage: unknown }) => void;
}

export const ProductKnowledgeTableFooter: React.FC<ProductKnowledgeTableFooterProps> = ({
  masterFeatures,
  allProductKnowledgeRows,
  services,
  onDataChange,
  onMasterFeatureUpdated,
}) => {
  const { t } = useAppTranslation();
  return (
    <div className="flex-shrink-0 px-2 py-1.5 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-2">
          <Settings className="h-3 w-3 text-gray-600" />
          <span className="text-xs font-medium text-gray-700">
            {t('productKnowledge.masterData.label', 'Master Data')}:
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5">
            <span className="text-xs text-gray-600">{t('productKnowledge.masterData.services', 'Services')}</span>
            <ServiceManager onDataChange={onDataChange} />
          </div>
          <div className="flex items-center gap-0.5">
            <span className="text-xs text-gray-600">{t('productKnowledge.masterData.subServices', 'Sub Services')}</span>
            <SubServiceManager onDataChange={onDataChange} services={services} />
          </div>
          <div className="flex items-center gap-0.5">
            <span className="text-xs text-gray-600">{t('productKnowledge.masterData.feature', 'Feature')}</span>
            <FeatureManager
              masterFeatures={masterFeatures}
              allProductKnowledgeRows={allProductKnowledgeRows}
              services={services}
              onDataChange={onDataChange}
              onMasterFeatureUpdated={onMasterFeatureUpdated}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
