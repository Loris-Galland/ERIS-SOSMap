// Fetches all registered users and handles admin role promotion/revocation

import { useState, useEffect } from 'react';
import { supabase } from '../../../db/supabaseClient';

export interface AdminUser {
  id: string;
  first_name: string;
  last_name: string;
  blood_type: string;
  created_at: string;
  is_admin: boolean;
}

export function useUserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, blood_type, created_at, is_admin')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setUsers(data as AdminUser[]);
    }
    setLoading(false);
  };

  // Toggle admin role for a given user
  const toggleAdminRole = async (userId: string, currentIsAdmin: boolean) => {
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_admin: !currentIsAdmin })
      .eq('id', userId);

    if (!error) {
      // Optimistic update
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_admin: !currentIsAdmin } : u))
      );
    }
    return !error;
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return { users, loading, error, toggleAdminRole, refetch: fetchUsers };
}