import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../db/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { useAdmin } from './useAdmin';
import { supabase } from '../../../db/supabaseClient';

const mockFrom = vi.mocked(supabase.from);

const buildSelectChain = (data: any, error: any = null) =>
  ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  } as any);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── No session ───

describe('useAdmin — no session', () => {
  it('returns isAdmin=false and stops loading when session is null', async () => {
    const { result } = renderHook(() => useAdmin(null));

    await waitFor(() => expect(result.current.isLoadingAdmin).toBe(false));
    expect(result.current.isAdmin).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns isAdmin=false when session has no user', async () => {
    const { result } = renderHook(() => useAdmin({}));

    await waitFor(() => expect(result.current.isLoadingAdmin).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });
});

// ─── Admin status fetching ───

describe('useAdmin — admin status fetching', () => {
  const session = { user: { id: 'user-admin-1' } };

  it('sets isAdmin=true when Supabase returns is_admin: true', async () => {
    mockFrom.mockReturnValue(buildSelectChain({ is_admin: true }));

    const { result } = renderHook(() => useAdmin(session));

    await waitFor(() => expect(result.current.isLoadingAdmin).toBe(false));
    expect(result.current.isAdmin).toBe(true);
  });

  it('sets isAdmin=false when Supabase returns is_admin: false', async () => {
    mockFrom.mockReturnValue(buildSelectChain({ is_admin: false }));

    const { result } = renderHook(() => useAdmin(session));

    await waitFor(() => expect(result.current.isLoadingAdmin).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });

  it('sets isAdmin=false when Supabase returns an error', async () => {
    mockFrom.mockReturnValue(buildSelectChain(null, new Error('DB error')));

    const { result } = renderHook(() => useAdmin(session));

    await waitFor(() => expect(result.current.isLoadingAdmin).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });

  it('queries the user_profiles table with the correct user ID', async () => {
    mockFrom.mockReturnValue(buildSelectChain({ is_admin: true }));

    renderHook(() => useAdmin(session));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('user_profiles');
    });
  });
});
