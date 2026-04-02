
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Loader2, Building } from 'lucide-react';
import { useClients } from '@/features/2-3-settings/hooks/useLocationManagement';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface AddClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientAdded?: () => void;
}

export const AddClientModal = ({ open, onOpenChange, onClientAdded }: AddClientModalProps) => {
  const { t } = useAppTranslation();
  const [formData, setFormData] = useState({
    company_name: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    industry: '',
    notes: '',
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const { addClient } = useClients();

  const industries = [
    'Technology',
    'Healthcare',
    'Finance',
    'Education',
    'Manufacturing',
    'Retail',
    'Construction',
    'Consulting',
    'Media',
    'Government',
    'Non-profit',
    'Other'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await addClient(formData);
    
    if (result) {
      setFormData({
        company_name: '',
        contact_person: '',
        contact_email: '',
        contact_phone: '',
        address: '',
        industry: '',
        notes: '',
        is_active: true,
      });
      onClientAdded?.();
      onOpenChange(false);
    }
    
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            {t('client.addNewClient', 'Add New Client')}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            {t('client.completeClientInfo', 'Complete main client information to add a new company to your organization.')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="company_name">{t('client.companyName', 'Company Name')} *</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                placeholder={t('client.companyNamePlaceholder', 'e.g., ABC Corporation')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_person">{t('client.contactPerson', 'Contact Person')}</Label>
              <Input
                id="contact_person"
                value={formData.contact_person}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                placeholder={t('client.contactPersonPlaceholder', 'John Doe')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">{t('client.industry', 'Industry')}</Label>
              <Select
                value={formData.industry}
                onValueChange={(value) => setFormData(prev => ({ ...prev, industry: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('client.selectIndustry', 'Select industry')} />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_email">{t('client.email', 'Email')}</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                placeholder={t('client.emailPlaceholder', 'contact@company.com')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_phone">{t('client.phone', 'Phone')}</Label>
              <Input
                id="contact_phone"
                value={formData.contact_phone}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                placeholder="+62 123 456 789"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">{t('client.address', 'Address')}</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder={t('client.addressPlaceholder', 'Full company address...')}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t('client.notes', 'Notes')}</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder={t('client.notesPlaceholder', 'Additional notes about this client...')}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('client.adding', 'Adding...')}
                </>
              ) : (
                t('client.addClient', 'Add Client')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
