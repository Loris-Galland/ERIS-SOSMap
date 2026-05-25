/*
 * Hook that loads and manages the full user list for the admin User Management screen.
 * Fetches user profiles from the user_profiles Supabase table and exposes toggleAdminRole,
 * which flips is_admin with an optimistic update and rolls back on RLS-blocked failures.
 * Consumed by UserManagementScreen and exports the AdminUser type.
 */

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

  // Fetch all users from the database
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

  const toggleAdminRole = async (userId: string, currentIsAdmin: boolean) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_admin: !currentIsAdmin } : u))
    );

    const { data, error } = await supabase
      .from('user_profiles')
      .update({ is_admin: !currentIsAdmin })
      .eq('id', userId)
      .select();

    if (error || !data || data.length === 0) {
      console.error("Failed to update admin role. Might be blocked by RLS policies.", error);

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_admin: currentIsAdmin } : u))
      );
      
      alert("Failed to update role. Please check Supabase RLS policies.");
      return false;
    }

    return true;
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return { users, loading, error, toggleAdminRole, refetch: fetchUsers };
}