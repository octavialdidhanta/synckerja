
import React from 'react';
import { Card, CardContent, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { MapPin, Phone, Globe, Mail, Calendar, Users, Hash, Briefcase, Edit, Save, X } from 'lucide-react';
import { useCompanyProfile } from '../hooks';
import { CompanyProfilePhoto } from './CompanyProfilePhoto';

interface CompanyData {
  company_name: string;
  address: string;
  phone_number: string;
  website: string;
  email: string;
  established?: string;
  employee_count: string;
  tax_id: string;
  industry: string;
  description: string;
}

interface CompanyBasicInfoProps {
  companyData: CompanyData;
  formData?: any;
  isEditMode: boolean;
  onFieldChange?: (field: string, value: string) => void;
  logoUrl?: string | null;
  onLogoUpdate?: (logoUrl: string | null) => void;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
}

export const CompanyBasicInfo = ({ 
  companyData, 
  formData: propFormData,
  isEditMode, 
  onFieldChange,
  logoUrl,
  onLogoUpdate,
  onEdit,
  onCancel,
  onSave,
  isSaving = false,
}: CompanyBasicInfoProps) => {
  const { data: realCompanyData } = useCompanyProfile();
  
  const formData = propFormData || {
    company_name: companyData.company_name || '',
    address: companyData.address || '',
    phone_number: companyData.phone_number || '',
    website: companyData.website || '',
    email: companyData.email || '',
    industry: companyData.industry || '',
    description: companyData.description || '',
    tax_id: companyData.tax_id || '',
    established: companyData.established || '',
  };

  const handleInputChange = (field: string, value: string) => {
    if (onFieldChange) {
      onFieldChange(field, value);
    }
  };

  const displayData = realCompanyData || formData || companyData;
  const companyName = isEditMode
    ? formData.company_name
    : (displayData.company_name || companyData.company_name || 'Company Name');

  // Company name lives beside the logo — keep remaining fields aligned with the logo column
  const infoItems = [
    { icon: MapPin, label: 'Address', field: 'address', value: isEditMode ? formData.address : (displayData.address || companyData.address) },
    { icon: Phone, label: 'Phone', field: 'phone_number', value: isEditMode ? formData.phone_number : (displayData.phone_number || companyData.phone_number) },
    { icon: Globe, label: 'Website', field: 'website', value: isEditMode ? formData.website : (displayData.website || companyData.website) },
    { icon: Mail, label: 'Email', field: 'email', value: isEditMode ? formData.email : (displayData.email || companyData.email) },
    { icon: Calendar, label: 'Established', field: 'established', value: isEditMode ? formData.established : (displayData.established || companyData.established) },
    { icon: Users, label: 'Employees', field: 'employee_count', value: `${companyData.employee_count} employees`, readOnly: true },
    { icon: Hash, label: 'Tax ID', field: 'tax_id', value: isEditMode ? formData.tax_id : (displayData.tax_id || companyData.tax_id) },
    { icon: Briefcase, label: 'Industry', field: 'industry', value: isEditMode ? formData.industry : (displayData.industry || companyData.industry) },
  ];

  return (
    <Card className="min-w-0">
      <CardContent className="space-y-4 pt-4 sm:space-y-6 sm:pt-6">
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:gap-5 lg:gap-6">
          {/* Logo + company name — left column, aligned with field grid */}
          <div className="flex w-full shrink-0 flex-col items-center gap-2 sm:w-[140px] lg:w-[160px]">
            {onLogoUpdate ? (
              <CompanyProfilePhoto
                companyName={companyName}
                logoUrl={logoUrl}
                onLogoUpdate={onLogoUpdate}
              />
            ) : null}
            {isEditMode ? (
              <Input
                value={formData.company_name || ''}
                onChange={(e) => handleInputChange('company_name', e.target.value)}
                className="h-auto py-1.5 text-center text-base font-semibold sm:text-lg"
                placeholder="Company name"
                aria-label="Company name"
              />
            ) : (
              <h3 className="w-full truncate text-center text-base font-semibold text-foreground sm:text-lg">
                {companyName}
              </h3>
            )}
          </div>

          {/* Title sits above fields only — not above the logo */}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <CardTitle className="truncate text-lg font-semibold sm:text-xl">
                  Company Information
                </CardTitle>
                <Badge variant="secondary" className="shrink-0 whitespace-nowrap text-xs">
                  Basic Info
                </Badge>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isEditMode ? (
                  <>
                    <Button
                      type="button"
                      onClick={onCancel}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                      disabled={isSaving}
                    >
                      <X className="h-4 w-4" />
                      <span className="whitespace-nowrap">Cancel</span>
                    </Button>
                    <Button
                      type="button"
                      onClick={onSave}
                      size="sm"
                      className="flex items-center gap-2"
                      disabled={isSaving}
                    >
                      <Save className="h-4 w-4" />
                      <span className="whitespace-nowrap">{isSaving ? 'Saving...' : 'Save'}</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    onClick={onEdit}
                    variant="outline"
                    size="sm"
                    className="flex w-full items-center gap-2 sm:w-auto"
                  >
                    <Edit className="h-4 w-4" />
                    <span className="whitespace-nowrap">Edit Company Details</span>
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {infoItems.map((item) => (
                <div
                  key={item.field}
                  className="flex min-w-0 items-start space-x-2 rounded-lg bg-muted/60 p-2 sm:space-x-3 sm:p-3"
                >
                  <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground sm:h-5 sm:w-5" />
                  <div className="min-w-0 flex-1">
                    <Label className="text-xs font-medium text-foreground sm:text-sm">{item.label}</Label>
                    {isEditMode && !item.readOnly ? (
                      <Input
                        value={formData[item.field as keyof typeof formData] || ''}
                        onChange={(e) => handleInputChange(item.field, e.target.value)}
                        className="mt-1 text-xs sm:text-sm"
                        placeholder={`Enter ${item.label.toLowerCase()}`}
                      />
                    ) : (
                      <p className="mt-1 break-words text-xs text-muted-foreground sm:text-sm">
                        {item.value || '—'}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="rounded-lg border border-border bg-accent/80 p-3 sm:p-4">
          <h4 className="mb-2 text-sm font-medium text-accent-foreground sm:text-base">Company Description</h4>
          {isEditMode ? (
            <Textarea
              value={formData.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className="resize-none text-xs sm:text-sm"
              placeholder="Enter company description"
            />
          ) : (
            <p className="break-words text-xs leading-relaxed text-accent-foreground sm:text-sm">
              {displayData.description || companyData.description || 'No description provided'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
