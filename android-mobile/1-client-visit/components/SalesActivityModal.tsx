import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/shared/components/ui/dialog";
import { Button } from "@/mobile-app/components/ui/button";
import { Input } from "@/mobile-app/components/ui/input";
import { Label } from "@/mobile-app/components/ui/label";
import { Textarea } from "@/mobile-app/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/mobile-app/components/ui/select";
import { Switch } from "@/mobile-app/components/ui/switch";
import { Card } from "@/mobile-app/components/ui/card";
import { Loader2, Upload, Briefcase, Building2, CreditCard, FileText } from "lucide-react";
import { supabase } from "@/shared/lib/supabaseClient";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { toast } from "@/shared/hooks/use-toast";
import {
  ProfileDetailModalHeader,
  profileFullscreenDialogContentClass,
  profileFullscreenScrollBodyClass,
} from "@/mobile/1-profile/components/ProfileInfoModalParts";

interface SalesActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SalesActivityData) => Promise<void>;
  clientData?: {
    company_name: string;
    contact_phone?: string;
  };
}

export interface SalesActivityData {
  client_name: string;
  client_phone?: string;
  activity_type: string;
  status: string;
  amount?: number;
  total_amount?: number;
  down_payment_amount?: number;
  is_down_payment?: boolean;
  description?: string;
  is_paid?: boolean;
  payment_method?: string;
  follow_up_date?: string;
  notes?: string;
  receipt_url?: string;
}

const EMPTY_FORM: SalesActivityData = {
  client_name: "",
  client_phone: "",
  activity_type: "visit",
  status: "completed",
  amount: undefined,
  total_amount: undefined,
  down_payment_amount: undefined,
  is_down_payment: false,
  description: "",
  is_paid: false,
  payment_method: "",
  follow_up_date: "",
  notes: "",
  receipt_url: "",
};

export const SalesActivityModal = ({
  isOpen,
  onClose,
  onSubmit,
  clientData,
}: SalesActivityModalProps) => {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<SalesActivityData>(EMPTY_FORM);

  useEffect(() => {
    if (!isOpen) return;
    setFormData({
      ...EMPTY_FORM,
      client_name: clientData?.company_name || "",
      client_phone: clientData?.contact_phone || "",
    });
  }, [isOpen, clientData]);

  const updateFormData = (field: keyof SalesActivityData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.client_name.trim()) {
      toast({
        title: t("mobileHome.error", "Error"),
        description: t("clientVisit.salesActivity.clientRequired", "Nama client wajib diisi"),
        variant: "destructive",
      });
      return;
    }

    if (formData.is_paid && !formData.payment_method?.trim()) {
      toast({
        title: t("mobileHome.error", "Error"),
        description: t(
          "clientVisit.salesActivity.paymentMethodRequired",
          "Pilih metode pembayaran jika sudah dibayar",
        ),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        payment_method: formData.is_paid ? formData.payment_method : undefined,
      });
    } catch (error) {
      console.error("Error submitting sales activity:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceiptUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: t("mobileHome.error", "Error"),
        description: t(
          "clientVisit.salesActivity.receiptTypeInvalid",
          "Hanya file gambar (JPEG, PNG) atau PDF yang diizinkan",
        ),
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t("mobileHome.error", "Error"),
        description: t("clientVisit.salesActivity.receiptTooLarge", "Ukuran file maksimal 5MB"),
        variant: "destructive",
      });
      return;
    }

    setIsUploadingReceipt(true);
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("User not authenticated");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.data.user.id}/${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage.from("sales-receipts").upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage.from("sales-receipts").getPublicUrl(data.path);
      updateFormData("receipt_url", urlData.publicUrl);
    } catch (error) {
      console.error("Error uploading receipt:", error);
      toast({
        title: t("mobileHome.error", "Error"),
        description: t("clientVisit.salesActivity.receiptUploadFailed", "Gagal mengupload receipt"),
        variant: "destructive",
      });
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting || isUploadingReceipt) return;
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className={profileFullscreenDialogContentClass(isMobile)}
        fullscreenAnimation={isMobile}
      >
        <ProfileDetailModalHeader
          isMobile={isMobile}
          title={t("clientVisit.salesActivity.title", "Aktivitas Penjualan")}
          icon={Briefcase}
          closeLabel={t("common.close", "Tutup")}
          onClose={handleClose}
        />

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={profileFullscreenScrollBodyClass()}>
            <div className="mx-auto w-full max-w-md space-y-1 pb-4">
              <Card className="border-border bg-card">
                <div className="border-b border-border px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Building2 className="h-4 w-4 text-brand-blue" aria-hidden />
                    {t("clientVisit.salesActivity.clientSection", "Informasi Client")}
                  </div>
                </div>
                <div className="space-y-3 p-3">
                  <div className="space-y-2">
                    <Label htmlFor="client_name">{t("clientVisit.salesActivity.clientName", "Nama Client")} *</Label>
                    <Input
                      id="client_name"
                      className="text-sm"
                      value={formData.client_name}
                      onChange={(e) => updateFormData("client_name", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client_phone">{t("clientVisit.phone", "Phone")}</Label>
                    <Input
                      id="client_phone"
                      className="text-sm"
                      value={formData.client_phone}
                      onChange={(e) => updateFormData("client_phone", e.target.value)}
                      placeholder="08xxxxxxxxxx"
                    />
                  </div>
                </div>
              </Card>

              <Card className="border-border bg-card">
                <div className="border-b border-border px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <FileText className="h-4 w-4 text-brand-blue" aria-hidden />
                    {t("clientVisit.salesActivity.activitySection", "Detail Aktivitas")}
                  </div>
                </div>
                <div className="space-y-3 p-3">
                  <div className="space-y-2">
                    <Label>{t("clientVisit.salesActivity.activityType", "Jenis Aktivitas")} *</Label>
                    <Select
                      value={formData.activity_type}
                      onValueChange={(value) => updateFormData("activity_type", value)}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="visit">{t("clientVisit.salesActivity.typeVisit", "Kunjungan")}</SelectItem>
                        <SelectItem value="Call">{t("clientVisit.salesActivity.typeCall", "Telepon")}</SelectItem>
                        <SelectItem value="Meeting">{t("clientVisit.salesActivity.typeMeeting", "Meeting")}</SelectItem>
                        <SelectItem value="Proposal">{t("clientVisit.salesActivity.typeProposal", "Proposal")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("clientVisits.table.status", "Status")} *</Label>
                    <Select value={formData.status} onValueChange={(value) => updateFormData("status", value)}>
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="completed">{t("clientVisit.completedVisit", "Selesai")}</SelectItem>
                        <SelectItem value="in_progress">{t("clientVisit.inProgress", "Berlangsung")}</SelectItem>
                        <SelectItem value="scheduled">{t("clientVisit.salesActivity.statusScheduled", "Terjadwal")}</SelectItem>
                        <SelectItem value="cancelled">{t("clientVisit.cancelled", "Dibatalkan")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="total_amount">{t("clientVisit.salesActivity.totalAmount", "Total Amount (Rp)")}</Label>
                    <Input
                      id="total_amount"
                      type="number"
                      className="text-sm"
                      value={formData.total_amount ?? ""}
                      onChange={(e) =>
                        updateFormData("total_amount", e.target.value ? Number(e.target.value) : undefined)
                      }
                      placeholder="0"
                      min={0}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="follow_up_date">{t("clientVisit.salesActivity.followUp", "Tanggal Follow Up")}</Label>
                    <Input
                      id="follow_up_date"
                      type="datetime-local"
                      className="text-sm"
                      value={formData.follow_up_date}
                      onChange={(e) => updateFormData("follow_up_date", e.target.value)}
                    />
                  </div>
                </div>
              </Card>

              <Card className="border-border bg-card">
                <div className="border-b border-border px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <CreditCard className="h-4 w-4 text-brand-blue" aria-hidden />
                    {t("clientVisit.salesActivity.paymentSection", "Pembayaran")}
                  </div>
                </div>
                <div className="space-y-3 p-3">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <Label htmlFor="is_down_payment" className="text-sm">
                      {t("clientVisit.salesActivity.downPayment", "Uang Muka")}
                    </Label>
                    <Switch
                      id="is_down_payment"
                      checked={formData.is_down_payment}
                      onCheckedChange={(checked) => updateFormData("is_down_payment", checked)}
                    />
                  </div>

                  {formData.is_down_payment && (
                    <div className="space-y-2">
                      <Label htmlFor="down_payment_amount">
                        {t("clientVisit.salesActivity.downPaymentAmount", "Jumlah Uang Muka (Rp)")}
                      </Label>
                      <Input
                        id="down_payment_amount"
                        type="number"
                        className="text-sm"
                        value={formData.down_payment_amount ?? ""}
                        onChange={(e) =>
                          updateFormData(
                            "down_payment_amount",
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                        placeholder="0"
                        min={0}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <Label htmlFor="is_paid" className="text-sm">
                      {t("clientVisit.salesActivity.alreadyPaid", "Sudah Dibayar")}
                    </Label>
                    <Switch
                      id="is_paid"
                      checked={formData.is_paid}
                      onCheckedChange={(checked) => {
                        updateFormData("is_paid", checked);
                        if (!checked) updateFormData("payment_method", "");
                      }}
                    />
                  </div>

                  {formData.is_paid && (
                    <>
                      <div className="space-y-2">
                        <Label>{t("clientVisit.salesActivity.paymentMethod", "Metode Pembayaran")} *</Label>
                        <Select
                          value={formData.payment_method || undefined}
                          onValueChange={(value) => updateFormData("payment_method", value)}
                        >
                          <SelectTrigger className="text-sm">
                            <SelectValue
                              placeholder={t(
                                "clientVisit.salesActivity.paymentMethodPlaceholder",
                                "Pilih metode pembayaran",
                              )}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">{t("clientVisit.salesActivity.payCash", "Tunai")}</SelectItem>
                            <SelectItem value="transfer">{t("clientVisit.salesActivity.payTransfer", "Transfer Bank")}</SelectItem>
                            <SelectItem value="credit_card">{t("clientVisit.salesActivity.payCredit", "Kartu Kredit")}</SelectItem>
                            <SelectItem value="e_wallet">{t("clientVisit.salesActivity.payEwallet", "E-Wallet")}</SelectItem>
                            <SelectItem value="other">{t("clientVisit.salesActivity.payOther", "Lainnya")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>{t("clientVisit.salesActivity.receipt", "Upload Receipt")}</Label>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleReceiptUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingReceipt}
                          className="w-full justify-center"
                        >
                          {isUploadingReceipt ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="mr-2 h-4 w-4" />
                          )}
                          {isUploadingReceipt
                            ? t("clientVisit.salesActivity.uploading", "Mengupload…")
                            : t("clientVisit.salesActivity.chooseFile", "Pilih File")}
                        </Button>
                        {formData.receipt_url ? (
                          <p className="text-xs text-green-600">
                            {t("clientVisit.salesActivity.receiptUploaded", "Receipt berhasil diupload")}
                          </p>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              </Card>

              <Card className="border-border bg-card">
                <div className="border-b border-border px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <FileText className="h-4 w-4 text-brand-blue" aria-hidden />
                    {t("clientVisit.notes", "Notes")}
                  </div>
                </div>
                <div className="space-y-3 p-3">
                  <div className="space-y-2">
                    <Label htmlFor="description">{t("clientVisit.salesActivity.description", "Deskripsi")}</Label>
                    <Textarea
                      id="description"
                      className="text-sm"
                      value={formData.description}
                      onChange={(e) => updateFormData("description", e.target.value)}
                      placeholder={t(
                        "clientVisit.salesActivity.descriptionPlaceholder",
                        "Ringkasan hasil kunjungan…",
                      )}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">{t("clientVisit.salesActivity.notes", "Catatan")}</Label>
                    <Textarea
                      id="notes"
                      className="text-sm"
                      value={formData.notes}
                      onChange={(e) => updateFormData("notes", e.target.value)}
                      placeholder={t("clientVisit.salesActivity.notesPlaceholder", "Catatan tambahan…")}
                      rows={2}
                    />
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div className="flex-shrink-0 border-t bg-muted/30 px-4 pb-3 pt-3">
            <div className="mx-auto flex w-full max-w-md items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={isSubmitting || isUploadingReceipt}
              >
                {t("common.cancel", "Batal")}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || isUploadingReceipt}
                className="min-w-[120px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("common.saving", "Saving…")}
                  </>
                ) : (
                  t("common.save", "Simpan")
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
