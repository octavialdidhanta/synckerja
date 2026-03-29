import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Plus, Edit, Save, X, Trash2, MoreVertical, MapPin } from 'lucide-react';
import { useToast } from '@/shared/components/ui/use-toast';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface AddressApplicationTabProps {
  candidate: any;
  onUpdate: (data: any) => void;
  isReadOnly?: boolean;
}

export const AddressApplicationTab = ({ candidate, onUpdate, isReadOnly = false }: AddressApplicationTabProps) => {
  const [formData, setFormData] = useState({
    address: candidate?.address || '',
    citizen_address: candidate?.citizen_address || '',
    postal_code: candidate?.postal_code || ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { t } = useAppTranslation();

  // Update formData when candidate changes
  useEffect(() => {
    setFormData({
      address: candidate?.address || '',
      citizen_address: candidate?.citizen_address || '',
      postal_code: candidate?.postal_code || ''
    });
  }, [candidate]);

  // Check if address data exists
  const hasAddressData = candidate?.address || candidate?.citizen_address || candidate?.postal_code;

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!formData.address || !formData.citizen_address) {
      toast({
        title: "Validation Error",
        description: t('candidateProfile.address.toastValidation', 'Current Address and ID Card Address are required.'),
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      await onUpdate(formData);
      setIsEditing(false);
      toast({
        title: "Success",
        description: t('candidateProfile.address.toastSaved', 'Address information saved successfully.'),
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Error",
        description: t('candidateProfile.address.toastSaveFailed', 'Failed to save address information.'),
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      address: candidate?.address || '',
      citizen_address: candidate?.citizen_address || '',
      postal_code: candidate?.postal_code || ''
    });
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleDelete = async () => {
    if (window.confirm(t('candidateProfile.address.confirmDelete', 'Are you sure you want to delete the address information?'))) {
      setSaving(true);
      try {
        await onUpdate({
          address: '',
          citizen_address: '',
          postal_code: ''
        });
        toast({
          title: "Success",
          description: t('candidateProfile.address.toastDeleted', 'Address information deleted successfully.'),
        });
      } catch (error) {
        console.error('Delete error:', error);
        toast({
          title: "Error",
          description: t('candidateProfile.address.toastDeleteFailed', 'Failed to delete address information.'),
          variant: "destructive"
        });
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            <span>{t('candidateProfile.address.sectionTitle', 'Address Information')}</span>
            {saving && <span className="text-sm text-gray-500 ml-2">{t('common.saving', 'Saving...')}</span>}
          </div>
          {!isEditing && !isReadOnly && (
            <Button
              size="sm"
              onClick={hasAddressData ? handleEdit : () => setIsEditing(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {hasAddressData ? (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  {t('candidateProfile.address.editAddress', 'Edit Address')}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('candidateProfile.address.addAddress', 'Add Address')}
                </>
              )}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 min-h-[500px]">
          {isEditing ? (
            <Card className="border-2 border-blue-200">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>
                      {t('candidateProfile.address.currentAddress', 'Current Address')} <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      disabled={isReadOnly}
                      required
                      rows={3}
                      placeholder={t('candidateProfile.address.placeholderCurrent', 'Enter your current address')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      {t('candidateProfile.address.idAddress', 'ID Card Address')} <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      value={formData.citizen_address}
                      onChange={(e) => handleInputChange('citizen_address', e.target.value)}
                      disabled={isReadOnly}
                      required
                      rows={3}
                      placeholder={t('candidateProfile.address.placeholderId', 'Enter address as on ID card')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('candidateProfile.address.postalCode', 'Postal Code')}</Label>
                    <Input
                      value={formData.postal_code}
                      onChange={(e) => handleInputChange('postal_code', e.target.value)}
                      disabled={isReadOnly}
                      placeholder={t('candidateProfile.address.placeholderPostal', 'Enter postal code')}
                      maxLength={5}
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                  >
                    <X className="h-4 w-4 mr-2" />
                    {t('common.cancel', 'Cancel')}
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving || !formData.address || !formData.citizen_address}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : hasAddressData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('candidateProfile.address.currentAddress', 'Current Address')}</Label>
                  <div className="p-3 bg-gray-50 rounded-md border min-h-[100px]">
                    <p className="text-sm text-gray-700">{candidate?.address || '-'}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('candidateProfile.address.idAddress', 'ID Card Address')}</Label>
                  <div className="p-3 bg-gray-50 rounded-md border min-h-[100px]">
                    <p className="text-sm text-gray-700">{candidate?.citizen_address || '-'}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('candidateProfile.address.postalCode', 'Postal Code')}</Label>
                  <div className="p-3 bg-gray-50 rounded-md border min-h-[44px]">
                    <p className="text-sm text-gray-700">{candidate?.postal_code || '-'}</p>
                  </div>
                </div>
              </div>
              
              {!isReadOnly && (
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEdit}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    {t('candidateProfile.address.editAddress', 'Edit Address')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('common.delete', 'Delete')}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 min-h-[400px]">
              <MapPin className="h-12 w-12 text-gray-300 mb-4" />
              <p className="text-base font-medium">{t('candidateProfile.address.noAddressFound', 'No address information found.')}</p>
              <p className="text-sm mt-2">{t('candidateProfile.address.clickToAdd', 'Click "Add Address" to get started.')}</p>
            </div>
          )}
          
          {/* Spacer to match Personal Info tab height */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="text-red-500">*</span> {t('candidateProfile.address.requiredNotice', 'Current Address and ID Card Address are required to complete your profile.')}
            </p>
          </div>
        </CardContent>
      </Card>
  );
};
