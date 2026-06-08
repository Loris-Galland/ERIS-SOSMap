/*
 * AuthScreen — full-screen sign-in and sign-up form for the ERIS app.
 * Manages email/password state locally and delegates authentication to the
 * Supabase JS client (signInWithPassword / signUp).
 * Accepts an optional onOpenSettings callback that reveals a settings button
 * in the top-right corner, used before a session exists.
 * Rendered by App.tsx when no active Supabase session is detected.
 */

import { useState } from 'react';
import { supabase } from '../../db/supabaseClient';
import { useTranslation } from 'react-i18next';

interface AuthScreenProps {
  onOpenSettings?: () => void;
}

export default function AuthScreen({ onOpenSettings }: AuthScreenProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert(t('auth.checkEmail', 'Check your email for the login link!'));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-eris-bg flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {onOpenSettings && (
        <button
          onClick={onOpenSettings}
          className="absolute top-6 right-6 w-12 h-12 bg-eris-surface/80 border border-eris-border rounded-full flex items-center justify-center text-eris-text-muted hover:text-eris-text hover:bg-eris-surface-alt transition-all active:scale-95 shadow-lg z-50 backdrop-blur-md"
          title={t('settings.title', 'Parameters')}
        >
          <span className="material-symbols-outlined text-2xl">settings</span>
        </button>
      )}

      {/* Decorative blurred background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-eris-primary/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-eris-danger/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-sm z-10 flex flex-col items-center">
        {/* Header / Logo Area */}
        <div className="mb-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="w-20 h-20 bg-eris-surface-alt/80 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl border border-eris-border/50 backdrop-blur-sm">
            <span className="material-symbols-outlined text-4xl text-eris-primary">shield_lock</span>
          </div>
          <h1 className="text-3xl font-black text-eris-text tracking-tight mb-2">ERIS</h1>
          <p className="text-eris-text-muted text-sm font-medium">{t('auth.systemDesc', 'Response & Info System')} </p>
        </div>

        {/* Auth Card */}
        <div className="w-full bg-eris-surface-alt/40 backdrop-blur-xl border border-eris-border/50 p-6 rounded-3xl shadow-2xl animate-in fade-in slide-in-from-bottom-6 duration-700">
          <h2 className="text-xl font-bold text-eris-text mb-1">{t('auth.title')}</h2>
          <p className="text-eris-text-subtle text-xs mb-6">{t('auth.subtitle')}</p>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-eris-text-muted uppercase tracking-widest ml-1">
                {t('auth.email')}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-eris-text-subtle text-lg">
                  mail
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-eris-surface/50 border border-eris-border text-eris-text rounded-2xl py-3 pl-12 pr-4 outline-none focus:border-eris-primary focus:ring-1 focus:ring-eris-primary transition-all text-sm"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-eris-text-muted uppercase tracking-widest ml-1">
                {t('auth.password')}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-eris-text-subtle text-lg">
                  lock
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-eris-surface/50 border border-eris-border text-eris-text rounded-2xl py-3 pl-12 pr-4 outline-none focus:border-eris-primary focus:ring-1 focus:ring-eris-primary transition-all text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-eris-primary hover:bg-eris-primary text-eris-text font-bold py-3.5 rounded-2xl mt-4 transition-all active:scale-[0.98] disabled:opacity-70 flex justify-center items-center shadow-lg shadow-eris-primary/20"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin">sync</span>
              ) : isSignUp ? (
                t('auth.createAccount')
              ) : (
                t('auth.signIn')
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-eris-text-muted hover:text-eris-text transition-colors"
            >
              {isSignUp ? t('auth.hasAccount') : t('auth.noAccount')}{' '}
              <span className="text-eris-primary font-bold">{isSignUp ? t('auth.signIn') : t('auth.signUp')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
