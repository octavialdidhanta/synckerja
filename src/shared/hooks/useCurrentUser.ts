
import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/shared/lib/supabaseClient';

// Add caching to prevent multiple fetches
let cachedUser: User | null = null;
let userPromise: Promise<User | null> | null = null;

export const useCurrentUser = () => {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);

  useEffect(() => {
    const getUser = async () => {
      // Return cached user if available
      if (cachedUser) {
        setUser(cachedUser);
        setLoading(false);
        return;
      }

      // Return existing promise if one is in flight
      if (userPromise) {
        const userData = await userPromise;
        setUser(userData);
        setLoading(false);
        return;
      }

      // Create new promise for fetching user
      userPromise = supabase.auth.getUser().then(({ data: { user } }) => {
        cachedUser = user;
        userPromise = null;
        return user;
      });

      const userData = await userPromise;
      setUser(userData);
      setLoading(false);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const newUser = session?.user || null;
        cachedUser = newUser;
        setUser(newUser);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
};
