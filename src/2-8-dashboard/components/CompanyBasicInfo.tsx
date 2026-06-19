
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { MapPin, Phone, Globe, Mail, Calendar, Users, Hash, Briefcase, Building2 } from 'lucide-react';
import { useCompanyProfile } from '../hooks';

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
}

export const CompanyBasicInfo = ({ 
  companyData, 
  formData: propFormData,
  isEditMode, 
  onFieldChange 
}: CompanyBasicInfoProps) => {
  const { data: realCompanyData } = useCompanyProfile();
  
  // Use prop formData if provided, otherwise use companyData
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

  // Use realCompanyData for display if available, fallback to formData or companyData
  const displayData = realCompanyData || formData || companyData;
  
  const infoItems = [
    {
      icon: Building2,
      label: 'Company Name',
      field: 'company_name',
      value: isEditMode ? formData.company_name : (displayData.company_name || companyData.company_name),
    },
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
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 pb-3">
        <CardTitle className="text-lg sm:text-xl font-semibold truncate">Company Information</CardTitle>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="secondary" className="text-xs whitespace-nowrap">
            Basic Info
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {infoItems.map((item, index) => (
            <div key={index} className="flex items-start space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-lg bg-muted/60 min-w-0">
              <item.icon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <Label className="text-xs sm:text-sm font-medium text-foreground">{item.label}</Label>
                {isEditMode && !item.readOnly ? (
                  <Input
                    value={formData[item.field as keyof typeof formData] || ''}
                    onChange={(e) => handleInputChange(item.field, e.target.value)}
                    className="mt-1 text-xs sm:text-sm"
                    placeholder={`Enter ${item.label.toLowerCase()}`}
                  />
                ) : (
                  <p className="text-xs sm:text-sm text-muted-foreground break-words mt-1">{item.value}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        
            <div className="mt-4 sm:mt-6 p-3 sm:p-4 rounded-lg bg-accent/80 border border-border">
          <h4 className="text-sm sm:text-base font-medium text-accent-foreground mb-2">Company Description</h4>
          {isEditMode ? (
            <Textarea
              value={formData.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className="text-xs sm:text-sm resize-none"
              placeholder="Enter company description"
            />
          ) : (
            <p className="text-xs sm:text-sm text-accent-foreground break-words leading-relaxed">
              {displayData.description || companyData.description || 'No description provided'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
