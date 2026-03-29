import { CheckCircle } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

export default function CandidateProfileThankYou() {
  const { t } = useAppTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          {t('candidateProfile.thankYou.title', 'Profil Terkirim')}
        </h1>
        <p className="text-gray-600 mb-4">
          {t('candidateProfile.thankYou.message', 'Terima kasih telah melengkapi profil Anda. HR akan meninjau informasi dan menghubungi Anda segera.')}
        </p>
        <p className="text-sm text-gray-500">
          {t('candidateProfile.thankYou.note', 'Profil Anda telah berhasil dikirim dan tidak dapat diubah lagi.')}
        </p>
      </div>
    </div>
  );
}
