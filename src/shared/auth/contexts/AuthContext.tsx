import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/shared/lib/supabaseClient';
import { forceAuthReset } from '@/shared/auth/utils/authCleanup';
import { retryableAuthOperation } from '@/shared/lib/supabaseRetry';
import { resetIdentityQueriesForAuthUser } from '@/shared/auth/identityQuerySync';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Snapshot user id for onAuthStateChange (callback sees fresh value). */
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  // Debounce auth state changes to prevent excessive logging
  const lastAuthEventRef = useRef<string>('');
  const authDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener with debounced logging
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        // Handle token refresh errors
        if (event === 'TOKEN_REFRESHED' && !session) {
          console.warn('AuthContext: Token refresh failed - no session returned, forcing reset');
          forceAuthReset();
          return;
        }

        // When Supabase emits SIGNED_OUT during Meta OAuth popup (e.g. token refresh failed in background), restore session
        if (event === 'SIGNED_OUT') {
          const popupOpenRaw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('metaOAuthPopupOpen') : null;
          const savedRaw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('metaOAuthPopupSession') : null;
          const popupOpenAt = popupOpenRaw ? parseInt(popupOpenRaw, 10) : 0;
          const isRecent = Number.isFinite(popupOpenAt) && (Date.now() - popupOpenAt < 120000);
          if (isRecent && savedRaw) {
            try {
              const saved = JSON.parse(savedRaw) as { access_token?: string; refresh_token?: string };
              if (saved?.access_token && saved?.refresh_token) {
                await supabase.auth.setSession({
                  access_token: saved.access_token,
                  refresh_token: saved.refresh_token,
                });
                if (mounted) {
                  if (import.meta.env.DEV) {
                    console.log('AuthContext: Restored session after SIGNED_OUT during Meta OAuth popup');
                  }
                  return; // don't clear keys here; postMessage handler clears them when OAuth completes
                }
              }
            } catch (_) {}
          }
        }

        // Debounce auth logging to prevent spam
        const eventKey = `${event}-${session?.user?.id || 'null'}`;
        if (lastAuthEventRef.current !== eventKey) {
          lastAuthEventRef.current = eventKey;
          // Clear existing timeout
          if (authDebounceRef.current) {
            clearTimeout(authDebounceRef.current);
          }
          
          // Only log important auth events in development (10% sample rate)
          if (process.env.NODE_ENV === 'development' && 
              Math.random() < 0.1 &&
              (event === 'SIGNED_OUT' || event === 'USER_UPDATED')) {
            authDebounceRef.current = setTimeout(() => {
              const authUserId = session?.user?.id ?? 'no-user';
              console.log('AuthContext: Auth state change:', event, authUserId);
            }, 500);
          }
        }

        // TOKEN_REFRESHED (sering saat kembali dari app lain): JWT baru sudah di client Supabase.
        // Hanya sync `session` ke React agar Bearer dari context tetap valid; jangan setUser lagi
        // jika id sama — menghindari re-render massal / efek samping yang terasa seperti refresh halaman.
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          const prevId = userRef.current?.id;
          if (prevId && prevId === session.user.id) {
            setSession(session);
            setError(null);
            return;
          }
        }

        const previousUserId = userRef.current?.id;
        const nextUserId = session?.user?.id;

        if (event === 'SIGNED_OUT') {
          resetIdentityQueriesForAuthUser(queryClient, previousUserId);
        } else if (
          event === 'SIGNED_IN' &&
          previousUserId &&
          nextUserId &&
          previousUserId !== nextUserId
        ) {
          resetIdentityQueriesForAuthUser(queryClient, previousUserId);
        }

        // Update state synchronously
        setSession(session);
        setUser(session?.user ?? null);
        setError(null);
        
        // Set loading to false after state update
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          setLoading(false);
        }
      }
    );

    // Set up global error handler for unhandled auth errors
    // This catches errors from Supabase's internal token refresh mechanism
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      const isAuthError = error?.message?.includes('Invalid Refresh Token') ||
                         error?.message?.includes('Refresh Token Not Found') ||
                         (error?.name === 'AuthApiError' && 
                          (error?.message?.includes('refresh_token') || 
                           error?.status === 400));
      if (isAuthError) {
        console.warn('AuthContext: Unhandled refresh token error detected, cleaning up');
        event.preventDefault(); // Prevent console error spam
        if (mounted) {
          forceAuthReset();
        }
      }
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // CRITICAL: Handle 403 session_not_found errors from Supabase client
    // This event is dispatched when the server returns 403 with session_not_found code
    const handleSessionExpired = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { code, status } = customEvent.detail || {};
      if (status === 403 && code === 'session_not_found') {
        console.warn('⚠️ AuthContext: Session expired (403), forcing logout');
        if (mounted) {
          forceAuthReset();
        }
      }
    };

    // CRITICAL: Handle 504 Gateway Timeout from auth service
    // This event is dispatched when auth service is overloaded (36+ second response)
    const handleAuthTimeout = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { status } = customEvent.detail || {};
      // Don't redirect if already on login page (avoid overwriting URL with ?reason=session_expired)
      const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
      if (pathname === '/login' || pathname === '/login/') {
        if (import.meta.env.DEV) {
          console.log(`AuthContext: Ignoring auth error (${status}) - already on login page`);
        }
        return;
      }
      
      // Don't redirect if user just logged in (< 60 seconds ago) - prevent immediate redirect after login
      const justLoggedIn = sessionStorage.getItem('justLoggedIn');
      if (justLoggedIn) {
        const loginTime = parseInt(justLoggedIn, 10);
        const timeSinceLogin = Date.now() - loginTime;
        if (timeSinceLogin < 60000) {
          if (import.meta.env.DEV) {
            console.log(`AuthContext: Ignoring auth error (${status}) - user just logged in ${Math.round(timeSinceLogin / 1000)}s ago`);
          }
          return; // Don't redirect - user just logged in successfully
        }
        sessionStorage.removeItem('justLoggedIn');
      }
      
      if (status === 408 || status === 500 || status === 502 || status === 504 || status === 522) {
        if (import.meta.env.DEV) {
          console.warn('AuthContext: Auth error (408/500/502/504/522), forcing logout and redirect with message');
        }
        if (mounted) {
          forceAuthReset('session_expired');
        }
      }
    };
    
    window.addEventListener('supabase-session-expired', handleSessionExpired);
    window.addEventListener('supabase-auth-timeout', handleAuthTimeout);

    // Get initial session with stale auth detection
    const getInitialSession = async () => {
      try {
        // Add timeout to prevent hanging, with retry for network failures
        const getSessionWithRetry = () => retryableAuthOperation(
          () => supabase.auth.getSession(),
          { maxRetries: 1, initialDelay: 300 }
        );
        
        const sessionPromise = getSessionWithRetry();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session check timeout')), 5000)
        );
        
        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]) as any;
        
        if (!mounted) return;
        
        if (error) {
          // Check for network/connection errors - handle silently
          const isNetworkError = error.message?.includes('Failed to fetch') ||
                                error.message?.includes('ERR_CONNECTION_CLOSED') ||
                                error.name === 'AuthRetryableFetchError' ||
                                error.message?.includes('network') ||
                                error.message?.includes('timeout');
          
          if (isNetworkError) {
            // Network errors are handled gracefully - no need to log or set error
            // Assume no session on network failure
            if (mounted) {
              setSession(null);
              setUser(null);
              setLoading(false);
            }
            return;
          }
          
          // Only log non-network errors
          if (!isNetworkError) {
            console.error('Error getting session:', error);
          }
          
          // Check for stale auth / refresh token errors (500 from server: "error finding refresh token: context canceled")
          const msg = (error.message || '').toLowerCase();
          if (error.message?.includes('JWT expired') ||
              error.message?.includes('User from sub claim in JWT does not exist') ||
              error.message?.includes('Invalid Refresh Token') ||
              error.message?.includes('Refresh Token Not Found') ||
              msg.includes('refresh token') ||
              msg.includes('context canceled')) {
            console.warn('AuthContext: Stale/refresh token error, forcing reset');
            setSession(null);
            setUser(null);
            setLoading(false);
            forceAuthReset('session_expired');
            return;
          }
          
          // Only set error for non-network issues
          if (!isNetworkError) {
            setError(error.message);
          }
        } else {
          // If we have a session, verify it's valid with timeout and retry
          if (session?.user) {
            try {
              const getUserWithRetry = () => retryableAuthOperation(
                () => supabase.auth.getUser(),
                { maxRetries: 1, initialDelay: 300 }
              );
              
              const userPromise = getUserWithRetry();
              const userTimeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('User check timeout')), 3000)
              );
              
              const { error: userError } = await Promise.race([userPromise, userTimeoutPromise]) as any;
              
              if (userError) {
                // Check for network errors first
                const isNetworkError = userError.message?.includes('Failed to fetch') ||
                                      userError.message?.includes('ERR_CONNECTION_CLOSED') ||
                                      userError.name === 'AuthRetryableFetchError' ||
                                      userError.message?.includes('network') ||
                                      userError.message === 'User check timeout';
                
                if (isNetworkError) {
                  // Network timeout - assume session is valid since we already have it
                  setSession(session);
                  setUser(session?.user ?? null);
                  return;
                }
                
                const uMsg = (userError.message || '').toLowerCase();
                if (userError.message?.includes('User from sub claim in JWT does not exist') ||
                    userError.message?.includes('user_not_found') ||
                    userError.message?.includes('Invalid Refresh Token') ||
                    userError.message?.includes('Refresh Token Not Found') ||
                    uMsg.includes('refresh token') ||
                    uMsg.includes('context canceled')) {
                  console.warn('AuthContext: Invalid user or refresh token error, forcing reset');
                  forceAuthReset('session_expired');
                  return;
                }
              }
            } catch (userCheckError: any) {
              // Check for network/timeout errors first
              const isNetworkError = userCheckError?.message?.includes('Failed to fetch') ||
                                    userCheckError?.message?.includes('ERR_CONNECTION_CLOSED') ||
                                    userCheckError?.name === 'AuthRetryableFetchError' ||
                                    userCheckError?.message?.includes('network') ||
                                    userCheckError?.message === 'User check timeout';
              
              // Ignore network/timeout errors - session is probably valid
              if (isNetworkError) {
                setSession(session);
                setUser(session?.user ?? null);
                return;
              }
              
              // Only log non-network errors
              if (!isNetworkError) {
                console.warn('AuthContext: User verification failed:', userCheckError);
              }
              
              const cMsg = (userCheckError?.message || '').toLowerCase();
              if (userCheckError?.status === 403 ||
                  userCheckError?.message?.includes('User from sub claim in JWT does not exist') ||
                  userCheckError?.message?.includes('Invalid Refresh Token') ||
                  userCheckError?.message?.includes('Refresh Token Not Found') ||
                  cMsg.includes('refresh token') ||
                  cMsg.includes('context canceled')) {
                console.warn('AuthContext: 403 or refresh token error, forcing reset');
                forceAuthReset('session_expired');
                return;
              }
            }
          }
          
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (err: any) {
        // Check for network/connection errors or timeouts - handle silently
        const isNetworkError = err?.message?.includes('Failed to fetch') ||
                              err?.message?.includes('ERR_CONNECTION_CLOSED') ||
                              err?.name === 'AuthRetryableFetchError' ||
                              err?.message?.includes('network') ||
                              err?.message === 'Session check timeout' ||
                              err?.message === 'User check timeout';
        
        // Ignore timeout and network errors - assume no session
        if (isNetworkError) {
          // Silently handle network failures - no logging needed
          if (mounted) {
            setSession(null);
            setUser(null);
            setLoading(false);
          }
          return;
        }
        
        // Only log non-network errors
        if (!isNetworkError) {
          console.error('Session check error:', err);
        }
        
        const eMsg = (err?.message || '').toLowerCase();
        if (err?.message?.includes('User from sub claim in JWT does not exist') ||
            err?.status === 403 ||
            err?.message?.includes('Invalid Refresh Token') ||
            err?.message?.includes('Refresh Token Not Found') ||
            eMsg.includes('refresh token') ||
            eMsg.includes('context canceled')) {
          console.warn('AuthContext: Auth error in session check, forcing reset');
          forceAuthReset('session_expired');
          return;
        }
        
        // Only set error for non-network issues
        if (!isNetworkError && mounted) {
          setError('Failed to check authentication status');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('supabase-session-expired', handleSessionExpired);
      window.removeEventListener('supabase-auth-timeout', handleAuthTimeout);
    };
  }, []);

  const signOut = async () => {
    try {
      setLoading(true);
      // Clear subscription status cache so re-login always fetches fresh expiry (prevents
      // expired org from reusing stale "active" cache after logout+login without reload)
      queryClient.removeQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === 'subscriptionStatus',
      });
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Clear local storage items
      localStorage.removeItem('hasSeenEmployeeWelcome');
      sessionStorage.removeItem('registrationInProgress');

    } catch (error) {
      console.error('Error signing out:', error);
      setError(error instanceof Error ? error.message : 'Error signing out');
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    error,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
