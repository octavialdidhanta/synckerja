import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useScriptAIConfig } from '@/6-1-script-generator/hooks/useScriptAIConfig';
import { toast } from 'sonner';
import { Loader2, ExternalLink, DollarSign, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';

interface ScriptAIConfig {
  id: string;
  organization_id: string;
  daily_limit: number;
  model: string;
  is_active: boolean;
  api_key_configured: boolean;
}

const DEPRECATED_MODELS = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-exp'];
const MODEL_OPTIONS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
] as const;

const CONFIG_SELECT =
  'id, organization_id, daily_limit, model, is_active, api_key_configured' as const;

function normalizeStoredModel(raw: string | null | undefined): string {
  const s = String(raw ?? 'gemini-2.5-flash').trim().toLowerCase();
  if (DEPRECATED_MODELS.includes(s)) return 'gemini-2.5-flash';
  if (MODEL_OPTIONS.some((o) => o.value === s)) return s;
  return 'gemini-2.5-flash';
}

export const ScriptAIConfigSection: React.FC = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { data: configRow, isPending } = useScriptAIConfig();
  const [dailyLimit, setDailyLimit] = useState(50);
  const [model, setModel] = useState('gemini-2.5-flash');
  const [isActive, setIsActive] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showRemoveApiKeyConfirm, setShowRemoveApiKeyConfirm] = useState(false);
  const [isRemovingApiKey, setIsRemovingApiKey] = useState(false);

  useEffect(() => {
    if (configRow) {
      setDailyLimit(configRow.daily_limit ?? 50);
      setModel(normalizeStoredModel(configRow.model));
      setIsActive(configRow.is_active ?? false);
    } else {
      setDailyLimit(50);
      setModel('gemini-2.5-flash');
      setIsActive(false);
    }
  }, [configRow]);

  const handleSave = async () => {
    if (!organizationId) {
      toast.error('Tidak ada organisasi aktif');
      return;
    }

    if (isActive && !configRow?.api_key_configured && !apiKeyInput.trim()) {
      toast.error('API key wajib diisi jika Enable AI aktif');
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        daily_limit: dailyLimit,
        model,
        is_active: isActive,
      };

      if (apiKeyInput.trim()) {
        payload.google_ai_api_key = apiKeyInput.trim();
        payload.api_key_configured = true;
      }

      if (configRow?.id) {
        const { data: saved, error } = await supabase
          .from('organization_script_ai_config')
          .update(payload)
          .eq('id', configRow.id)
          .select(CONFIG_SELECT)
          .single();

        if (error) throw error;
        if (saved) {
          setDailyLimit(saved.daily_limit ?? 50);
          setModel(normalizeStoredModel(saved.model));
          setIsActive(saved.is_active ?? false);
        }
      } else {
        const insertPayload = {
          ...payload,
          organization_id: organizationId,
          api_key_configured: !!apiKeyInput.trim(),
        };
        const { data: saved, error } = await supabase
          .from('organization_script_ai_config')
          .insert(insertPayload)
          .select(CONFIG_SELECT)
          .single();

        if (error) throw error;
        if (saved) {
          setDailyLimit(saved.daily_limit ?? 50);
          setModel(normalizeStoredModel(saved.model));
          setIsActive(saved.is_active ?? false);
        }
      }

      setApiKeyInput('');
      queryClient.invalidateQueries({ queryKey: ['script-ai-config', organizationId] });
      toast.success('Konfigurasi berhasil disimpan');
    } catch (err) {
      console.error('Save config error:', err);
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveApiKey = async () => {
    if (!configRow?.id || !organizationId) return;
    setIsRemovingApiKey(true);
    try {
      const { error } = await supabase
        .from('organization_script_ai_config')
        .update({
          google_ai_api_key: null,
          api_key_configured: false,
          is_active: false,
        })
        .eq('id', configRow.id);

      if (error) throw error;

      setIsActive(false);
      setShowRemoveApiKeyConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['script-ai-config', organizationId] });
      toast.success('API key berhasil dihapus');
    } catch (err) {
      console.error('Remove API key error:', err);
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus API key');
    } finally {
      setIsRemovingApiKey(false);
    }
  };

  const apiKeyPlaceholder = configRow?.api_key_configured
    ? '•••••••••••• API key sudah dikonfigurasi'
    : 'Masukkan API key dari Google AI Studio';

  if (!organizationId || isPending) {
    return null;
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="api-key">Google AI API Key</Label>
          <div className="flex gap-2">
            <Input
              id="api-key"
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={apiKeyPlaceholder}
              autoComplete="off"
              className="font-mono flex-1"
            />
            {configRow?.api_key_configured && (
              <Button
                type="button"
                variant="outline"
                className="h-10 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 shrink-0 px-4"
                onClick={() => setShowRemoveApiKeyConfirm(true)}
                disabled={isSaving}
                title="Hapus API key dari database"
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Hapus API Key
              </Button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Dapatkan API key gratis di{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              Google AI Studio
              <ExternalLink className="h-3 w-3" />
            </a>
            . API key tidak pernah ditampilkan untuk keamanan.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="daily-limit">Daily Limit</Label>
          <Input
            id="daily-limit"
            type="number"
            min={1}
            max={500}
            value={dailyLimit}
            onChange={(e) => setDailyLimit(Math.max(1, parseInt(e.target.value) || 50))}
          />
          <p className="text-xs text-gray-500">Maksimal generate per hari per tenant.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger id="model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODEL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <Label htmlFor="enable-ai">Enable AI</Label>
            <p className="text-xs text-gray-500">Aktifkan fitur Generate dengan AI di Script Generator.</p>
          </div>
          <Switch
            id="enable-ai"
            checked={isActive}
            onCheckedChange={setIsActive}
          />
        </div>
      </div>

      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Menyimpan...
          </>
        ) : (
          'Simpan'
        )}
      </Button>

      {/* Gemini API Spend - Link ke halaman resmi Google AI Studio */}
      <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-gray-600" />
          <h4 className="font-medium text-gray-900">Gemini API Spend</h4>
        </div>
        <p className="text-sm text-gray-600">
          Lihat penggunaan dan biaya Gemini API di Google AI Studio. Login dengan akun Google yang digunakan untuk API key.
        </p>
        <a
          href="https://aistudio.google.com/app/spend"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          Lihat Gemini API Spend
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {/* Konfirmasi hapus API key */}
      <AlertDialog open={showRemoveApiKeyConfirm} onOpenChange={setShowRemoveApiKeyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              API key akan dihapus dari database. Fitur Generate dengan AI akan dinonaktifkan. Anda dapat menambahkan API key baru kapan saja.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingApiKey}>Batal</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleRemoveApiKey}
              disabled={isRemovingApiKey}
            >
              {isRemovingApiKey ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menghapus...
                </>
              ) : (
                'Hapus API Key'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
