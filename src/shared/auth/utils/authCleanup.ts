/**
 * Comprehensive auth state cleanup utility
 * Prevents authentication limbo states and session conflicts
 */

import { supabase } from '@/shared/lib/supabaseClient';

const isDev = import.meta.env.DEV;
const shouldLog = isDev && Math.random() < 0.02; // Only log 2% in dev

export const cleanupAuthState = () => {
  if (shouldLog) console.log('🧹 Cleaning up auth state');
  
  // Remove all Supabase auth keys from localStorage
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      localStorage.removeItem(key);
    }
  });
  
  // Remove from sessionStorage if in use
  Object.keys(sessionStorage || {}).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      sessionStorage.removeItem(key);
    }
  });
  
  // Clear registration-related flags
  sessionStorage.removeItem('registrationInProgress');
  sessionStorage.removeItem('registrationFlow');
  sessionStorage.removeItem('fromRegistration');
  sessionStorage.removeItem('userEmail');
  sessionStorage.removeItem('userName');
  sessionStorage.removeItem('pendingUserId');
  sessionStorage.removeItem('emailError');
  localStorage.removeItem('pendingEmailVerification');
  localStorage.removeItem('hasSeenEmployeeWelcome');
};

export const performCleanSignOut = async () => {
  if (shouldLog) console.log('🚪 Performing clean sign out');
  
  try {
    // Clean up state first
    cleanupAuthState();
    
    // Attempt global sign out (fallback if it fails)
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (err) {
      console.warn('Global sign out failed, continuing with cleanup:', err);
    }
    
    // Force page reload for clean state
    window.location.href = '/login';
  } catch (error) {
    console.error('Sign out error:', error);
    // Force reload even if sign out fails
    window.location.href = '/login';
  }
};

export const performCleanSignIn = async (email: string, password: string) => {
  if (shouldLog) console.log('🔐 Performing clean sign in');
  
  try {
    // Clean up existing state
    cleanupAuthState();
    
    // Attempt global sign out first
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (err) {
      console.warn('Pre-signin cleanup failed, continuing:', err);
    }
    
    // Small delay to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Sign in with email/password
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    
    if (data.user) {
      if (shouldLog) console.log('✅ Sign in successful, reloading page');
      // Force page reload for clean state
      window.location.href = '/';
    }
    
    return { data, error };
  } catch (error) {
    console.error('Clean sign in error:', error);
    throw error;
  }
};

export const checkAndCleanupStaleAuth = async () => {
  if (shouldLog) console.log('🔍 Checking for stale auth state');
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.warn('Session check error, cleaning up:', error);
      cleanupAuthState();
      return null;
    }
    
    if (session) {
      // Verify the session is valid by making a simple API call with timeout
      try {
        // Add timeout protection to prevent hanging
        const userPromise = supabase.auth.getUser();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('User check timeout')), 3000)
        );
        
        const { error: userError } = await Promise.race([userPromise, timeoutPromise]) as any;
        
        // Check for specific errors that indicate invalid/stale auth state
        if (userError) {
          const errorMessage = userError.message;
          
          // Ignore timeout errors - session is probably valid
          if (errorMessage === 'User check timeout') {
            if (shouldLog) console.log('User check timeout (non-critical), assuming valid session');
            return session;
          }
          
          if (errorMessage.includes('JWT expired') || 
              errorMessage.includes('User from sub claim in JWT does not exist') ||
              errorMessage.includes('user_not_found')) {
            console.warn('Stale/invalid auth detected, cleaning up:', errorMessage);
            cleanupAuthState();
            return null;
          }
        }
      } catch (userCheckError: any) {
        // Ignore timeout errors - session is probably valid
        if (userCheckError?.message === 'User check timeout') {
          if (shouldLog) console.log('User check timeout (non-critical), assuming valid session');
          return session;
        }
        
        console.warn('User check failed, cleaning up:', userCheckError);
        
        // Also check if it's a 403 error (user not found)
        if (userCheckError?.status === 403 || 
            userCheckError?.message?.includes('User from sub claim in JWT does not exist')) {
          console.warn('403 or user not found error detected, forcing cleanup');
          cleanupAuthState();
          return null;
        }
        
        cleanupAuthState();
        return null;
      }
    }
    
    return session;
  } catch (error) {
    console.error('Auth state check error:', error);
    cleanupAuthState();
    return null;
  }
};

/** Reason for redirect so login page can show a message */
export type AuthResetReason = 'session_expired' | 'stale' | undefined;

export const forceAuthReset = async (reason?: AuthResetReason) => {
  console.log('🔄 Forcing complete auth reset', reason ? `(${reason})` : '');
  
  try {
    cleanupAuthState();
    
    try {
      await Promise.allSettled([
        supabase.auth.signOut({ scope: 'global' }),
        supabase.auth.signOut({ scope: 'local' }),
        supabase.auth.signOut()
      ]);
    } catch (signOutError) {
      console.warn('Force sign out error (continuing):', signOutError);
    }
    
    try {
      localStorage.clear();
      sessionStorage.clear();
      
      if ('indexedDB' in window) {
        const databases = await indexedDB.databases();
        for (const db of databases) {
          if (db.name?.includes('supabase') || db.name?.includes('sb-')) {
            indexedDB.deleteDatabase(db.name);
          }
        }
      }
      
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          registration.unregister();
        }
      }
    } catch (cleanupError) {
      console.warn('Additional cleanup error:', cleanupError);
    }
    
    const loginUrl = reason === 'session_expired' ? '/login?reason=session_expired' : '/login';
    const isAlreadyOnLogin = typeof window !== 'undefined' && (
      window.location.pathname === '/login' || window.location.pathname === '/login/'
    );
    if (!isAlreadyOnLogin) {
      setTimeout(() => {
        window.location.href = loginUrl;
      }, 100);
    }
    
  } catch (error) {
    console.error('Force auth reset error:', error);
    const isAlreadyOnLogin = typeof window !== 'undefined' && (
      window.location.pathname === '/login' || window.location.pathname === '/login/'
    );
    if (!isAlreadyOnLogin) {
      window.location.href = reason === 'session_expired' ? '/login?reason=session_expired' : '/login';
    }
  }
};

export const waitForAuthStabilization = (timeout = 5000): Promise<boolean> => {
  return new Promise((resolve) => {
    let authStateChanges = 0;
    let lastState: any = null;
    let stabilizationTimer: NodeJS.Timeout;
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      authStateChanges++;
      lastState = { event, session };
      
      // Clear existing timer
      if (stabilizationTimer) {
        clearTimeout(stabilizationTimer);
      }
      
      // Set new timer
      stabilizationTimer = setTimeout(() => {
        subscription.unsubscribe();
        console.log(`🎯 Auth stabilized after ${authStateChanges} changes`);
        resolve(true);
      }, 1000); // Wait 1 second after last change
    });
    
    // Timeout fallback
    setTimeout(() => {
      subscription.unsubscribe();
      if (stabilizationTimer) {
        clearTimeout(stabilizationTimer);
      }
      console.log('⏰ Auth stabilization timeout reached');
      resolve(false);
    }, timeout);
  });
};