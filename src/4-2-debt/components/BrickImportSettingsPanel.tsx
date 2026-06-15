import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useExpenseTypes } from '@/shared/hooks/finance/useExpenseTypes';
import { useExpenseCategories } from '@/shared/hooks/finance/useExpenseCategories';
import { useBrickImportSettings } from '../hooks/useBrickImportSettings';
import { useToast } from '@/shared/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

export function BrickImportSettingsPanel() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { settings, isConfigured, saveSettings, saving, loading } = useBrickImportSettings();
  const { expenseTypes, isLoading: typesLoading } = useExpenseTypes();
  const [typeId, setTypeId] = useState('');
  const { expenseCategories, isLoading: categoriesLoading } = useExpenseCategories(typeId || undefined);

  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    if (settings?.default_expense_type_id) setTypeId(settings.default_expense_type_id);
    if (settings?.default_expense_category_id) setCategoryId(settings.default_expense_category_id);
  }, [settings]);

  const handleSave = async () => {
    if (!typeId || !categoryId) {
      toast({
        title: t('debt.brick.importSettingsRequired', 'Pengaturan impor wajib'),
        description: t(
          'debt.brick.importSettingsRequiredDesc',
          'Pilih tipe dan kategori expense default sebelum sinkron kartu kredit.',
        ),
        variant: 'destructive',
      });
      return;
    }
    try {
      await saveSettings({
        default_expense_type_id: typeId,
        default_expense_category_id: categoryId,
      });
      toast({
        title: t('debt.brick.importSettingsSaved', 'Pengaturan impor Brick disimpan'),
      });
    } catch (e) {
      toast({
        title: t('debt.brick.importSettingsError', 'Gagal menyimpan pengaturan'),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    }
  };

  if (loading) return null;

  return (
    <Card className="flex-shrink-0 border-dashed">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-semibold">
          {t('debt.brick.importSettingsTitle', 'Impor otomatis Brick (Kartu Kredit)')}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t(
            'debt.brick.importSettingsHint',
            'Transaksi belanja dari Brick akan dibuat sebagai expense dengan sumber hutang kartu kredit.',
          )}
        </p>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 flex flex-wrap items-end gap-3">
        <div className="space-y-1 min-w-[160px]">
          <Label className="text-xs">{t('debt.brick.defaultExpenseType', 'Tipe expense')}</Label>
          <Select value={typeId} onValueChange={(v) => { setTypeId(v); setCategoryId(''); }}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={t('debt.brick.selectType', 'Pilih tipe')} />
            </SelectTrigger>
            <SelectContent>
              {expenseTypes.map((et) => (
                <SelectItem key={et.id} value={et.id}>
                  {et.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 min-w-[160px]">
          <Label className="text-xs">{t('debt.brick.defaultExpenseCategory', 'Kategori expense')}</Label>
          <Select value={categoryId} onValueChange={setCategoryId} disabled={!typeId || categoriesLoading}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={t('debt.brick.selectCategory', 'Pilih kategori')} />
            </SelectTrigger>
            <SelectContent>
              {expenseCategories.map((ec) => (
                <SelectItem key={ec.id} value={ec.id}>
                  {ec.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant={isConfigured ? 'outline' : 'default'} onClick={handleSave} disabled={saving || typesLoading}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          {t('debt.brick.saveImportSettings', 'Simpan')}
        </Button>
        {!isConfigured ? (
          <span className="text-xs text-amber-700">
            {t('debt.brick.importNotConfigured', 'Wajib sebelum impor transaksi kartu kredit.')}
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
