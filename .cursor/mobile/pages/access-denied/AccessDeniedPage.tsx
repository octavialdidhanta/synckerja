import React from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
import { useDepartmentAccess } from '@/features/1-layouts/sidebar/useDepartmentAccess';
import { Button } from '@/features/ui/button';

export interface AccessDeniedPageProps {
  /** Optional custom message (e.g. for terminated employee). When set, access level/restriction from useDepartmentAccess are not shown. */
  deniedReason?: string;
}

/**
 * Halaman "Akses Ditolak" khusus mobile.
 * Terintegrasi dengan alur Page Access: ditampilkan saat user tidak punya akses ke route yang dilindungi.
 * Bahasa mengikuti pengaturan di /profile (useAppTranslation).
 * Satu tombol saja: "Back to Home". Tanpa horizontal scroll.
 */
export function AccessDeniedPage({ deniedReason }: AccessDeniedPageProps) {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const { getAccessLevel, getDepartmentRestrictionMessage } = useDepartmentAccess();

  const restrictionMessage = getDepartmentRestrictionMessage();
  const accessLevel = getAccessLevel();

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-gray-50 font-sans overflow-x-hidden overflow-y-auto overscroll-none touch-pan-y" style={{ overscrollBehavior: 'none' }}>
      <div className="flex-1 flex items-center justify-center p-4 min-w-0 safe-area-top safe-area-bottom">
        <div className="w-full max-w-md mx-auto min-w-0">
          <div className="text-center">
            <div className="mx-auto w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-6 flex-shrink-0">
              <XCircle className="h-12 w-12 text-red-500" aria-hidden />
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6 text-left overflow-hidden min-w-0">
              <h1 className="text-xl font-semibold text-gray-900 mb-3">
                {t('accessDenied.title', 'Akses Ditolak')}
              </h1>

              <p className="text-gray-600 mb-6">
                {deniedReason ?? t('accessDenied.message', 'Anda tidak memiliki izin untuk mengakses halaman ini.')}
              </p>

              {!deniedReason && (accessLevel || restrictionMessage) && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm text-gray-700 space-y-2">
                  {accessLevel && (
                    <p>
                      <span className="font-medium">{t('accessDenied.accessLevel', 'Level Akses')}:</span>{' '}
                      {accessLevel}
                    </p>
                  )}
                  {restrictionMessage && (
                    <p>
                      <span className="font-medium">{t('accessDenied.restriction', 'Pembatasan')}:</span>{' '}
                      {restrictionMessage}
                    </p>
                  )}
                </div>
              )}

              <Button
                onClick={() => navigate('/', { replace: true })}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {t('accessDenied.backToHome', 'Kembali ke Beranda')}
              </Button>
            </div>

            <p className="text-sm text-gray-500 mt-4">
              {t('accessDenied.contactAdmin', 'Hubungi administrator jika Anda memerlukan akses')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
