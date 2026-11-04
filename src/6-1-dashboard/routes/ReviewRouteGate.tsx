import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/shared/lib/supabaseClient';
import { logger } from '@/shared/lib/logger';
import { LoadingDots } from '@/shared/components/LoadingDots';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useIsMobile } from '@/mobile/shared/hooks/use-mobile';
import PublicContentReviewPage from '../pages/PublicContentReviewPage';

/**
 * /review/:token is a guest page. A signed-in desktop session used to leave this URL
 * for the protected dashboard, and a stale session then landed on /login.
 * Stay here. Logged-in mobile still gets a back header.
 */
export const ReviewRouteGate: React.FC = () => {
  const { t } = useAppTranslation();
  const { token } = useParams<{ token: string }>();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const isViewportMobile = useIsMobile();
  const isMobileUserAgent = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
  const isMobile = isViewportMobile || isMobileUserAgent;

  useEffect(() => {
    if (!token?.trim()) {
      setChecking(false);
      setHasSession(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled && session?.user) {
          setHasSession(true);
        } else if (!cancelled) {
          setHasSession(false);
        }
      } catch (err) {
        if (!cancelled) {
          logger.error('ReviewRouteGate getSession', err);
          setHasSession(false);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <LoadingDots size="lg" />
          <p className="text-sm text-gray-600">{t('publicReview.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  return <PublicContentReviewPage showBackToHome={hasSession && isMobile} />;
};
