"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { User, LogOut, FileText, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProfilPage() {
  const [profileData, setProfileData] = useState<any>(null);
  const [role, setRole] = useState<'apprenti'|'patron'|'admin_cfa'|null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchMyProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (!prof) return;
      
      setRole(prof.role);

      if (prof.role === 'apprenti') {
        const { data } = await supabase.from('apprentis_details').select('*').eq('profile_id', user.id).single();
        setProfileData(data);
      } else if (prof.role === 'patron') {
        const { data } = await supabase.from('patrons_details').select('*').eq('profile_id', user.id).single();
        setProfileData(data);
      } else if (prof.role === 'admin_cfa') {
        setProfileData({ prenom: 'Administrateur', nom: 'CFA', domaine: 'Supervision' });
      }
      setLoading(false);
    };
    fetchMyProfile();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-zinc-500">Chargement...</div>;

  return (
    <main className="p-6 pt-10 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-10 md:mb-6">
        <h1 className="text-3xl font-bold text-[#D4AF37]">Mon Profil</h1>
        <button onClick={handleLogout} className="md:hidden flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-900 rounded-full text-zinc-600 dark:text-zinc-400 font-medium text-sm hover:text-red-500 hover:bg-red-50">
          <LogOut size={16} /> Quitter
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-sm border border-zinc-200 dark:border-zinc-800 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#D4AF37]/20 to-transparent"></div>
        
        <div className="relative z-10">
          <div className="w-32 h-32 mx-auto bg-zinc-100 dark:bg-zinc-800 rounded-full border-4 border-white dark:border-zinc-900 shadow-xl mb-6 overflow-hidden flex items-center justify-center">
            {profileData?.photo_profil ? (
               <img src={profileData.photo_profil} className="w-full h-full object-cover" />
            ) : (
               <User size={64} className="text-zinc-300 dark:text-zinc-600" />
            )}
          </div>
          
          <h2 className="text-2xl font-black mb-1">
            {role === 'apprenti' || role === 'admin_cfa' ? `${profileData?.prenom} ${profileData?.nom}` : profileData?.nom_entreprise}
          </h2>
          <p className="text-[#D4AF37] font-semibold text-lg uppercase tracking-wider mb-8">{profileData?.domaine || role?.replace('_', ' ')}</p>

          <div className="text-left bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold flex items-center gap-2 mb-4 text-lg"><FileText size={20} className="text-[#D4AF37]" /> Informations</h3>
            
            {role === 'apprenti' && (
              <>
                <p className="flex flex-col sm:flex-row sm:gap-4"><span className="text-zinc-500 w-32 shrink-0">Stage</span> <strong className="break-words">{profileData?.stage_effectue || 'Non renseigné'}</strong></p>
                <p className="flex flex-col sm:flex-row sm:gap-4"><span className="text-zinc-500 w-32 shrink-0">Expérience</span> <strong className="break-words">{profileData?.experience_pro || 'Non renseignée'}</strong></p>
                <p className="flex flex-col sm:flex-row sm:gap-4"><span className="text-zinc-500 w-32 shrink-0">Diplôme visé</span> <strong className="break-words">{profileData?.diplome_souhaite || 'Non renseigné'}</strong></p>
                <p className="flex flex-col sm:flex-row sm:gap-4"><span className="text-zinc-500 w-32 shrink-0">Diplôme acquis</span> <strong className="break-words">{profileData?.diplome_acquis || 'Non renseigné'}</strong></p>
                <p className="flex flex-col sm:flex-row sm:gap-4"><span className="text-zinc-500 w-32 shrink-0">Distance Max</span> <strong className="break-words">{profileData?.distance_max} km</strong></p>
              </>
            )}
            {role === 'patron' && (
              <>
                <p className="flex flex-col sm:flex-row sm:gap-4"><span className="text-zinc-500 w-32 shrink-0">Adresse</span> <strong className="break-words">{profileData?.adresse || 'Non renseignée'}</strong></p>
              </>
            )}
            {role === 'admin_cfa' && (
              <p className="text-zinc-500 text-sm italic">Vous avez tous les droits sur la plateforme. Accédez à la Control Tower pour superviser les mises en relation.</p>
            )}
          </div>
          
          <Link href="/profil/edit" className="w-full mt-8 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2">
            <Settings size={20} /> Modifier mes informations
          </Link>
        </div>
      </div>
    </main>
  );
}
