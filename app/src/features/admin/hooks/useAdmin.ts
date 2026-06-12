/*
 * Hook that checks whether the currently authenticated user has admin privileges.
 * Queries the is_admin field in the user_profiles Supabase table on session change.
 * Consumed by the top-level app router to conditionally render the AdminScreen.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../../db/supabaseClient';

export function useAdmin(session: any) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) {
      setIsAdmin(false);
      setIsLoadingAdmin(false);
      return;
    }

    const fetchAdminStatus = async () => {
      setIsLoadingAdmin(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

      if (!error && data?.is_admin === true) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
      setIsLoadingAdmin(false);
    };

    fetchAdminStatus();
  }, [session?.user?.id]);

  return { isAdmin, isLoadingAdmin };
}