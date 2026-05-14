import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../db/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

import AuthScreen from './AuthScreen';
import { supabase } from '../../db/supabaseClient';

const mockSignIn = vi.mocked(supabase.auth.signInWithPassword);
const mockSignUp = vi.mocked(supabase.auth.signUp);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('alert', vi.fn());
});

// ─── Rendering ───

describe('AuthScreen — rendering', () => {
  it('displays the email and password inputs', () => {
    render(<AuthScreen />);
    expect(screen.getByPlaceholderText('name@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  it('displays the sign-in button by default', () => {
    render(<AuthScreen />);
    expect(screen.getByRole('button', { name: 'auth.signIn' })).toBeInTheDocument();
  });

  it('does not display the settings button when onOpenSettings is not provided', () => {
    render(<AuthScreen />);
    expect(screen.queryByTitle('Paramètres')).not.toBeInTheDocument();
  });

  it('displays the settings button when onOpenSettings is provided', () => {
    render(<AuthScreen onOpenSettings={vi.fn()} />);
    expect(screen.getByTitle('Paramètres')).toBeInTheDocument();
  });
});

// ─── Sign in ───

describe('AuthScreen — sign in', () => {
  it('calls signInWithPassword with the correct credentials', async () => {
    mockSignIn.mockResolvedValue({ data: {} as any, error: null });
    render(<AuthScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('name@example.com'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123');
    await user.click(screen.getByRole('button', { name: 'auth.signIn' }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('shows an alert when authentication fails', async () => {
    mockSignIn.mockResolvedValue({ data: {} as any, error: { message: 'Invalid credentials' } as any });
    render(<AuthScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('name@example.com'), 'bad@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: 'auth.signIn' }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Invalid credentials');
    });
  });
});

// ─── Sign up ───

describe('AuthScreen — sign up', () => {
  it('switches to sign-up mode when the toggle link is clicked', async () => {
    render(<AuthScreen />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /auth\.noAccount/i }));

    expect(screen.getByRole('button', { name: 'auth.createAccount' })).toBeInTheDocument();
  });

  it('calls signUp with the correct credentials', async () => {
    mockSignUp.mockResolvedValue({ data: {} as any, error: null });
    render(<AuthScreen />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /auth\.noAccount/i }));
    await user.type(screen.getByPlaceholderText('name@example.com'), 'new@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'newpassword');
    await user.click(screen.getByRole('button', { name: 'auth.createAccount' }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'newpassword',
      });
    });
  });
});

// ─── Settings button ───

describe('AuthScreen — settings button', () => {
  it('calls onOpenSettings when the button is clicked', async () => {
    const onOpenSettings = vi.fn();
    render(<AuthScreen onOpenSettings={onOpenSettings} />);
    const user = userEvent.setup();

    await user.click(screen.getByTitle('Paramètres'));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });
});
