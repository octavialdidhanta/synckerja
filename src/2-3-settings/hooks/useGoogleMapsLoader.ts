import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';

interface GoogleMapsLoaderResult {
  isLoaded: boolean;
  error: string | null;
  reload: () => void;
}

const GOOGLE_SCRIPT_ID = 'google-maps-script';

const getExistingScript = () => {
  if (typeof document === 'undefined') return null;
  return document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
};

const removeExistingScript = () => {
  const existing = getExistingScript();
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
};

const fetchApiKey = async (): Promise<string | null> => {
  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (envKey && envKey.trim().length > 0) {
    return envKey;
  }

  try {
    const { data, error } = await supabase.functions.invoke<{ apiKey?: string; error?: string }>('google-maps-key');

    if (error) {
      console.warn('Google Maps key fetch failed:', error);
      return null;
    }

    if (data?.error) {
      console.warn('Google Maps key response error:', data.error);
      return null;
    }

    return data?.apiKey ?? null;
  } catch (error) {
    console.warn('Google Maps key fetch error:', error);
    return null;
  }
};

const loadScript = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  if (window.google && window.google.maps) return;

  const existing = getExistingScript();
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps script')));
    });
    return;
  }

  const apiKey = await fetchApiKey();
  if (!apiKey) {
    throw new Error('Google Maps API key is not configured.');
  }

  const script = document.createElement('script');
  script.id = GOOGLE_SCRIPT_ID;
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=id`;
  script.async = true;
  script.defer = true;

  await new Promise<void>((resolve, reject) => {
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });
};

export const useGoogleMapsLoader = (): GoogleMapsLoaderResult => {
  const [isLoaded, setIsLoaded] = useState<boolean>(
    typeof window !== 'undefined' && !!window.google?.maps
  );
  const [error, setError] = useState<string | null>(null);
  const isLoadingRef = useRef(false);

  const initialize = useCallback(async () => {
    if (isLoadingRef.current || isLoaded) return;

    isLoadingRef.current = true;
    setError(null);

    try {
      await loadScript();
      if (!(window as any).google?.maps) {
        throw new Error('Google Maps did not initialize correctly.');
      }
      setIsLoaded(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize Google Maps';
      setError(message);
      removeExistingScript();
      setIsLoaded(false);
    } finally {
      isLoadingRef.current = false;
    }
  }, [isLoaded]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.google && window.google.maps) {
      setIsLoaded(true);
      return;
    }

    initialize();
  }, [initialize]);

  const reload = useCallback(() => {
    setIsLoaded(false);
    setError(null);
    removeExistingScript();
    initialize();
  }, [initialize]);

  return {
    isLoaded,
    error,
    reload,
  };
};
