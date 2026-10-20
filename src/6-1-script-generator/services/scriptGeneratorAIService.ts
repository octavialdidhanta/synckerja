import { presentGeminiSpendCap, readEdgeFunctionError } from '@/shared/ai/geminiSpendCap';
import { supabase, SUPABASE_URL } from '@/shared/lib/supabaseClient';

export interface GenerateScriptWithAIResponse {
  success: boolean;
  script?: string;
  error?: string;
}

function aiFailure(error: string): GenerateScriptWithAIResponse {
  presentGeminiSpendCap(error);
  return { success: false, error };
}

const scriptReceipts: string[] = [];

function rememberScriptReceipt(data: { usageId?: unknown; unassigned?: unknown } | null | undefined) {
  if (data?.unassigned === true && typeof data.usageId === "string" && data.usageId) {
    scriptReceipts.push(data.usageId);
  }
}

export function takeScriptReceipts(): string[] {
  return scriptReceipts.splice(0, scriptReceipts.length);
}

export function restoreScriptReceipts(ids: string[]) {
  if (ids.length > 0) scriptReceipts.unshift(...ids);
}

export async function reviseScriptPart(
  originalText: string,
  instruction: string,
  sectionType?: string,
  fullScript?: string,
  previousRowText?: string,
  nextRowText?: string
): Promise<GenerateScriptWithAIResponse> {
  try {
    const trimmedOriginal = originalText?.trim() ?? '';
    const trimmedInstruction = instruction?.trim() ?? '';
    if (!trimmedOriginal || !trimmedInstruction) {
      return {
        success: false,
        error: 'Teks yang akan direvisi dan instruksi revisi harus diisi.',
      };
    }

    const body: {
      mode: string;
      originalText: string;
      instruction: string;
      sectionType?: string;
      fullScript?: string;
      previousRowText?: string;
      nextRowText?: string;
    } = {
      mode: 'revise',
      originalText: trimmedOriginal,
      instruction: trimmedInstruction,
      sectionType: sectionType?.trim() || undefined,
    };
    if (fullScript != null && fullScript.trim() !== '') {
      body.fullScript = fullScript.trim();
    }
    if (previousRowText != null && previousRowText.trim() !== '') {
      body.previousRowText = previousRowText.trim();
    }
    if (nextRowText != null && nextRowText.trim() !== '') {
      body.nextRowText = nextRowText.trim();
    }

    const { data, error } = await supabase.functions.invoke('generate-script-ai', {
      body: { ...body, trackForPlan: true },
    });

    if (error) {
      const serverMsg = await readEdgeFunctionError(data, error);
      return aiFailure(serverMsg || 'Gagal merevisi. Coba lagi.');
    }

    const errMsg = data?.error;
    if (errMsg) {
      return aiFailure(typeof errMsg === 'string' ? errMsg : 'Failed to revise script part');
    }

    const script = data?.script;
    if (typeof script !== 'string') {
      return {
        success: false,
        error: 'No revised content from AI',
      };
    }

    rememberScriptReceipt(data);
    return {
      success: true,
      script: script.trim(),
    };
  } catch (err) {
    console.error('reviseScriptPart error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    let friendlyMsg = msg;
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      friendlyMsg = 'Koneksi gagal. Periksa internet dan pastikan Edge Function "generate-script-ai" sudah di-deploy.';
    } else if (msg.includes('Edge Function')) {
      friendlyMsg = `${msg} Pastikan Edge Function "generate-script-ai" sudah di-deploy.`;
    }
    return {
      success: false,
      error: friendlyMsg,
    };
  }
}

export async function regenerateScriptWithDifferentProblem(
  fullScript: string,
  instruction: string
): Promise<GenerateScriptWithAIResponse> {
  try {
    const trimmedScript = fullScript?.trim() ?? '';
    const trimmedInstruction = instruction?.trim() ?? '';
    if (!trimmedScript || !trimmedInstruction) {
      return {
        success: false,
        error: 'Script dan instruksi harus diisi.',
      };
    }

    const { data, error } = await supabase.functions.invoke('generate-script-ai', {
      body: {
        mode: 'reframe',
        fullScript: trimmedScript,
        instruction: trimmedInstruction,
        trackForPlan: true,
      },
    });

    if (error) {
      const serverMsg = await readEdgeFunctionError(data, error);
      return aiFailure(serverMsg || 'Gagal meregenerasi. Coba lagi.');
    }

    const errMsg = data?.error;
    if (errMsg) {
      return aiFailure(typeof errMsg === 'string' ? errMsg : 'Failed to regenerate script');
    }

    const script = data?.script;
    if (typeof script !== 'string') {
      return {
        success: false,
        error: 'No content generated from AI',
      };
    }

    rememberScriptReceipt(data);
    return {
      success: true,
      script: script.trim(),
    };
  } catch (err) {
    console.error('regenerateScriptWithDifferentProblem error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    let friendlyMsg = msg;
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      friendlyMsg = 'Koneksi gagal. Periksa internet dan pastikan Edge Function "generate-script-ai" sudah di-deploy.';
    } else if (msg.includes('Edge Function')) {
      friendlyMsg = `${msg} Pastikan Edge Function "generate-script-ai" sudah di-deploy.`;
    }
    return {
      success: false,
      error: friendlyMsg,
    };
  }
}

export async function generateScriptWithAI(
  prompt: string,
  options?: { trackForPlan?: boolean },
): Promise<GenerateScriptWithAIResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return {
        success: false,
        error: 'Sesi login tidak valid. Silakan login ulang.',
      };
    }

    const url = `${SUPABASE_URL}/functions/v1/generate-script-ai`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ prompt: prompt.trim(), trackForPlan: options?.trackForPlan === true }),
    });

    const data = await res.json().catch(() => null);
    if (data === null || typeof data !== 'object') {
      return {
        success: false,
        error: 'Response server tidak valid. Coba lagi.',
      };
    }

    if (!res.ok) {
      const errMsg = typeof data?.error === 'string' ? data.error : null;
      let message = errMsg || `Request gagal (${res.status})`;
      if (res.status === 404) {
        message = 'Edge Function "generate-script-ai" belum di-deploy. Jalankan: supabase functions deploy generate-script-ai';
      } else if (res.status === 401) {
        message = 'Sesi expired. Silakan login ulang.';
      } else if (res.status >= 500) {
        message = errMsg || 'Server sibuk. Coba lagi dalam beberapa saat.';
      }
      return aiFailure(message);
    }

    const errMsg = data?.error;
    if (errMsg) {
      return aiFailure(typeof errMsg === 'string' ? errMsg : 'Failed to generate script');
    }

    const script = data?.script;
    if (typeof script !== 'string') {
      return {
        success: false,
        error: 'No content generated from AI',
      };
    }

    if (options?.trackForPlan) rememberScriptReceipt(data);
    return {
      success: true,
      script: script.trim(),
    };
  } catch (err) {
    console.error('generateScriptWithAI error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    let friendlyMsg = msg;
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      friendlyMsg = 'Koneksi gagal. Periksa internet dan pastikan Edge Function "generate-script-ai" sudah di-deploy (supabase functions deploy generate-script-ai).';
    } else if (msg.includes('Edge Function')) {
      friendlyMsg = `${msg} Pastikan Edge Function "generate-script-ai" sudah di-deploy.`;
    }
    return {
      success: false,
      error: friendlyMsg,
    };
  }
}
