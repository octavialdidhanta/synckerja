import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { 
  BookOpen, 
  Calculator, 
  DollarSign, 
  Package, 
  Target, 
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Lightbulb
} from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

export const PriceCalculatorTutorial = () => {
  const { t } = useAppTranslation();
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5 text-brand-blue" />
          {t('pricingTools.tutorial.title', 'Tutorial Penggunaan Price Calculator')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96 pr-4">
          <div className="space-y-4">
            <div className="bg-brand-blue-soft p-3 rounded-lg border border-brand-blue/25">
              <p className="text-sm text-brand-blue-deep">
                <strong>{t("pricingTools.tutorial.objectiveLabel", "Tujuan:")}</strong>{" "}
                {t(
                  "pricingTools.tutorial.objectiveDescription",
                  "Membantu Anda menghitung harga jual yang optimal berdasarkan biaya produksi dan margin keuntungan yang diinginkan.",
                )}
              </p>
            </div>

            {/* Step 1 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4 text-primary" />
                  {t('pricingTools.tutorial.step1.title', 'Langkah 1: Informasi Produk')}
                  <Badge variant="outline" className="text-xs">{t('pricingTools.tutorial.step1.required', 'Wajib')}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-2">
                  <p><strong>{t('pricingTools.tutorial.step1.description', 'Isi data produk:')}</strong></p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                    <li>{t('pricingTools.tutorial.step1.productName', 'Nama produk (contoh: "Kopi Arabica Premium")')}</li>
                    <li>{t('pricingTools.tutorial.step1.category', 'Kategori (Food & Beverage, Manufacturing, atau Service)')}</li>
                  </ul>
                </div>
                
                <div className="bg-brand-blue-soft p-3 rounded-lg border border-brand-blue/25">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 text-brand-blue mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-brand-blue-deep">
                        {t("pricingTools.tutorial.step1.tipHeading", "Tips:")}
                      </p>
                      <p className="text-brand-blue-on-soft">
                        {t(
                          "pricingTools.tutorial.step1.tipDescription",
                          "Kategori mempengaruhi perhitungan margin yang disarankan untuk industri tersebut.",
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 2 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="h-4 w-4 text-primary" />
                  {t('pricingTools.tutorial.step2.title', 'Langkah 2: Rincian Biaya Produksi')}
                  <Badge variant="outline" className="text-xs">{t('pricingTools.tutorial.step1.required', 'Wajib')}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-2">
                  <p><strong>{t('pricingTools.tutorial.step2.description', 'Masukkan semua komponen biaya:')}</strong></p>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <div className="border rounded-lg p-3 bg-muted/50">
                      <p className="font-medium text-foreground mb-1">
                        {t("pricingTools.tutorial.step2.rawMaterialsLabel", "Bahan Baku")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "pricingTools.tutorial.step2.rawMaterialsExample",
                          "Contoh: Kopi Arabica = Rp 75,000",
                        )}
                      </p>
                    </div>

                    <div className="border rounded-lg p-3 bg-muted/50">
                      <p className="font-medium text-foreground mb-1">
                        {t("pricingTools.tutorial.step2.laborCostLabel", "Biaya Tenaga Kerja")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "pricingTools.tutorial.step2.laborCostExample",
                          "Contoh: Barista 2 jam = Rp 15,000",
                        )}
                      </p>
                    </div>

                    <div className="border rounded-lg p-3 bg-muted/50">
                      <p className="font-medium text-foreground mb-1">
                        {t("pricingTools.tutorial.step2.overheadLabel", "Overhead")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "pricingTools.tutorial.step2.overheadExample",
                          "Contoh: Listrik, sewa = Rp 5,000",
                        )}
                      </p>
                    </div>

                    <div className="border rounded-lg p-3 bg-muted/50">
                      <p className="font-medium text-foreground mb-1">
                        {t("pricingTools.tutorial.step2.marketingCostLabel", "Marketing")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "pricingTools.tutorial.step2.marketingCostExample",
                          "Contoh: Promosi = Rp 2,000",
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="bg-brand-blue-soft p-3 rounded-lg border border-brand-blue/25">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-brand-blue-deep">Total Biaya Produksi:</span>
                    <span className="text-sm font-bold text-brand-blue-deep">Rp 100,000</span>
                  </div>
                  <p className="text-xs text-brand-blue-on-soft mt-1">
                    {t('pricingTools.tutorial.step2.totalNote', 'Sistem akan otomatis menghitung total dari semua komponen biaya')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Step 3 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calculator className="h-4 w-4 text-primary" />
                  {t('pricingTools.tutorial.step3.title', 'Langkah 3: Metode Perhitungan')}
                  <Badge variant="outline" className="text-xs">{t('pricingTools.tutorial.step3.optional', 'Pilih Salah Satu')}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-3">
                  <div className="border rounded-lg p-3">
                    <p className="font-medium text-foreground mb-2">{t('pricingTools.tutorial.step3.method1.title', '1. Markup Percentage')}</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      {t('pricingTools.tutorial.step3.method1.description', 'Menambahkan persentase keuntungan dari biaya produksi')}
                    </p>
                    <div className="bg-brand-blue-soft p-2 rounded text-xs">
                      <p><strong>{t('pricingTools.tutorial.step3.method1.example', 'Contoh: Markup 50%')}</strong></p>
                      <p>{t('pricingTools.tutorial.step3.method1.formula', 'Harga Jual = Rp 100,000 + (50% × Rp 100,000) = Rp 150,000')}</p>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-3">
                    <p className="font-medium text-foreground mb-2">{t('pricingTools.tutorial.step3.method2.title', '2. Profit Margin')}</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      {t('pricingTools.tutorial.step3.method2.description', 'Menentukan persentase keuntungan dari harga jual')}
                    </p>
                    <div className="bg-brand-blue-soft p-2 rounded text-xs">
                      <p><strong>{t('pricingTools.tutorial.step3.method2.example', 'Contoh: Margin 33%')}</strong></p>
                      <p>{t('pricingTools.tutorial.step3.method2.formula', 'Harga Jual = Rp 100,000 ÷ (100% - 33%) = Rp 149,254')}</p>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-3">
                    <p className="font-medium text-foreground mb-2">{t('pricingTools.tutorial.step3.method3.title', '3. Fixed Profit Amount')}</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      {t('pricingTools.tutorial.step3.method3.description', 'Menambahkan nilai keuntungan tetap')}
                    </p>
                    <div className="bg-brand-blue-soft p-2 rounded text-xs">
                      <p><strong>{t('pricingTools.tutorial.step3.method3.example', 'Contoh: Profit Rp 50,000')}</strong></p>
                      <p>{t('pricingTools.tutorial.step3.method3.formula', 'Harga Jual = Rp 100,000 + Rp 50,000 = Rp 150,000')}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 4 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-brand-red" />
                  {t('pricingTools.tutorial.step4.title', 'Langkah 4: Channel Penjualan')}
                  <Badge variant="outline" className="text-xs">{t('pricingTools.tutorial.step4.optional', 'Opsional')}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-2">
                  <p><strong>{t('pricingTools.tutorial.step4.description', 'Pilih saluran penjualan untuk penyesuaian harga:')}</strong></p>
                  
                  <div className="grid grid-cols-1 gap-2">
                    <div className="border rounded-lg p-3 bg-brand-red/5">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-sm">
                          {t("pricingTools.tutorial.step4.onlineTitle", "Online Marketplace")}
                        </span>
                        <Badge className="text-xs bg-brand-red/15 text-brand-red">
                          {t("pricingTools.tutorial.step4.onlineFee", "Fee 15%")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "pricingTools.tutorial.step4.onlineDescription",
                          "Termasuk komisi platform, fee pembayaran, dan biaya iklan",
                        )}
                      </p>
                    </div>

                    <div className="border rounded-lg p-3 bg-brand-blue-soft">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-sm">
                          {t("pricingTools.tutorial.step4.offlineTitle", "Toko Offline")}
                        </span>
                        <Badge className="bg-primary/15 text-xs text-primary">
                          {t("pricingTools.tutorial.step4.offlineFee", "Fee 5%")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "pricingTools.tutorial.step4.offlineDescription",
                          "Termasuk sewa toko dan biaya staff",
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 5 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-brand-blue" />
                  {t('pricingTools.tutorial.step5.title', 'Langkah 5: Analisis Hasil')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-3">
                  <p><strong>{t('pricingTools.tutorial.step5.description', 'Setelah klik "Calculate Pricing", Anda akan mendapat:')}</strong></p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <span className="text-sm">{t('pricingTools.tutorial.step5.result1', 'Harga jual yang disarankan')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <span className="text-sm">{t('pricingTools.tutorial.step5.result2', 'Jumlah keuntungan dalam rupiah')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <span className="text-sm">{t('pricingTools.tutorial.step5.result3', 'Persentase margin keuntungan')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <span className="text-sm">{t('pricingTools.tutorial.step5.result4', 'Harga per channel penjualan')}</span>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="rounded-lg border border-brand-red/25 bg-brand-red/5 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 text-brand-red" />
                    <div className="text-sm">
                      <p className="font-medium text-brand-red">{t('pricingTools.tutorial.step5.note', 'Catatan Penting:')}</p>
                      <ul className="mt-1 list-inside list-disc space-y-1 text-brand-red/90">
                        <li>{t('pricingTools.tutorial.step5.note1', 'Selalu riset harga kompetitor sebelum menentukan harga final')}</li>
                        <li>{t('pricingTools.tutorial.step5.note2', 'Pertimbangkan daya beli target market')}</li>
                        <li>{t('pricingTools.tutorial.step5.note3', 'Lakukan test pricing untuk produk baru')}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('pricingTools.tutorial.quickActions.title', 'Fitur Tambahan')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-2">
                  <p><strong>{t('pricingTools.tutorial.quickActions.description', 'Setelah perhitungan selesai, Anda dapat:')}</strong></p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                    <li>{t('pricingTools.tutorial.quickActions.save', 'Menyimpan hasil perhitungan untuk referensi')}</li>
                    <li>{t('pricingTools.tutorial.quickActions.export', 'Export ke Excel untuk analisis lebih lanjut')}</li>
                    <li>{t('pricingTools.tutorial.quickActions.share', 'Share hasil dengan tim atau stakeholder')}</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
