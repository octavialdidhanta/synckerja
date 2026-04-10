import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/mobile/components/ui/dialog";
import { Button } from "@/mobile/components/ui/button";
import { Input } from "@/mobile/components/ui/input";
import { Label } from "@/mobile/components/ui/label";
import { Textarea } from "@/mobile/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/mobile/components/ui/select";
import { Switch } from "@/mobile/components/ui/switch";
import { Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

export const SalesActivityModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  clientData 
}: SalesActivityModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<SalesActivityData>({
    client_name: clientData?.company_name || "",
    client_phone: clientData?.contact_phone || "",
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
    receipt_url: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await onSubmit(formData);
      // Reset form
      setFormData({
        client_name: clientData?.company_name || "",
        client_phone: clientData?.contact_phone || "",
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
        receipt_url: ""
      });
      // Don't close modal here - let onSubmit handle it
    } catch (error) {
      console.error('Error submitting sales activity:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update form when clientData changes
  useEffect(() => {
    if (clientData) {
      setFormData(prev => ({
        ...prev,
        client_name: clientData.company_name || "",
        client_phone: clientData.contact_phone || ""
      }));
    }
  }, [clientData]);

  const updateFormData = (field: keyof SalesActivityData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleReceiptUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Hanya file gambar (JPEG, PNG) atau PDF yang diizinkan');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file maksimal 5MB');
      return;
    }

    setIsUploadingReceipt(true);
    
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('User not authenticated');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.data.user.id}/${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('sales-receipts')
        .upload(fileName, file);

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('sales-receipts')
        .getPublicUrl(data.path);

      updateFormData('receipt_url', urlData.publicUrl);
    } catch (error) {
      console.error('Error uploading receipt:', error);
      alert('Gagal mengupload receipt. Silakan coba lagi.');
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aktivitas Penjualan</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client_name">Nama Client *</Label>
            <Input
              id="client_name"
              value={formData.client_name}
              onChange={(e) => updateFormData('client_name', e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_phone">No. Telepon Client</Label>
            <Input
              id="client_phone"
              value={formData.client_phone}
              onChange={(e) => updateFormData('client_phone', e.target.value)}
              placeholder="08xxxxxxxxxx"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="activity_type">Jenis Aktivitas *</Label>
            <Select value={formData.activity_type} onValueChange={(value) => updateFormData('activity_type', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="visit">Kunjungan</SelectItem>
                <SelectItem value="call">Telepon</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="follow_up">Follow Up</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status *</Label>
            <Select value={formData.status} onValueChange={(value) => updateFormData('status', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="completed">Selesai</SelectItem>
                <SelectItem value="in_progress">Sedang Berlangsung</SelectItem>
                <SelectItem value="scheduled">Terjadwal</SelectItem>
                <SelectItem value="cancelled">Dibatalkan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="total_amount">Total Amount (Rp)</Label>
            <Input
              id="total_amount"
              type="number"
              value={formData.total_amount || ""}
              onChange={(e) => updateFormData('total_amount', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="0"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_down_payment"
              checked={formData.is_down_payment}
              onCheckedChange={(checked) => updateFormData('is_down_payment', checked)}
            />
            <Label htmlFor="is_down_payment">Uang Muka</Label>
          </div>

          {formData.is_down_payment && (
            <div className="space-y-2">
              <Label htmlFor="down_payment_amount">Jumlah Uang Muka (Rp)</Label>
              <Input
                id="down_payment_amount"
                type="number"
                value={formData.down_payment_amount || ""}
                onChange={(e) => updateFormData('down_payment_amount', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="0"
              />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="is_paid"
              checked={formData.is_paid}
              onCheckedChange={(checked) => updateFormData('is_paid', checked)}
            />
            <Label htmlFor="is_paid">Sudah Dibayar</Label>
          </div>

          {formData.is_paid && (
            <>
              <div className="space-y-2">
                <Label htmlFor="payment_method">Metode Pembayaran</Label>
                <Select value={formData.payment_method} onValueChange={(value) => updateFormData('payment_method', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih metode pembayaran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Tunai</SelectItem>
                    <SelectItem value="transfer">Transfer Bank</SelectItem>
                    <SelectItem value="credit_card">Kartu Kredit</SelectItem>
                    <SelectItem value="debit_card">Kartu Debit</SelectItem>
                    <SelectItem value="e_wallet">E-Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="receipt">Upload Receipt</Label>
                <div className="flex items-center gap-2">
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
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingReceipt}
                    className="flex-1"
                  >
                    {isUploadingReceipt ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    {isUploadingReceipt ? "Uploading..." : "Pilih File"}
                  </Button>
                </div>
                {formData.receipt_url && (
                  <p className="text-sm text-muted-foreground">
                    ✅ Receipt berhasil diupload
                  </p>
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="follow_up_date">Tanggal Follow Up</Label>
            <Input
              id="follow_up_date"
              type="datetime-local"
              value={formData.follow_up_date}
              onChange={(e) => updateFormData('follow_up_date', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateFormData('description', e.target.value)}
              placeholder="Deskripsi aktivitas..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => updateFormData('notes', e.target.value)}
              placeholder="Catatan tambahan..."
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => !isSubmitting && onClose()} disabled={isSubmitting} className="flex-1">
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting || isUploadingReceipt} className="flex-1">
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};