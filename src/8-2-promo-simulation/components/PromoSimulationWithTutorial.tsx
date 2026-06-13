import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Badge } from "@/shared/components/ui/badge";
import { Separator } from "@/shared/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import {
  Percent,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  BookOpen,
  Calculator,
  Target,
  TrendingUp,
  History,
  Download,
  Calendar,
} from "lucide-react";
import { usePricingCalculations, type SavedCalculation } from "@/8-2-pricing-tools/hooks/usePricingCalculations";
import { formatRupiah } from "@/8-2-pricing-tools/lib/pricingUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export function PromoSimulationWithTutorial() {
  const { t, dateFnsLocale } = useAppTranslation();
  const [simulationResults, setSimulationResults] = useState<{
    originalPrice: number;
    discountedPrice: number;
    originalProfit: number;
    newProfit: number;
    profitReduction: number;
    breakEvenUnits: number;
    recommendedDiscount: number;
    channelResults: Record<
      string,
      { name: string; feePercent: number; netProfit: number }
    >;
  } | null>(null);
  const [basePrice, setBasePrice] = useState<string>("");
  const [productionCost, setProductionCost] = useState<string>("");
  const [discountType, setDiscountType] = useState<string>("percentage");
  const [discountValue, setDiscountValue] = useState<string>("");
  const [promoDuration, setPromoDuration] = useState<string>("");
  const [currentVolume, setCurrentVolume] = useState<string>("");
  const [expectedIncrease, setExpectedIncrease] = useState<string>("");

  const { calculations = [], isLoading: isLoadingHistory = false } = usePricingCalculations();
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedCalculation, setSelectedCalculation] = useState<SavedCalculation | null>(null);

  const handleLoadFromHistory = (calculation: SavedCalculation) => {
    const result = calculation.calculation_result;

    setBasePrice(result.summary.recommendedSellingPrice.toString());
    setProductionCost((calculation.calculation_input.productionCostPerUnit || 0).toString());
    setSelectedCalculation(calculation);
    setHistoryDialogOpen(false);
  };

  const runSimulation = () => {
    const basePriceNum = parseFloat(basePrice) || 0;
    const productionCostNum = parseFloat(productionCost) || 0;
    const discountValueNum = parseFloat(discountValue) || 0;
    const currentVolumeNum = parseFloat(currentVolume) || 0;

    if (!basePriceNum || !productionCostNum) {
      toast.error(
        t(
          "promoSimulation.validation.missingBaseFields",
          "Isi Harga Jual Dasar dan Biaya Produksi",
        ),
      );
      return;
    }

    let discountedPrice = basePriceNum;
    if (discountType === "percentage") {
      discountedPrice = basePriceNum * (1 - discountValueNum / 100);
    } else if (discountType === "fixed") {
      discountedPrice = basePriceNum - discountValueNum;
    } else if (discountType === "bogo") {
      discountedPrice = basePriceNum * 0.5;
    }

    const originalProfit = basePriceNum - productionCostNum;
    const newProfit = discountedPrice - productionCostNum;
    const profitReduction =
      originalProfit > 0 ? ((originalProfit - newProfit) / originalProfit) * 100 : 0;

    const originalUnits = currentVolumeNum || 1;
    const breakEvenUnits =
      newProfit > 0 ? Math.ceil((originalProfit * originalUnits) / newProfit) : Infinity;

    const recommendedDiscount = Math.min(15, profitReduction * 0.8);

    const channelResults: Record<
      string,
      { name: string; feePercent: number; netProfit: number }
    > = {};
    if (selectedCalculation) {
      const input = selectedCalculation.calculation_input;
      const result = selectedCalculation.calculation_result;
      if (result.channelPricing && Array.isArray(result.channelPricing)) {
        result.channelPricing.forEach((channel) => {
          const channelInput = input.salesChannels?.find((ch) => ch.id === channel.channelId);
          const feePercent = channelInput?.totalFeePercent || 0;
          const channelFee = discountedPrice * (feePercent / 100);
          channelResults[channel.channelId] = {
            name: channel.channelName,
            feePercent,
            netProfit: discountedPrice - productionCostNum - channelFee,
          };
        });
      }
    }

    setSimulationResults({
      originalPrice: basePriceNum,
      discountedPrice,
      originalProfit,
      newProfit,
      profitReduction,
      breakEvenUnits,
      recommendedDiscount,
      channelResults,
    });
  };

  const renderTutorial = () => (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-brand-blue-deep">
          <BookOpen className="h-5 w-5 text-brand-blue" />
          {t("promoSimulation.tutorial.title", "Tutorial Simulasi Promosi")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px] px-6">
          <div className="space-y-6 pb-6">
            <div className="rounded-lg border border-brand-blue/25 bg-brand-blue-soft p-3">
              <p className="text-sm text-brand-blue-on-soft">
                <strong className="text-brand-blue-deep">
                  {t("promoSimulation.tutorial.objectiveLabel", "Tujuan:")}
                </strong>{" "}
                {t(
                  "promoSimulation.tutorial.objectiveDescription",
                  "Membantu Anda mensimulasikan dampak promosi terhadap keuntungan dan menentukan strategi diskon yang optimal.",
                )}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue text-xs font-bold text-brand-white">
                  1
                </div>
                <h3 className="text-base font-semibold text-brand-blue-deep">
                  {t("promoSimulation.tutorial.step1.title", "Atur Detail Promosi")}
                </h3>
              </div>
              <div className="ml-8 space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t(
                    "promoSimulation.tutorial.step1.intro",
                    "Mulai dengan memasukkan informasi dasar produk Anda:",
                  )}
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  <li>
                    <strong>
                      {t(
                        "promoSimulation.tutorial.step1.basePrice",
                        "Harga Jual Dasar: Harga produk regular Anda (contoh: Rp 150,000)",
                      )}
                    </strong>
                  </li>
                  <li>
                    <strong>
                      {t(
                        "promoSimulation.tutorial.step1.productionCost",
                        "Biaya Produksi: Biaya untuk membuat produk (contoh: Rp 100,000)",
                      )}
                    </strong>
                  </li>
                </ul>
                <div className="rounded-lg border border-brand-blue/25 bg-brand-blue-soft p-3">
                  <p className="text-xs text-brand-blue-on-soft">
                    <strong className="text-brand-blue-deep">
                      {t("promoSimulation.tutorial.step1.tipHeading", "Tips:")}
                    </strong>{" "}
                    {t(
                      "promoSimulation.tutorial.step1.tipDescription",
                      "Pastikan biaya produksi mencakup semua bahan, tenaga kerja, dan overhead untuk perhitungan yang akurat.",
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue text-xs font-bold text-brand-white">
                  2
                </div>
                <h3 className="text-base font-semibold text-brand-blue-deep">
                  {t("promoSimulation.tutorial.step2.title", "Pilih Jenis Diskon")}
                </h3>
              </div>
              <div className="ml-8 space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t(
                    "promoSimulation.tutorial.step2.intro",
                    "Pilih jenis promosi yang ingin Anda jalankan:",
                  )}
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Calculator className="mt-0.5 h-4 w-4 text-brand-blue" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {t("promoSimulation.tutorial.step2.percentageTitle", "Diskon Persentase")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "promoSimulation.tutorial.step2.percentageDescription",
                          "Kurangi harga dengan persentase (contoh: diskon 20%)",
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calculator className="mt-0.5 h-4 w-4 text-success" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {t("promoSimulation.tutorial.step2.fixedTitle", "Potongan Nominal")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "promoSimulation.tutorial.step2.fixedDescription",
                          "Kurangi harga dengan jumlah tetap (contoh: potongan Rp 30,000)",
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calculator className="mt-0.5 h-4 w-4 text-brand-red" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {t(
                          "promoSimulation.tutorial.step2.bogoTitle",
                          "Beli Satu Dapat Satu (BOGO)",
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "promoSimulation.tutorial.step2.bogoDescription",
                          "Promosi khusus dengan menawarkan item tambahan",
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue text-xs font-bold text-brand-white">
                  3
                </div>
                <h3 className="text-base font-semibold text-brand-blue-deep">
                  {t("promoSimulation.tutorial.step3.title", "Konfigurasi Saluran Penjualan")}
                </h3>
              </div>
              <div className="ml-8 space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t(
                    "promoSimulation.tutorial.step3.intro",
                    "Tinjau bagaimana saluran penjualan yang berbeda mempengaruhi margin keuntungan:",
                  )}
                </p>
                <div className="grid grid-cols-1 gap-3">
                  <div className="rounded-lg border border-brand-blue/15 bg-card p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-brand-blue-deep">
                        {t("promoSimulation.tutorial.step3.onlineMarketplace", "Marketplace Online")}
                      </span>
                      <Badge
                        variant="outline"
                        className="border-brand-red/35 bg-brand-red/10 text-xs text-brand-red"
                      >
                        {t("promoSimulation.tutorial.step3.highFee", "Fee Tinggi")}
                      </Badge>
                    </div>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li>{t("promoSimulation.tutorial.step3.onlineCommission", "• Komisi: 10% dari harga jual")}</li>
                      <li>{t("promoSimulation.tutorial.step3.onlinePaymentFee", "• Fee pembayaran: 3% dari harga jual")}</li>
                      <li>{t("promoSimulation.tutorial.step3.onlineAdSpend", "• Biaya iklan: 2% dari harga jual")}</li>
                      <li>
                        •{" "}
                        <strong className="text-foreground">
                          {t("promoSimulation.tutorial.step3.onlineTotalFee", "Total fee: 15%")}
                        </strong>
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-lg border border-brand-blue/15 bg-brand-blue-soft/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-brand-blue-deep">
                        {t("promoSimulation.tutorial.step3.offlineStore", "Toko Offline")}
                      </span>
                      <Badge
                        variant="outline"
                        className="border-brand-blue/35 bg-brand-blue-soft text-xs text-brand-blue-deep"
                      >
                        {t("promoSimulation.tutorial.step3.lowFee", "Fee Rendah")}
                      </Badge>
                    </div>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li>{t("promoSimulation.tutorial.step3.offlineRent", "• Sewa toko: 3% dari harga jual")}</li>
                      <li>{t("promoSimulation.tutorial.step3.offlineStaff", "• Biaya staff: 2% dari harga jual")}</li>
                      <li>
                        •{" "}
                        <strong className="text-foreground">
                          {t("promoSimulation.tutorial.step3.offlineTotalFee", "Total fee: 5%")}
                        </strong>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue text-xs font-bold text-brand-white">
                  4
                </div>
                <h3 className="text-base font-semibold text-brand-blue-deep">
                  {t("promoSimulation.tutorial.step4.title", "Proyeksi Volume Penjualan")}
                </h3>
              </div>
              <div className="ml-8 space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t(
                    "promoSimulation.tutorial.step4.intro",
                    "Perkirakan bagaimana promosi akan mempengaruhi penjualan Anda:",
                  )}
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  <li>
                    <strong>
                      {t(
                        "promoSimulation.tutorial.step4.currentSales",
                        "Penjualan Harian Saat Ini: Rata-rata penjualan per hari tanpa promosi",
                      )}
                    </strong>
                  </li>
                  <li>
                    <strong>
                      {t(
                        "promoSimulation.tutorial.step4.expectedIncrease",
                        "Peningkatan yang Diharapkan: Persentase peningkatan volume penjualan karena promosi",
                      )}
                    </strong>
                  </li>
                </ul>
                <div className="rounded-lg border border-warning/30 bg-warning-muted p-3">
                  <p className="text-xs text-warning-foreground">
                    <strong>{t("promoSimulation.tutorial.step4.important", "Penting:")}</strong>{" "}
                    {t(
                      "promoSimulation.tutorial.step4.importantDescription",
                      "Diskon yang lebih tinggi biasanya menghasilkan peningkatan volume yang lebih tinggi, tetapi realistis dengan proyeksi Anda.",
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue text-xs font-bold text-brand-white">
                  5
                </div>
                <h3 className="text-base font-semibold text-brand-blue-deep">
                  {t("promoSimulation.tutorial.step5.title", "Jalankan Simulasi & Analisis Hasil")}
                </h3>
              </div>
              <div className="ml-8 space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t(
                    "promoSimulation.tutorial.step5.intro",
                    'Klik "Jalankan Simulasi" untuk melihat analisis detail:',
                  )}
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Target className="mt-0.5 h-4 w-4 text-success" />
                    <div>
                      <p className="text-sm font-medium">
                        {t("promoSimulation.tutorial.step5.profitAnalysisTitle", "Analisis Keuntungan")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "promoSimulation.tutorial.step5.profitAnalysisDescription",
                          "Bandingkan keuntungan original vs. diskon per unit",
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <TrendingUp className="mt-0.5 h-4 w-4 text-brand-blue" />
                    <div>
                      <p className="text-sm font-medium">
                        {t("promoSimulation.tutorial.step5.breakEvenTitle", "Analisis Break-even")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "promoSimulation.tutorial.step5.breakEvenDescription",
                          "Berapa unit yang perlu dijual untuk mempertahankan total keuntungan",
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-4 w-4 text-brand-blue-deep" />
                    <div>
                      <p className="text-sm font-medium">
                        {t(
                          "promoSimulation.tutorial.step5.channelComparisonTitle",
                          "Perbandingan Channel",
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "promoSimulation.tutorial.step5.channelComparisonDescription",
                          "Lihat saluran penjualan mana yang lebih menguntungkan",
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-xs font-bold text-brand-white">
                  ✓
                </div>
                <h3 className="text-base font-semibold text-brand-blue-deep">
                  {t("promoSimulation.tutorial.bestPractices.title", "Praktik Terbaik")}
                </h3>
              </div>
              <div className="ml-8 space-y-2">
                <div className="space-y-3">
                  <div className="rounded-lg border border-success/30 bg-success-muted p-3">
                    <h4 className="mb-1 text-sm font-medium text-success-foreground">
                      {t("promoSimulation.tutorial.bestPractices.dosTitle", "Yang Harus Dilakukan")}
                    </h4>
                    <ul className="space-y-1 text-xs text-success-foreground/95">
                      <li>{t("promoSimulation.tutorial.bestPractices.dos1", "• Uji promosi kecil terlebih dahulu sebelum kampanye besar")}</li>
                      <li>{t("promoSimulation.tutorial.bestPractices.dos2", "• Pertimbangkan tren musiman dalam proyeksi volume")}</li>
                      <li>{t("promoSimulation.tutorial.bestPractices.dos3", "• Pantau hasil aktual vs. proyeksi")}</li>
                      <li>{t("promoSimulation.tutorial.bestPractices.dos4", "• Faktorkan biaya inventori dan penyimpanan")}</li>
                    </ul>
                  </div>
                  <div className="rounded-lg border border-brand-red/25 bg-brand-red/5 p-3">
                    <h4 className="mb-1 text-sm font-medium text-brand-red">
                      {t("promoSimulation.tutorial.bestPractices.dontsTitle", "Yang Tidak Boleh Dilakukan")}
                    </h4>
                    <ul className="space-y-1 text-xs text-brand-red/95">
                      <li>{t("promoSimulation.tutorial.bestPractices.donts1", "• Jangan diskon di bawah titik break-even")}</li>
                      <li>{t("promoSimulation.tutorial.bestPractices.donts2", "• Hindari proyeksi volume yang terlalu optimis")}</li>
                      <li>{t("promoSimulation.tutorial.bestPractices.donts3", "• Jangan abaikan biaya tersembunyi (ongkir, packaging, dll.)")}</li>
                      <li>{t("promoSimulation.tutorial.bestPractices.donts4", "• Jangan terlalu sering promosi (menurunkan nilai brand)")}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue-deep text-xs font-bold text-brand-white">
                  💡
                </div>
                <h3 className="text-base font-semibold text-brand-blue-deep">
                  {t("promoSimulation.tutorial.example.title", "Contoh Skenario")}
                </h3>
              </div>
              <div className="ml-8">
                <div className="rounded-lg border border-brand-blue/25 bg-brand-blue-soft p-4">
                  <h4 className="mb-2 text-sm font-medium text-brand-blue-deep">
                    {t("promoSimulation.tutorial.example.heading", "Toko Fashion: Promosi Diskon 20%")}
                  </h4>
                  <div className="space-y-1 text-xs text-brand-blue-on-soft">
                    <p>
                      {t(
                        "promoSimulation.tutorial.example.product",
                        "Produk: Kaos, harga jual Rp 150,000, biaya produksi Rp 100,000",
                      )}
                    </p>
                    <p>
                      {t(
                        "promoSimulation.tutorial.example.promo",
                        "Promosi: Diskon 20% (harga menjadi Rp 120,000)",
                      )}
                    </p>
                    <p>
                      {t(
                        "promoSimulation.tutorial.example.sales",
                        "Penjualan saat ini: 10 unit/hari, ekspektasi peningkatan 50% (15 unit/hari)",
                      )}
                    </p>
                    <p>
                      {t(
                        "promoSimulation.tutorial.example.channel",
                        "Channel: Marketplace online (fee 15%)",
                      )}
                    </p>
                  </div>
                  <Separator className="my-2" />
                  <div className="space-y-1 text-xs text-brand-blue-on-soft">
                    <p>
                      <strong className="text-brand-blue-deep">
                        {t("promoSimulation.tutorial.example.resultLabel", "Hasil:")}
                      </strong>{" "}
                      {t(
                        "promoSimulation.tutorial.example.resultText",
                        "Keuntungan original Rp 50k/unit → Keuntungan baru Rp 20k/unit",
                      )}
                    </p>
                    <p>
                      <strong className="text-brand-blue-deep">
                        {t("promoSimulation.tutorial.example.breakEvenLabel", "Break-even:")}
                      </strong>{" "}
                      {t(
                        "promoSimulation.tutorial.example.breakEvenText",
                        "Butuh 25 unit untuk mempertahankan total keuntungan harian",
                      )}
                    </p>
                    <p>
                      <strong className="text-brand-blue-deep">
                        {t("promoSimulation.tutorial.example.recommendationLabel", "Rekomendasi:")}
                      </strong>{" "}
                      {t(
                        "promoSimulation.tutorial.example.recommendationText",
                        "Pertimbangkan diskon 15% untuk margin yang lebih baik",
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
      <div className="space-y-2 lg:col-span-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base text-brand-blue-deep">
                <Percent className="h-5 w-5 text-brand-red" />
                {t("promoSimulation.setup.title", "Pengaturan Promosi")}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoryDialogOpen(true)}
                className="flex items-center gap-2"
              >
                <History className="h-4 w-4" />
                {t("promoSimulation.setup.loadFromHistory", "Muat dari Riwayat")}
              </Button>
            </div>
            {selectedCalculation ? (
              <div className="mt-2">
                <Badge variant="secondary" className="text-xs">
                  {t("promoSimulation.setup.loadedBadge", "Dimuat: {{name}}", {
                    name: selectedCalculation.calculation_name,
                  })}
                </Badge>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="base-price" className="text-sm font-medium">
                  {t("promoSimulation.fields.baseSellingPrice", "Harga Jual Dasar")}
                </Label>
                <Input
                  id="base-price"
                  type="number"
                  placeholder="150000"
                  className="mt-1"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="production-cost" className="text-sm font-medium">
                  {t("promoSimulation.fields.productionCost", "Biaya Produksi")}
                </Label>
                <Input
                  id="production-cost"
                  type="number"
                  placeholder="100000"
                  className="mt-1"
                  value={productionCost}
                  onChange={(e) => setProductionCost(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="discount-type" className="text-sm font-medium">
                  {t("promoSimulation.fields.discountType", "Jenis Diskon")}
                </Label>
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue
                      placeholder={t(
                        "promoSimulation.fields.discountTypePlaceholder",
                        "Pilih jenis",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">
                      {t("promoSimulation.discountType.percentage", "Persentase")}
                    </SelectItem>
                    <SelectItem value="fixed">
                      {t("promoSimulation.discountType.fixed", "Potongan Nominal")}
                    </SelectItem>
                    <SelectItem value="bogo">
                      {t("promoSimulation.discountType.bogo", "Beli Satu Dapat Satu")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="discount-value" className="text-sm font-medium">
                  {t("promoSimulation.fields.discountValue", "Nilai Diskon")}
                </Label>
                <Input
                  id="discount-value"
                  type="number"
                  placeholder="20"
                  className="mt-1"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="promo-duration" className="text-sm font-medium">
                  {t("promoSimulation.fields.durationDays", "Durasi (hari)")}
                </Label>
                <Input
                  id="promo-duration"
                  type="number"
                  placeholder="7"
                  className="mt-1"
                  value={promoDuration}
                  onChange={(e) => setPromoDuration(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-brand-blue-deep">
              {t("promoSimulation.channelImpact.title", "Dampak Saluran Penjualan")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectedCalculation &&
            selectedCalculation.calculation_result?.channelPricing &&
            selectedCalculation.calculation_result.channelPricing.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {selectedCalculation.calculation_result.channelPricing.map((channel) => {
                  const channelInput = selectedCalculation.calculation_input.salesChannels?.find(
                    (ch) => ch.id === channel.channelId,
                  );
                  const basePriceNum = parseFloat(basePrice) || 0;
                  const feePercent = channelInput?.totalFeePercent || 0;
                  const commissionPercent = channelInput?.commissionPercent || 0;
                  const paymentFeePercent = channelInput?.paymentFeePercent || 0;
                  const adSpendPercent = channelInput?.adSpendPercent || 0;
                  const otherFeePercent = channelInput?.otherFeePercent || 0;

                  return (
                    <div
                      key={channel.channelId}
                      className="rounded-lg border border-brand-blue/15 bg-brand-blue-soft/30 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="font-medium text-brand-blue-deep">{channel.channelName}</span>
                        <Badge variant="outline" className="border-brand-blue/35 text-brand-blue-deep">
                          {t("promoSimulation.channelImpact.feesBadge", "Fee {{percent}}%", {
                            percent: feePercent.toFixed(1),
                          })}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {commissionPercent > 0 ? (
                          <div className="flex justify-between text-sm">
                            <span>
                              {t("promoSimulation.channelImpact.commission", "Komisi ({{percent}}%):", {
                                percent: commissionPercent,
                              })}
                            </span>
                            <span className="text-brand-red">
                              -{formatRupiah(basePriceNum * (commissionPercent / 100))}
                            </span>
                          </div>
                        ) : null}
                        {paymentFeePercent > 0 ? (
                          <div className="flex justify-between text-sm">
                            <span>
                              {t("promoSimulation.channelImpact.paymentFee", "Fee pembayaran ({{percent}}%):", {
                                percent: paymentFeePercent,
                              })}
                            </span>
                            <span className="text-brand-red">
                              -{formatRupiah(basePriceNum * (paymentFeePercent / 100))}
                            </span>
                          </div>
                        ) : null}
                        {adSpendPercent > 0 ? (
                          <div className="flex justify-between text-sm">
                            <span>
                              {t("promoSimulation.channelImpact.adSpend", "Biaya iklan ({{percent}}%):", {
                                percent: adSpendPercent,
                              })}
                            </span>
                            <span className="text-brand-red">
                              -{formatRupiah(basePriceNum * (adSpendPercent / 100))}
                            </span>
                          </div>
                        ) : null}
                        {otherFeePercent > 0 ? (
                          <div className="flex justify-between text-sm">
                            <span>
                              {t("promoSimulation.channelImpact.otherFees", "Biaya lain ({{percent}}%):", {
                                percent: otherFeePercent,
                              })}
                            </span>
                            <span className="text-brand-red">
                              -{formatRupiah(basePriceNum * (otherFeePercent / 100))}
                            </span>
                          </div>
                        ) : null}
                        <Separator />
                        <div className="flex justify-between font-medium">
                          <span>
                            {t("promoSimulation.channelImpact.netAfterFees", "Net setelah fee:")}
                          </span>
                          <span>{formatRupiah(basePriceNum * (1 - feePercent / 100))}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-4 text-center text-sm text-muted-foreground">
                <p>
                  {t(
                    "promoSimulation.channelImpact.emptyHint",
                    "Muat perhitungan dari riwayat untuk melihat dampak per saluran",
                  )}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHistoryDialogOpen(true)}
                  className="mt-2"
                >
                  <History className="mr-2 h-4 w-4" />
                  {t("promoSimulation.setup.loadFromHistory", "Muat dari Riwayat")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-brand-blue-deep">
              {t("promoSimulation.volume.title", "Proyeksi Volume")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="current-volume" className="text-sm font-medium">
                  {t("promoSimulation.volume.currentDailySales", "Penjualan Harian Saat Ini")}
                </Label>
                <Input
                  id="current-volume"
                  type="number"
                  placeholder="10"
                  className="mt-1"
                  value={currentVolume}
                  onChange={(e) => setCurrentVolume(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="expected-increase" className="text-sm font-medium">
                  {t("promoSimulation.volume.expectedIncrease", "Peningkatan Diharapkan (%)")}
                </Label>
                <Input
                  id="expected-increase"
                  type="number"
                  placeholder="50"
                  className="mt-1"
                  value={expectedIncrease}
                  onChange={(e) => setExpectedIncrease(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button type="button" onClick={runSimulation} className="w-full">
                  {t("promoSimulation.actions.runSimulation", "Jalankan Simulasi")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <Tabs defaultValue="results" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="results">
              {t("promoSimulation.tabs.results", "Hasil Simulasi")}
            </TabsTrigger>
            <TabsTrigger value="tutorial">
              {t("promoSimulation.tabs.tutorial", "Tutorial")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="space-y-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-brand-blue-deep">
                  <TrendingDown className="h-5 w-5 text-brand-red" />
                  {t("promoSimulation.results.title", "Hasil Simulasi")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {simulationResults ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-brand-blue/25 bg-brand-blue-soft p-3 text-center">
                        <p className="text-xs font-medium text-brand-blue-on-soft">
                          {t("promoSimulation.results.originalPrice", "Harga Original")}
                        </p>
                        <p className="text-lg font-bold text-brand-blue-deep">
                          Rp {simulationResults.originalPrice.toLocaleString("id-ID")}
                        </p>
                      </div>
                      <div className="rounded-lg border border-brand-red/25 bg-brand-red/5 p-3 text-center">
                        <p className="text-xs font-medium text-brand-red">
                          {t("promoSimulation.results.promoPrice", "Harga Promo")}
                        </p>
                        <p className="text-lg font-bold text-brand-red">
                          Rp {simulationResults.discountedPrice.toLocaleString("id-ID")}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {t("promoSimulation.results.originalProfitPerUnit", "Keuntungan Original/Unit:")}
                        </span>
                        <span className="font-medium text-success">
                          Rp {simulationResults.originalProfit.toLocaleString("id-ID")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {t("promoSimulation.results.newProfitPerUnit", "Keuntungan Baru/Unit:")}
                        </span>
                        <span className="font-medium text-brand-red">
                          Rp {simulationResults.newProfit.toLocaleString("id-ID")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {t("promoSimulation.results.profitReduction", "Penurunan Keuntungan:")}
                        </span>
                        <Badge className="border-brand-red/30 bg-brand-red/15 text-brand-red hover:bg-brand-red/20">
                          -{simulationResults.profitReduction.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>

                    <Separator />

                    <div className="rounded-lg border border-warning/30 bg-warning-muted p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        <span className="text-sm font-medium text-warning-foreground">
                          {t("promoSimulation.results.breakEvenTitle", "Analisis Break-even")}
                        </span>
                      </div>
                      <p className="text-sm text-warning-foreground/95">
                        {t("promoSimulation.results.breakEvenText", "Perlu menjual {{units}} unit untuk mempertahankan total keuntungan", {
                          units:
                            simulationResults.breakEvenUnits === Infinity
                              ? "∞"
                              : simulationResults.breakEvenUnits,
                        })}
                      </p>
                    </div>

                    <div className="rounded-lg border border-success/30 bg-success-muted p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-success" />
                        <span className="text-sm font-medium text-success-foreground">
                          {t("promoSimulation.results.recommendationTitle", "Rekomendasi")}
                        </span>
                      </div>
                      <p className="text-sm text-success-foreground/95">
                        {t(
                          "promoSimulation.results.recommendationText",
                          "Diskon optimal: {{percent}}% untuk pendapatan maksimum",
                          { percent: simulationResults.recommendedDiscount.toFixed(1) },
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <Percent className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
                    <p className="text-sm">
                      {t(
                        "promoSimulation.results.emptyHint",
                        "Atur detail promosi lalu jalankan simulasi",
                      )}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-brand-blue-deep">
                  {t("promoSimulation.channelComparison.title", "Perbandingan Channel")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {simulationResults &&
                simulationResults.channelResults &&
                Object.keys(simulationResults.channelResults).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(simulationResults.channelResults).map(([channelId, channelData]) => (
                      <div
                        key={channelId}
                        className="flex items-center justify-between rounded-lg border border-brand-blue/20 bg-brand-blue-soft p-2"
                      >
                        <span className="text-sm font-medium text-brand-blue-deep">{channelData.name}:</span>
                        <span
                          className={`font-bold ${channelData.netProfit >= 0 ? "text-success" : "text-brand-red"}`}
                        >
                          {formatRupiah(channelData.netProfit)}
                        </span>
                      </div>
                    ))}
                    <div className="mt-2 text-xs text-muted-foreground">
                      {t(
                        "promoSimulation.channelComparison.afterFeesNote",
                        "* Setelah dikurangi semua fee dan biaya",
                      )}
                    </div>
                  </div>
                ) : simulationResults ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-brand-blue/20 bg-brand-blue-soft p-2">
                      <span className="text-sm font-medium text-brand-blue-deep">
                        {t("promoSimulation.channelComparison.netProfit", "Keuntungan Net:")}
                      </span>
                      <span
                        className={`font-bold ${simulationResults.newProfit >= 0 ? "text-success" : "text-brand-red"}`}
                      >
                        {formatRupiah(simulationResults.newProfit)}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {t(
                        "promoSimulation.channelComparison.loadHistoryNote",
                        "* Muat perhitungan dari riwayat untuk breakdown per channel",
                      )}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tutorial">{renderTutorial()}</TabsContent>
        </Tabs>
      </div>

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {t("promoSimulation.historyDialog.title", "Pilih Perhitungan dari Riwayat")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "promoSimulation.historyDialog.description",
                "Pilih perhitungan harga tersimpan untuk dimuat ke simulasi promo.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {isLoadingHistory ? (
              <div className="py-8 text-center text-muted-foreground">
                {t("promoSimulation.historyDialog.loading", "Memuat perhitungan...")}
              </div>
            ) : calculations.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <History className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
                <p className="text-sm">
                  {t("promoSimulation.historyDialog.emptyTitle", "Tidak ada perhitungan tersimpan.")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/80">
                  {t(
                    "promoSimulation.historyDialog.emptyHint",
                    "Buka Alat Harga untuk membuat dan menyimpan perhitungan.",
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">
                        {t("promoSimulation.historyDialog.colCalculationName", "Nama Perhitungan")}
                      </TableHead>
                      <TableHead className="min-w-[150px]">
                        {t("promoSimulation.historyDialog.colProductName", "Nama Produk")}
                      </TableHead>
                      <TableHead className="min-w-[120px] text-right">
                        {t("promoSimulation.historyDialog.colSellingPrice", "Harga Jual")}
                      </TableHead>
                      <TableHead className="min-w-[120px] text-right">
                        {t("promoSimulation.historyDialog.colProductionCost", "Biaya Produksi")}
                      </TableHead>
                      <TableHead className="min-w-[140px]">
                        {t("promoSimulation.historyDialog.colDateCreated", "Tanggal Dibuat")}
                      </TableHead>
                      <TableHead className="min-w-[100px] text-center">
                        {t("promoSimulation.historyDialog.colAction", "Aksi")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calculations.map((calculation) => (
                      <TableRow key={calculation.id}>
                        <TableCell className="font-medium">{calculation.calculation_name}</TableCell>
                        <TableCell>{calculation.calculation_input.productName || "-"}</TableCell>
                        <TableCell className="text-right">
                          {formatRupiah(calculation.calculation_result.summary.recommendedSellingPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatRupiah(calculation.calculation_input.productionCostPerUnit || 0)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(calculation.created_at), "dd MMM yyyy", {
                              locale: dateFnsLocale,
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLoadFromHistory(calculation)}
                            className="h-8 w-8 p-0"
                            title={t("promoSimulation.historyDialog.loadAction", "Muat Perhitungan")}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
