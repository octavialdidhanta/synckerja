
import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Edit, Save, X } from 'lucide-react';
import { CompanyProfilePhoto } from './CompanyProfilePhoto';

interface CompanyProfileHeaderProps {
  companyName: string;
  logoUrl?: string | null;
  isEditMode: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving?: boolean;
  onLogoUpdate: (logoUrl: string | null) => void;
  onCompanyNameChange?: (value: string) => void;
}

export const CompanyProfileHeader = ({ 
  companyName, 
  logoUrl, 
  isEditMode,
  onEdit,
  onCancel,
  onSave,
  isSaving = false,
  onLogoUpdate,
  onCompanyNameChange,
}: CompanyProfileHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 lg:mb-8">
      <div className="flex items-center space-x-3 sm:space-x-4 lg:space-x-6 min-w-0 flex-1">
        <div className="flex-shrink-0">
          <CompanyProfilePhoto 
            companyName={companyName}
            logoUrl={logoUrl}
            onLogoUpdate={onLogoUpdate}
          />
        </div>
        <div className="min-w-0 flex-1">
          {isEditMode ? (
            <Input
              value={companyName}
              onChange={(e) => onCompanyNameChange?.(e.target.value)}
              className="text-xl sm:text-2xl lg:text-3xl font-bold h-auto py-1.5 sm:py-2"
              placeholder="Company name"
              aria-label="Company name"
            />
          ) : (
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground truncate">
              {companyName || 'Company Name'}
            </h1>
          )}
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Company Profile</p>
        </div>
      </div>
      <div className="flex-shrink-0">
        {isEditMode ? (
          <div className="flex items-center gap-2">
            <Button 
              onClick={onCancel} 
              variant="outline" 
              className="flex items-center space-x-2"
              size="sm"
              disabled={isSaving}
            >
              <X className="h-4 w-4" />
              <span className="whitespace-nowrap">Cancel</span>
            </Button>
            <Button 
              onClick={onSave} 
              className="flex items-center space-x-2"
              size="sm"
              disabled={isSaving}
            >
              <Save className="h-4 w-4" />
              <span className="whitespace-nowrap">{isSaving ? 'Saving...' : 'Save'}</span>
            </Button>
          </div>
        ) : (
          <Button 
            onClick={onEdit} 
            variant="outline" 
            className="flex items-center space-x-2 w-full sm:w-auto"
            size="sm"
          >
            <Edit className="h-4 w-4" />
            <span className="whitespace-nowrap">Edit Company Details</span>
          </Button>
        )}
      </div>
    </div>
  );
};
