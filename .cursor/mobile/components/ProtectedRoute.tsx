
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  const cleanupAuthState = async () => {
    try {
      // Remove all auth-related keys from localStorage
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });
      
      // Also clear sessionStorage if it exists
      if (typeof sessionStorage !== 'undefined') {
        Object.keys(sessionStorage).forEach((key) => {
          if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
            sessionStorage.removeItem(key);
          }
        });
      }
      
      // Attempt to sign out any existing session
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (error) {
        // Ignore sign out errors as we're cleaning up
        console.log('Cleanup sign out:', error);
      }
    } catch (error) {
      console.error('Error cleaning up auth state:', error);
    }
  };

  useEffect(() => {
    let isUnmounted = false;
    
  const checkAuth = async () => {
      try {
        console.log("ProtectedRoute: Checking authentication...");
        
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log("ProtectedRoute: Session check result:", !!session?.user, error);
        
        if (isUnmounted) return;
        
        if (!session?.user || error) {
          console.log("ProtectedRoute: No session, redirecting to login");
          navigate("/login");
          setIsLoading(false);
          return;
        }

        // Check email verification and organization status
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('active_organization_id, organization_created')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (isUnmounted) return;

          // Check if user is verified
          const { data: verificationData } = await supabase
            .from('email_verification_tokens')
            .select('used_at')
            .eq('user_id', session.user.id)
            .not('used_at', 'is', null)
            .maybeSingle();

          if (!verificationData) {
            console.log("ProtectedRoute: User not verified, signing out");
            await supabase.auth.signOut();
            navigate("/login");
            setIsLoading(false);
            return;
          }

          // Get current path
          const currentPath = window.location.pathname;
          
          // Check if user needs to create organization
          if (!profileData?.active_organization_id && currentPath !== "/create-organization") {
            console.log("ProtectedRoute: No active organization, checking if user has created one before");
            
            // Check if user has ever created an organization before
            const { data: organizationData, error: orgError } = await supabase
              .from('organizations')
              .select('id')
              .eq('user_id', session.user.id)
              .maybeSingle();
            
            console.log("ProtectedRoute: Organization check result:", organizationData, "Error:", orgError);
            
            if (!organizationData && !orgError) {
              console.log("ProtectedRoute: User needs to create organization");
              navigate("/create-organization");
              setIsLoading(false);
              return;
            } else {
              console.log("ProtectedRoute: User has created organization before, allowing access");
            }
          }
          
          // Check if user has created org but hasn't gone through welcome
          if (profileData?.active_organization_id && 
              profileData?.organization_created && 
              currentPath !== "/employee-welcome" && 
              currentPath !== "/create-organization") {
            
            // Check if user has already been through welcome by checking location state
            const hasCompletedWelcome = sessionStorage.getItem('welcomeCompleted');
            
            if (!hasCompletedWelcome) {
              console.log("ProtectedRoute: User needs to complete welcome flow");
              navigate("/employee-welcome", { 
                state: { fromCreateOrganization: true },
                replace: true 
              });
              setIsLoading(false);
              return;
            }
          }

        } catch (profileError) {
          console.error("ProtectedRoute: Profile check error:", profileError);
          // If profile check fails, still allow access but log the error
        }

        console.log("ProtectedRoute: User authenticated and verified");
        if (!isUnmounted) {
          setIsAuthenticated(true);
        }
        
      } catch (error) {
        console.error("ProtectedRoute: Auth check error:", error);
        if (!isUnmounted) {
          navigate("/login");
        }
      } finally {
        if (!isUnmounted) {
          console.log("ProtectedRoute: Auth check complete");
          setIsLoading(false);
        }
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("ProtectedRoute: Auth state changed:", event, !!session?.user);
      
      if (isUnmounted) return;
      
      if (event === 'SIGNED_OUT' || !session?.user) {
        setIsAuthenticated(false);
        navigate("/login");
      } else if (event === 'SIGNED_IN' && session?.user) {
        // Small delay to ensure session is properly established
        setTimeout(async () => {
          if (isUnmounted) return;
          
          try {
            // Check email verification for signed in users
            const { data: verificationData } = await supabase
              .from('email_verification_tokens')
              .select('used_at')
              .eq('user_id', session.user.id)
              .not('used_at', 'is', null)
              .maybeSingle();

            if (isUnmounted) return;

            if (!verificationData) {
              await supabase.auth.signOut();
              setIsAuthenticated(false);
              navigate("/login");
            } else {
              setIsAuthenticated(true);
            }
          } catch (error) {
            console.error("ProtectedRoute: Verification check error:", error);
            // On error, still allow access but log the issue
            if (!isUnmounted) {
              setIsAuthenticated(true);
            }
          }
        }, 100);
      }
    });

    return () => {
      isUnmounted = true;
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : null;
};

export default ProtectedRoute;
