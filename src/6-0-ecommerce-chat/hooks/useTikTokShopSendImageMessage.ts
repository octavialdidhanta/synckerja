import { useMutation, useQueryClient } from '@tanstack/react-query';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';

export const TIKTOK_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const TIKTOK_IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]);

type SendImageInput = {
  organizationId: string;
  accountId: string;
  conversationId: string;
  file: File;
};

type SendImageResult = {
  message_id: string;
  url: string;
  width: number;
  height: number;
  request_id?: string | null;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('READ_FAILED'));
    reader.readAsDataURL(file);
  });
}

export function validateTikTokImageFile(file: File): 'INVALID_TYPE' | 'TOO_LARGE' | null {
  const type = (file.type || '').toLowerCase();
  if (!ALLOWED_TYPES.has(type)) return 'INVALID_TYPE';
  if (file.size > TIKTOK_IMAGE_MAX_BYTES) return 'TOO_LARGE';
  return null;
}

export function useTikTokShopSendImageMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SendImageInput): Promise<SendImageResult> => {
      const validation = validateTikTokImageFile(input.file);
      if (validation === 'INVALID_TYPE') throw new Error('INVALID_TYPE');
      if (validation === 'TOO_LARGE') throw new Error('TOO_LARGE');

      const imageBase64 = await fileToBase64(input.file);
      if (!imageBase64) throw new Error('INVALID_TYPE');

      const contentType =
        input.file.type.toLowerCase() === 'image/jpg'
          ? 'image/jpeg'
          : input.file.type.toLowerCase();

      const { data, error } = await supabase.functions.invoke('tiktok-shop-customer-service', {
        body: {
          action: 'sendImageMessage',
          organization_id: input.organizationId,
          account_id: input.accountId,
          conversation_id: input.conversationId,
          image_base64: imageBase64,
          content_type: contentType,
          filename: input.file.name || 'image.jpg',
        },
      });
      if (error) throw await parseEdgeFunctionError(error, data);
      const payload = data as SendImageResult & { error?: string; code?: string };
      if (payload?.error) {
        throw await parseEdgeFunctionError(null, payload);
      }
      const messageId = String(payload.message_id ?? '').trim();
      if (!messageId) throw new Error('Missing message_id');
      return {
        message_id: messageId,
        url: String(payload.url ?? ''),
        width: Number(payload.width) || 0,
        height: Number(payload.height) || 0,
        request_id: payload.request_id,
      };
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [
          'tiktok-shop-conversation-messages',
          variables.organizationId,
          variables.accountId,
          variables.conversationId,
        ],
      });
      void queryClient.invalidateQueries({
        queryKey: ['tiktok-shop-conversations', variables.organizationId, variables.accountId],
      });
    },
  });
}
