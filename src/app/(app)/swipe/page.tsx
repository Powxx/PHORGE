"use client";
import { useEffect, useState } from 'react';
import SwipeDeck, { ProfileCard } from '@/components/SwipeDeck';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock } from 'lucide-react';

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = deg2rad(lat2-lat1);
  const dLon = deg2rad(lon2-lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; 
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI/180);
}

export default function SwipePage() {
  const [profiles, setProfiles] = useState<ProfileCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [isApproved, setIsApproved] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        router.push('/login');
        return;
      }
      const currentId = authData.user.id;
      setUserId(currentId);

      const { data: profile } = await supabase.from('profiles').select('role, is_approved').eq('id', currentId).single();
      if (!profile) return;

      if (profile.role === 'admin_cfa') {
        router.push('/admin');
        return;
      }

      if (!profile.is_approved) {
        setIsApproved(false);
        setLoading(false);
        return;
      }

      let targetRole = profile.role === 'apprenti' ? 'patron' : 'apprenti';
      
      let myDomaine = 'coiffure';
      let myLat = 44.1272; // Alès default
      let myLon = 4.0833;
      let myDistMax = 50;
      let myDiplomeRecherche = 'Tous les diplômes';

      if (profile.role === 'apprenti') {
        const { data } = await supabase.from('apprentis_details').select('domaine, latitude, longitude, distance_max').eq('profile_id', currentId).single();
        if (data) {
          myDomaine = data.domaine;
          if (data.latitude) myLat = data.latitude;
          if (data.longitude) myLon = data.longitude;
          if (data.distance_max) myDistMax = data.distance_max;
        }
      } else {
        const { data } = await supabase.from('patrons_details').select('domaine, latitude, longitude, distance_max, diplome_recherche').eq('profile_id', currentId).single();
        if (data) {
          myDomaine = data.domaine;
          if (data.latitude) myLat = data.latitude;
          if (data.longitude) myLon = data.longitude;
          if (data.distance_max) myDistMax = data.distance_max;
          if (data.diplome_recherche) myDiplomeRecherche = data.diplome_recherche;
        }
      }

      const { data: approvedRows } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', targetRole)
        .eq('is_approved', true);
      const approvedIds = new Set((approvedRows || []).map(p => p.id));

      let results: (ProfileCard & { distance: number, candidateDistMax: number, originalDiplome?: string })[] = [];
      
      if (targetRole === 'patron') {
        const { data } = await supabase.from('patrons_details').select('*').eq('domaine', myDomaine);
        if (data) {
          results = data.map(p => ({
            id: p.profile_id,
            nom: p.nom_entreprise,
            photo: p.photo_profil || "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=1000",
            sousTitre: p.adresse || "Pas d'adresse renseignée",
            description: p.presentation,
            tags: p.besoins || [p.domaine],
            details: {
              'Présentation': p.presentation,
              'Adresse': p.adresse,
              'Diplôme recherché': p.diplome_recherche,
            },
            distance: getDistanceFromLatLonInKm(myLat, myLon, p.latitude || 44.1272, p.longitude || 4.0833),
            candidateDistMax: p.distance_max || 50
          }));
        }
      } else {
        const { data } = await supabase.from('apprentis_details').select('*').eq('domaine', myDomaine);
        if (data) {
          results = data.map(p => ({
            id: p.profile_id,
            nom: `${p.prenom} ${p.nom}`,
            photo: p.photo_profil || "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=1000",
            sousTitre: `${p.age ? p.age + ' ans - ' : ''}${p.diplome_souhaite || p.domaine}`,
            description: p.motivation,
            tags: p.specialites || [p.domaine],
            details: {
              'Diplôme acquis': p.diplome_acquis,
              'Expérience en apprentissage': p.experience_apprentissage,
              'Stages effectués': p.stage_effectue,
              'Autre expérience': p.autre_experience,
              'Moyen de transport': p.moyen_transport,
              'Adresse': p.adresse
            },
            distance: getDistanceFromLatLonInKm(myLat, myLon, p.latitude || 44.1272, p.longitude || 4.0833),
            candidateDistMax: p.distance_max || 50,
            originalDiplome: p.diplome_souhaite
          }));
        }
      }

      // Remove swiped profiles and filter by MUTUAL distance + approval
      const { data: swipes } = await supabase.from('swipes').select('vers_profile_id').eq('de_profile_id', currentId);
      const swipedIds = swipes ? swipes.map(s => s.vers_profile_id) : [];
      
      const filtered = results.filter(p => 
        approvedIds.has(p.id) &&
        !swipedIds.includes(p.id) && 
        p.id !== currentId &&
        p.distance <= myDistMax && 
        p.distance <= p.candidateDistMax &&
        (targetRole === 'patron' ? true : (myDiplomeRecherche === 'Tous les diplômes' || p.originalDiplome === myDiplomeRecherche))
      );
      
      setProfiles(filtered);
      setLoading(false);
    };

    fetchProfiles();
  }, [router]);

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 pt-10 flex flex-col">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-[#D4AF37]">Découverte</h1>
        <p className="text-sm text-zinc-500">Trouvez votre prochain match</p>
      </div>
      <div className="flex-1 flex items-center justify-center">
        {loading ? (
          <div className="text-zinc-500">Chargement des profils...</div>
        ) : !isApproved ? (
          <div className="max-w-sm text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#D4AF37]/15 flex items-center justify-center">
              <Clock className="text-[#D4AF37]" size={28} />
            </div>
            <h2 className="text-xl font-bold mb-2">Profil en attente de validation</h2>
            <p className="text-sm text-zinc-500 mb-6">
              Un administrateur du CFA doit valider votre profil avant que vous puissiez swiper.
            </p>
            <Link href="/profil" className="inline-block px-5 py-3 rounded-xl bg-[#D4AF37] text-white font-bold hover:bg-[#B8962E] transition-colors">
              Voir mon profil
            </Link>
          </div>
        ) : (
          <SwipeDeck profiles={profiles} currentUserId={userId} />
        )}
      </div>
    </main>
  );
}
