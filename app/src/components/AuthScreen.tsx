import { useState } from 'react';
import { supabase } from '../db/supabaseClient';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle the authentication flow via Supabase
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isLogin) {
        // Sign in existing user
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        // Register new user
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0f141e] w-full items-center justify-center font-sans px-6">
      
      {/* --- HEADER LOGO --- */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center border border-blue-500/20 mb-6 shadow-lg shadow-blue-500/10">
          <span className="material-symbols-outlined text-blue-500 text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            satellite_alt
          </span>
        </div>
        <h1 className="text-white text-3xl font-black tracking-widest uppercase mb-1">ERIS</h1>
        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest opacity-60">Safety Network</p>
      </div>

      {/* --- AUTHENTICATION FORM --- */}
      <form onSubmit={handleAuth} className="w-full max-w-sm flex flex-col gap-4">
        
        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] p-3 rounded-2xl text-center font-bold">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-2">Email Address</label>
          <div className="flex items-center bg-gray-800/40 border border-gray-700/50 rounded-2xl px-4 py-3 focus-within:border-blue-500/50 transition-colors">
             <span className="material-symbols-outlined text-gray-500 mr-3">mail</span>
             <input 
               type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
               className="w-full bg-transparent text-white text-sm outline-none placeholder-gray-600"
               placeholder="name@email.com"
             />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-2">Password</label>
          <div className="flex items-center bg-gray-800/40 border border-gray-700/50 rounded-2xl px-4 py-3 focus-within:border-blue-500/50 transition-colors">
            <span className="material-symbols-outlined text-gray-500 mr-3">lock</span>
            <input 
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent text-white text-sm outline-none placeholder-gray-600"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button 
          disabled={isLoading}
          className="w-full bg-blue-600 text-white rounded-2xl py-4 text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 active:scale-95 transition-all disabled:opacity-50 mt-2"
        >
          {isLoading ? 'Processing...' : isLogin ? 'Secure Login' : 'Create Account'}
        </button>

        <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-2 hover:text-white transition-colors">
          {isLogin ? "Need an account? Sign Up" : "Have an account? Log In"}
        </button>
      </form>
    </div>
  );
}