"use client";
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Mail, Lock, LogIn } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const checkOnboarding = async (userId: string) => {
      const { data: apprenti } = await supabase.from('apprentis_details').select('profile_id').eq('profile_id', userId).single();
      if (apprenti) return true;
      
      const { data: patron } = await supabase.from('patrons_details').select('profile_id').eq('profile_id', userId).single();
      if (patron) return true;
      
      return false;
    };
    
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else {
        if (data.session) {
          window.location.href = '/onboarding';
        } else {
          alert("Inscription réussie. Vous pouvez maintenant vous connecter !");
          setIsSignUp(false);
        }
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else if (data.user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
        if (profile?.role === 'admin_cfa') {
          window.location.href = '/admin';
          return;
        }

        const hasOnboarded = await checkOnboarding(data.user.id);
        if (hasOnboarded) {
          window.location.href = '/swipe';
        } else {
          window.location.href = '/onboarding';
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-[#D4AF37] mb-2">PHORGE</h1>
          <p className="text-zinc-500">Trouvez votre salon ou votre apprenti idéal.</p>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-red-100 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-3 text-zinc-400" size={20} />
            <input 
              type="email" 
              placeholder="Email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-zinc-100 dark:bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" 
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-3 text-zinc-400" size={20} />
            <input 
              type="password" 
              placeholder="Mot de passe" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-zinc-100 dark:bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 mt-4 rounded-xl bg-[#D4AF37] text-white font-bold hover:bg-[#B8962E] transition-colors shadow-lg shadow-[#D4AF37]/20"
          >
            {loading ? 'Chargement...' : isSignUp ? "S'inscrire" : 'Se connecter'} <LogIn size={20} />
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-zinc-500 hover:text-[#D4AF37] transition-colors"
          >
            {isSignUp ? 'Déjà un compte ? Connectez-vous' : "Pas encore de compte ? S'inscrire"}
          </button>
        </div>
      </div>
    </div>
  );
}
