import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
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
import {
  resolveTextAIProvider,
  type TextAIProvider,
} from '@/6-1-script-generator/utils/scriptAiTextProvider';
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
  text_ai_provider?: 'gemini' | 'groq' | 'fireworks';
  api_key_configured: boolean;
}

const DEPRECATED_GEMINI_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
];

const GEMINI_MODEL_OPTIONS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
] as const;

// Groq: include vision models for receipt analysis; text-only rows still work for Script Generator.
const GROQ_MODEL_OPTIONS = [
  {
    value: 'meta-llama/llama-4-scout-17b-16e-instruct',
    label: 'Llama 4 Scout 17B (vision / struk)',
  },
  { value: 'llama-3.2-11b-vision-preview', label: 'Llama 3.2 11B vision (preview)' },
  { value: 'llama-3.2-90b-vision-preview', label: 'Llama 3.2 90B vision (preview)' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (instant, teks)' },
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (versatile, teks)' },
] as const;

const FIREWORKS_MODEL_OPTIONS = [
  {
    value: 'fireworks/llama-v3p2-11b-vision-instruct',
    label: 'Llama 3.2 11B vision (struk)',
  },
  {
    value: 'fireworks/llama-v3p2-90b-vision-instruct',
    label: 'Llama 3.2 90B vision (struk, kualitas)',
  },
  {
    value: 'fireworks/llama-v3p1-8b-instruct',
    label: 'Llama 3.1 8B instruct (cepat / murah, teks)',
  },
  {
    value: 'fireworks/llama-v3p3-70b-instruct',
    label: 'Llama 3.3 70B instruct (kualitas, teks)',
  },
] as const;

const CONFIG_SELECT =
  'id, organization_id, daily_limit, model, is_active, text_ai_provider, api_key_configured' as const;

function normalizeStoredModel(raw: string | null | undefined, provider: TextAIProvider): string {
  const fallback =
    provider === 'groq'
      ? 'llama-3.3-70b-versatile'
      : provider === 'fireworks'
        ? 'fireworks/llama-v3p3-70b-instruct'
        : 'gemini-2.5-flash';
  const rawStr = String(raw ?? fallback).trim();
  const s = rawStr.toLowerCase();

  if (provider === 'gemini') {
    if (DEPRECATED_GEMINI_MODELS.includes(s)) return 'gemini-2.5-flash';
    if (GEMINI_MODEL_OPTIONS.some((o) => o.value === s)) return s;
    return 'gemini-2.5-flash';
  }

  if (provider === 'groq') {
    if (GROQ_MODEL_OPTIONS.some((o) => o.value === s)) return s;
    return 'llama-3.3-70b-versatile';
  }

  // Fireworks model ids are case-sensitive; match known options first, else keep trimmed raw.
  if (FIREWORKS_MODEL_OPTIONS.some((o) => o.value === rawStr)) return rawStr;
  const legacyFireworksToCatalog: Record<string, string> = {
    'accounts/fireworks/models/llama-v3p1-8b-instruct': 'fireworks/llama-v3p1-8b-instruct',
    'accounts/fireworks/models/llama-v3p3-70b-instruct': 'fireworks/llama-v3p3-70b-instruct',
    'accounts/fireworks/models/llama-v3p2-11b-vision-instruct': 'fireworks/llama-v3p2-11b-vision-instruct',
    'accounts/fireworks/models/llama-v3p2-90b-vision-instruct': 'fireworks/llama-v3p2-90b-vision-instruct',
  };
  if (legacyFireworksToCatalog[rawStr]) return legacyFireworksToCatalog[rawStr];
  if (rawStr.startsWith('accounts/') || rawStr.startsWith('fireworks/')) return rawStr;
  return fallback;
}

export const ScriptAIConfigSection: React.FC = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { data: configRow, isPending } = useScriptAIConfig();
  const [dailyLimit, setDailyLimit] = useState(50);
  const [model, setModel] = useState('gemini-2.5-flash');
  const [textAiProvider, setTextAiProvider] = useState<TextAIProvider>('gemini');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showRemoveApiKeyConfirm, setShowRemoveApiKeyConfirm] = useState(false);
  const [isRemovingApiKey, setIsRemovingApiKey] = useState(false);

  const provider: TextAIProvider = textAiProvider;
  const modelOptions =
    provider === 'groq'
      ? GROQ_MODEL_OPTIONS
      : provider === 'fireworks'
        ? FIREWORKS_MODEL_OPTIONS
        : GEMINI_MODEL_OPTIONS;

  useEffect(() => {
    if (configRow) {
      setDailyLimit(configRow.daily_limit ?? 50);
      const nextProvider = resolveTextAIProvider(configRow);
      setTextAiProvider(nextProvider);
      setModel(normalizeStoredModel(configRow.model, nextProvider));
    } else {
      setDailyLimit(50);
      setModel('gemini-2.5-flash');
      setTextAiProvider('gemini');
    }
  }, [configRow]);

  const handleSave = async () => {
    if (!organizationId) {
      toast.error('Tidak ada organisasi aktif');
      return;
    }

    // If provider=Gemini, we must have a Gemini key before enabling text AI (image/vision also uses Gemini).
    if (textAiProvider === 'gemini' && !configRow?.api_key_configured && !apiKeyInput.trim()) {
      toast.error('Gemini API key wajib diisi jika provider Text AI adalah Gemini');
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        daily_limit: dailyLimit,
        model,
        text_ai_provider: textAiProvider,
        // Keep true whenever Script AI settings exist: row must exist for daily limits; Groq/Fireworks use server secrets, Gemini uses stored key.
        is_active: true,
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
          const nextProvider = resolveTextAIProvider(saved);
          setTextAiProvider(nextProvider);
          setModel(normalizeStoredModel(saved.model, nextProvider));
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
          const nextProvider = resolveTextAIProvider(saved);
          setTextAiProvider(nextProvider);
          setModel(normalizeStoredModel(saved.model, nextProvider));
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
        })
        .eq('id', configRow.id);

      if (error) throw error;

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
        <div className="rounded-lg border p-4 space-y-3">
          <div>
            <Label id="ai-provider-label">Text AI Provider</Label>
            <p className="text-xs text-gray-500">
              Script Generator & Product Knowledge. Analisis struk (gambar) memakai model vision untuk provider
              terpilih; API key Groq/Fireworks diatur di secrets proyek Supabase (sama seperti generate script). Untuk
              file PDF, gunakan Gemini atau unggah hasil OCR dari perangkat.
            </p>
          </div>
          <div
            role="tablist"
            aria-labelledby="ai-provider-label"
            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
          >
            {(
              [
                { id: 'gemini' as const, label: 'Gemini' },
                { id: 'groq' as const, label: 'Groq' },
                { id: 'fireworks' as const, label: 'Fireworks' },
              ] as const
            ).map((opt) => {
              const selected = textAiProvider === opt.id;
              return (
                <Button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  variant={selected ? 'default' : 'outline'}
                  className="h-auto min-h-10 whitespace-normal px-3 py-2 text-sm"
                  onClick={() => {
                    setTextAiProvider(opt.id);
                    setModel((prev) => normalizeStoredModel(prev, opt.id));
                  }}
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
        </div>

        {provider === 'gemini' && (
          <div className="space-y-2">
            <Label htmlFor="api-key">Gemini API Key</Label>
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
              Text AI (Gemini) + Image/Vision.{' '}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                Buat key
                <ExternalLink className="h-3 w-3" />
              </a>
              . Key tidak ditampilkan setelah disimpan.
            </p>
          </div>
        )}

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
          <p className="text-xs text-gray-500">Maks. generate/hari untuk organisasi ini.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger id="model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modelOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      {provider === 'gemini' && (
        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-gray-600" />
            <h4 className="font-medium text-gray-900">Gemini API Spend</h4>
          </div>
          <p className="text-sm text-gray-600">Usage & biaya di AI Studio (akun yang sama dengan key).</p>
          <a
            href="https://aistudio.google.com/app/spend"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            Buka Spend
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      )}

      {/* Konfirmasi hapus API key */}
      <AlertDialog open={showRemoveApiKeyConfirm} onOpenChange={setShowRemoveApiKeyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              Key dihapus dari database. Text AI (Gemini) dan Image/Vision nonaktif sampai key baru ditambahkan.
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
