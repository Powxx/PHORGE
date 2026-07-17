"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, LocateFixed } from 'lucide-react';
import Link from 'next/link';

export default function EditProfilPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'apprenti'|'patron'|'admin_cfa'|null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Common State
  const [distance, setDistance] = useState(50);
  const [latitude, setLatitude] = useState(44.1272);
  const [longitude, setLongitude] = useState(4.0833);
  const [isLocating, setIsLocating] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [domaine, setDomaine] = useState<'coiffure'|'esthetique'|null>(null);

  // Apprenti State
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [age, setAge] = useState('');
  const [stage, setStage] = useState('');
  const [xp, setXp] = useState('');
  const [expApprentissage, setExpApprentissage] = useState('');
  const [expAutre, setExpAutre] = useState('');
  const [diplomeSouhaite, setDiplomeSouhaite] = useState('');
  const [diplomeAcquis, setDiplomeAcquis] = useState('');
  const [moyenTransport, setMoyenTransport] = useState('');
  const [motivation, setMotivation] = useState('');

  // Patron State
  const [nomEntreprise, setNomEntreprise] = useState('');
  const [adresse, setAdresse] = useState('');
  const [presentation, setPresentation] = useState('');
  const [diplomeRecherche, setDiplomeRecherche] = useState('Tous les diplômes');

  useEffect(() => {
    const init = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) { router.push('/login'); return; }
      setUserId(authData.user.id);

      const { data: prof } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single();
      if (!prof) return;
      setRole(prof.role);

      if (prof.role === 'apprenti') {
        const { data } = await supabase.from('apprentis_details').select('*').eq('profile_id', authData.user.id).single();
        if (data) {
          setDomaine(data.domaine);
          setNom(data.nom || '');
          setPrenom(data.prenom || '');
          setAge(data.age ? data.age.toString() : '');
          setStage(data.stage_effectue || '');
          setExpApprentissage(data.experience_apprentissage || '');
          setExpAutre(data.autre_experience || '');
          setXp(data.experience_pro || '');
          setMoyenTransport(data.moyen_transport || '');
          setMotivation(data.motivation || '');
          setDiplomeSouhaite(data.diplome_souhaite || '');
          setDiplomeAcquis(data.diplome_acquis || '');
          setDistance(data.distance_max || 50);
          setLatitude(data.latitude || 44.1272);
          setLongitude(data.longitude || 4.0833);
          setAdresse(data.adresse || '');
          setPhotoUrl(data.photo_profil || '');
        }
      } else if (prof.role === 'patron') {
        const { data } = await supabase.from('patrons_details').select('*').eq('profile_id', authData.user.id).single();
        if (data) {
          setDomaine(data.domaine);
          setNomEntreprise(data.nom_entreprise || '');
          setAdresse(data.adresse || '');
          setDistance(data.distance_max || 50);
          setLatitude(data.latitude || 44.1272);
          setLongitude(data.longitude || 4.0833);
          setPhotoUrl(data.photo_profil || '');
          setPresentation(data.presentation || '');
          setDiplomeRecherche(data.diplome_recherche || 'Tous les diplômes');
        }
      }
      setLoading(false);
    };
    init();
  }, [router]);

  const handleLocate = () => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          setLatitude(lat);
          setLongitude(lon);
          
          // Reverse geocoding
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            const data = await res.json();
            if (data && data.address) {
              const addressParts = [];
              if (data.address.road || data.address.pedestrian) addressParts.push(data.address.road || data.address.pedestrian);
              if (data.address.city || data.address.town || data.address.village) addressParts.push(data.address.city || data.address.town || data.address.village);
              if (addressParts.length > 0) {
                setAdresse(addressParts.join(', '));
              } else if (data.display_name) {
                setAdresse(data.display_name);
              }
            }
          } catch (err) {
            console.error("Erreur géocodage", err);
          }

          setIsLocating(false);
        },
        (error) => {
          console.error(error);
          alert("Géolocalisation refusée. Localisation par défaut (Alès) conservée.");
          setIsLocating(false);
        }
      );
    } else {
      setIsLocating(false);
      alert("Votre navigateur ne supporte pas la géolocalisation.");
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !userId) return;
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/${Date.now()}.${fileExt}`;

    setUploading(true);
    try {
      const { error: uploadError } = await supabase.storage.from('photos').upload(filePath, file, {
        upsert: true,
        contentType: file.type || undefined,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('photos').getPublicUrl(filePath);
      setPhotoUrl(data.publicUrl);
    } catch (error: any) {
      console.error("Error uploading photo:", error);
      alert(error?.message || "Erreur lors de l'upload de la photo. Exécutez fix-storage.sql dans Supabase.");
    }
    setUploading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (role === 'apprenti') {
        await supabase.from('apprentis_details').update({
          nom: nom,
          prenom: prenom,
          age: parseInt(age) || null,
          stage_effectue: stage,
          experience_apprentissage: expApprentissage,
          autre_experience: expAutre,
          experience_pro: xp,
          moyen_transport: moyenTransport,
          motivation: motivation,
          diplome_souhaite: diplomeSouhaite,
          diplome_acquis: diplomeAcquis,
          adresse: adresse,
          distance_max: distance,
          latitude, longitude,
          photo_profil: photoUrl
        }).eq('profile_id', userId);
      } else if (role === 'patron') {
        await supabase.from('patrons_details').update({
          nom_entreprise: nomEntreprise,
          adresse: adresse,
          distance_max: distance,
          latitude, longitude,
          photo_profil: photoUrl,
          presentation: presentation,
          diplome_recherche: diplomeRecherche
        }).eq('profile_id', userId);
      }
      router.push('/profil');
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la sauvegarde.");
    }
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-zinc-500">Chargement...</div>;
  if (role === 'admin_cfa') return <div className="min-h-screen p-6 text-center">Les admins n'ont pas de profil à modifier.</div>;

  return (
    <main className="p-6 pt-10 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/profil" className="p-2 bg-white dark:bg-zinc-900 rounded-full border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-3xl font-bold text-[#D4AF37]">Modifier Profil</h1>
      </div>

      <form onSubmit={handleSave} className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-6">
        
        <div>
          <label className="block text-sm font-medium mb-2">Photo ({role === 'patron' ? 'Salon' : 'Profil'})</label>
          <div className="flex items-center gap-4">
            {photoUrl ? (
              <img src={photoUrl} alt="Profil" className="w-16 h-16 rounded-xl object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                <span className="text-xs">Aucune</span>
              </div>
            )}
            <div className="flex-1">
              <label className="cursor-pointer inline-block bg-zinc-100 dark:bg-zinc-800 text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                {uploading ? 'Chargement...' : 'Modifier la photo'}
                <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {role === 'patron' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Nom de l'entreprise</label>
              <input type="text" value={nomEntreprise} onChange={e=>setNomEntreprise(e.target.value)} className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Adresse</label>
              <input type="text" value={adresse} onChange={e=>setAdresse(e.target.value)} className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" placeholder="Rue, Ville, Code postal" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Présentation / Profil recherché</label>
              <textarea value={presentation} onChange={e=>setPresentation(e.target.value)} rows={4} className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" placeholder="Décrivez votre salon..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Diplôme recherché</label>
              <select value={diplomeRecherche} onChange={e => setDiplomeRecherche(e.target.value)} className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]">
                <option value="Tous les diplômes">Peu importe / Tous les diplômes</option>
                <option value="CAP">CAP</option>
                <option value="BP">BP</option>
                {domaine === 'coiffure' && <option value="CS-Mention">CS-Mention</option>}
              </select>
            </div>
          </>
        )}

        {role === 'apprenti' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Prénom</label>
                <input type="text" value={prenom} onChange={e=>setPrenom(e.target.value)} className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Nom</label>
                <input type="text" value={nom} onChange={e=>setNom(e.target.value)} className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Âge</label>
              <input type="number" value={age} onChange={e=>setAge(e.target.value)} className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Diplôme souhaité</label>
              <select value={diplomeSouhaite} onChange={e => setDiplomeSouhaite(e.target.value)} className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]">
                <option value="" disabled>Sélectionnez un diplôme</option>
                <option value="CAP">CAP</option>
                <option value="BP">BP</option>
                {domaine === 'coiffure' && <option value="CS-Mention">CS-Mention</option>}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Diplômes acquis</label>
              <input type="text" value={diplomeAcquis} onChange={e=>setDiplomeAcquis(e.target.value)} className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Stages effectués</label>
              <textarea value={stage} onChange={e=>setStage(e.target.value)} rows={2} className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Expérience en apprentissage</label>
              <textarea value={expApprentissage} onChange={e=>setExpApprentissage(e.target.value)} rows={2} className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Autre expérience</label>
              <textarea value={expAutre} onChange={e=>setExpAutre(e.target.value)} rows={2} className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Moyen de transport</label>
              <input type="text" value={moyenTransport} onChange={e=>setMoyenTransport(e.target.value)} className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" placeholder="Ex: Scooter, Bus..." />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Motivation (Pourquoi moi ?)</label>
              <textarea value={motivation} onChange={e=>setMotivation(e.target.value)} rows={4} className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37] resize-none" />
            </div>
          </>
        )}

        <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
          <label className="block text-sm font-medium mb-4">Localisation & Recherche</label>
          
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Mon Adresse</label>
            <input type="text" value={adresse} onChange={e => setAdresse(e.target.value)} className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" placeholder="Rue, Ville, Code postal" />
          </div>

          <button type="button" onClick={handleLocate} className="w-full flex items-center justify-center gap-2 p-3 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-bold rounded-xl hover:bg-blue-100 transition-colors mb-6">
            <LocateFixed size={18} /> {isLocating ? "Localisation..." : "Mettre à jour ma position GPS"}
          </button>

          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Rechercher dans un rayon de</span>
            <span className="font-bold text-[#D4AF37]">{distance} km</span>
          </div>
          <input type="range" min="5" max="100" value={distance} onChange={e => setDistance(Number(e.target.value))} className="w-full accent-[#D4AF37] h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg cursor-pointer" />
        </div>

        <button type="submit" disabled={saving} className="w-full mt-6 py-4 rounded-xl bg-[#D4AF37] text-white font-bold text-lg hover:bg-[#B8962E] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#D4AF37]/20">
          <Save size={20} /> {saving ? "Enregistrement..." : "Sauvegarder"}
        </button>

      </form>
    </main>
  );
}
