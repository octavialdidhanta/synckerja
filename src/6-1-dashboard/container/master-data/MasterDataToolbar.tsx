
import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Settings } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/shared/components/ui/dropdown-menu';
import { ContentTypeManager } from './dropdowns/ContentTypeManager';
import { ServiceManager } from './dropdowns/ServiceManager';
import { SubServiceManager } from './dropdowns/SubServiceManager';
import { ContentPillarManager } from './dropdowns/ContentPillarManager';
import { SocialMediaNameManager } from './dropdowns/SocialMediaNameManager';
import { Service } from '../../types/social-media';

interface MasterDataToolbarProps {
  onContentTypeDataChange: () => void;
  onServiceDataChange: () => void;
  onContentPillarDataChange: () => void;
  onSocialMediaNameDataChange?: () => void;
  services: Service[];
}

export const MasterDataToolbar: React.FC<MasterDataToolbarProps> = React.memo(({
  onContentTypeDataChange,
  onServiceDataChange,
  onContentPillarDataChange,
  onSocialMediaNameDataChange,
  services
}) => {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1 bg-gray-50 border-t border-gray-200">
      <div className="flex items-center gap-2">
        <Settings className="h-3 w-3 text-gray-600" />
        <span className="text-xs font-medium text-gray-700">Master Data:</span>
      </div>
      
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5">
          <span className="text-xs text-gray-600">Content Types</span>
          <ContentTypeManager onDataChange={onContentTypeDataChange} />
        </div>
        
        <div className="flex items-center gap-0.5">
          <span className="text-xs text-gray-600">Services</span>
          <ServiceManager onDataChange={onServiceDataChange} />
        </div>

        <div className="flex items-center gap-0.5">
          <span className="text-xs text-gray-600">Sub Services</span>
          <SubServiceManager onDataChange={onServiceDataChange} services={services} />
        </div>
        
        <div className="flex items-center gap-0.5">
          <span className="text-xs text-gray-600">Content Pillars</span>
          <ContentPillarManager onDataChange={onContentPillarDataChange} />
        </div>

        <div className="flex items-center gap-0.5">
          <span className="text-xs text-gray-600">Social Media Names</span>
          <SocialMediaNameManager onDataChange={onSocialMediaNameDataChange} />
        </div>
      </div>
    </div>
  );
});

MasterDataToolbar.displayName = 'MasterDataToolbar';
