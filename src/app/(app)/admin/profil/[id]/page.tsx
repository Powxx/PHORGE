"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ArrowLeft, User, Heart, X, Star } from 'lucide-react';
import Link from 'next/link';

export default function AdminProfilPage({ params, searchParams }: any) {
  // Use React.use to unwrap promises in Next 15 if needed
  const resolvedParams = React.use(params);
  const resolvedSearchParams = React.use(searchParams);
  const profileId = resolvedParams.id;
  const role = resolvedSearchParams.role;

  const [details, setDetails] = useState<any>(null);
  const [swipesDonnes, setSwipesDonnes] = useState<any[]>([]);
  const [swipesRecus, setSwipesRecus] = useState<any[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      // 1. Fetch details
      const table = role === 'patron' ? 'patrons_details' : 'apprentis_details';
      const { data: detailData } = await supabase.from(table).select('*').eq('profile_id', profileId).single();
      if (detailData) setDetails(detailData);

      // 2. Fetch swipes donnés (où de_profile_id = profileId)
      const { data: donn } = await supabase.from('swipes').select('*').eq('de_profile_id', profileId);
      if (donn) setSwipesDonnes(donn);

      // 3. Fetch swipes reçus (où vers_profile_id = profileId)
      const { data: rec } = await supabase.from('swipes').select('*').eq('vers_profile_id', profileId);
      if (rec) setSwipesRecus(rec);

      // 4. Build name map
      const allSwipeIds = [...(donn || []).map(s => s.vers_profile_id), ...(rec || []).map(s => s.de_profile_id)];
      const uniqueIds = Array.from(new Set(allSwipeIds));
      
      if (uniqueIds.length > 0) {
        const { data: allApp } = await supabase.from('apprentis_details').select('profile_id, prenom, nom').in('profile_id', uniqueIds);
        const { data: allPat } = await supabase.from('patrons_details').select('profile_id, nom_entreprise').in('profile_id', uniqueIds);
        
        const map: Record<string, string> = {};
        allApp?.forEach(a => map[a.profile_id] = `${a.prenom} ${a.nom}`);
        allPat?.forEach(p => map[p.profile_id] = p.nom_entreprise);
        setNameMap(map);
      }

      setLoading(false);
    };
    fetchProfile();
  }, [profileId, role]);

  const renderSwipeIcon = (type: string) => {
    if (type === 'like') return <Heart size={16} className="text-green-500" />;
    if (type === 'dislike') return <X size={16} className="text-red-500" />;
    if (type === 'superlike') return <Star size={16} className="text-blue-500" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/admin" className="inline-flex items-center gap-2 text-zinc-500 hover:text-[#D4AF37] mb-6 font-medium">
          <ArrowLeft size={20} /> Retour au tableau de bord
        </Link>
        
        {loading ? (
          <p className="text-zinc-500 text-center py-10">Chargement du profil...</p>
        ) : !details ? (
          <p className="text-zinc-500 text-center py-10">Profil introuvable.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1 space-y-6">
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 text-center">
                <div className="w-24 h-24 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden">
                  {details.photo_profil ? <img src={details.photo_profil} className="w-full h-full object-cover" /> : <User size={40} className="text-zinc-400" />}
                </div>
                <h1 className="text-xl font-bold">
                  {role === 'patron' ? details.nom_entreprise : `${details.prenom} ${details.nom}`}
                </h1>
                <p className="text-[#D4AF37] font-medium capitalize mt-1">{details.domaine}</p>
                <div className="mt-6 text-left text-sm space-y-3 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <p className="text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 pb-2">Distance max : {details.distance_max || '?'} km</p>
                  {role === 'apprenti' && (
                    <>
                      <p><strong className="text-zinc-900 dark:text-zinc-100">Âge :</strong> {details.age || '-'} ans</p>
                      <p><strong className="text-zinc-900 dark:text-zinc-100">Diplôme visé :</strong> {details.diplome_souhaite || '-'}</p>
                      <p><strong className="text-zinc-900 dark:text-zinc-100">Diplôme acquis :</strong> {details.diplome_acquis || '-'}</p>
                      <p><strong className="text-zinc-900 dark:text-zinc-100">Transport :</strong> {details.moyen_transport || '-'}</p>
                      <p><strong className="text-zinc-900 dark:text-zinc-100">Stage :</strong> {details.stage_effectue || '-'}</p>
                      <p><strong className="text-zinc-900 dark:text-zinc-100">Exp. Apprentissage :</strong> {details.experience_apprentissage || '-'}</p>
                      <p><strong className="text-zinc-900 dark:text-zinc-100">Autre Exp. :</strong> {details.autre_experience || '-'}</p>
                      <p><strong className="text-zinc-900 dark:text-zinc-100">Motivation :</strong> {details.motivation || '-'}</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="md:col-span-2 space-y-6">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                  <h2 className="font-bold text-[#D4AF37]">Historique des Swipes Donnés ({swipesDonnes.length})</h2>
                </div>
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800 max-h-60 overflow-y-auto">
                  {swipesDonnes.map(s => (
                    <div key={s.id} className="p-3 text-sm flex items-center justify-between">
                      <span className="text-zinc-600 dark:text-zinc-400 font-bold">{nameMap[s.vers_profile_id] || s.vers_profile_id.slice(0, 8)}</span>
                      <span className="flex items-center gap-2 font-medium capitalize bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">{renderSwipeIcon(s.type)} {s.type}</span>
                    </div>
                  ))}
                  {swipesDonnes.length === 0 && <p className="p-4 text-sm text-zinc-500">Aucun swipe donné.</p>}
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                  <h2 className="font-bold text-[#D4AF37]">Historique des Swipes Reçus ({swipesRecus.length})</h2>
                </div>
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800 max-h-60 overflow-y-auto">
                  {swipesRecus.map(s => (
                    <div key={s.id} className="p-3 text-sm flex items-center justify-between">
                      <span className="text-zinc-600 dark:text-zinc-400 font-bold">{nameMap[s.de_profile_id] || s.de_profile_id.slice(0, 8)}</span>
                      <span className="flex items-center gap-2 font-medium capitalize bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">{renderSwipeIcon(s.type)} {s.type}</span>
                    </div>
                  ))}
                  {swipesRecus.length === 0 && <p className="p-4 text-sm text-zinc-500">Aucun swipe reçu.</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
