import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Sets the Android status bar icon style based on header theme.
 * - headerTheme 'light' = light header background → dark icons (Style.Light on Android = dark icons)
 * - headerTheme 'dark' = dark header background → light icons (Style.Dark on Android = light icons)
 * No-op on web; only runs when Capacitor.isNativePlatform().
 */
export function useStatusBarStyle(headerTheme: 'light' | 'dark') {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const style = headerTheme === 'dark' ? Style.Dark : Style.Light;
    StatusBar.setStyle({ style }).catch(() => {
      // Ignore if plugin not available or fails (e.g. on unsupported platform)
    });
  }, [headerTheme]);
}
