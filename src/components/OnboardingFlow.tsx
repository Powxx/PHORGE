"use client";
import React, { useState, useEffect } from 'react';
import { Camera, MapPin, ChevronRight, Briefcase, User, Building2, LocateFixed } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function OnboardingFlow() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  const [step, setStep] = useState(0);
  const [role, setRole] = useState<'apprenti' | 'patron' | null>(null);

  // Patron State
  const [nomEntreprise, setNomEntreprise] = useState('');
  const [adresse, setAdresse] = useState('');
  const [presentation, setPresentation] = useState('');
  const [diplomeRecherche, setDiplomeRecherche] = useState('Tous les diplômes');

  // Apprenti State
  const [domaine, setDomaine] = useState<'coiffure' | 'esthetique' | null>(null);
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [age, setAge] = useState('');
  
  const [diplomeSouhaite, setDiplomeSouhaite] = useState('');
  const [diplomeAcquis, setDiplomeAcquis] = useState('');
  
  const [stage, setStage] = useState('');
  const [expApprentissage, setExpApprentissage] = useState('');
  const [expAutre, setExpAutre] = useState('');
  const [xp, setXp] = useState(''); // legacy
  
  const [moyenTransport, setMoyenTransport] = useState('');
  const [motivation, setMotivation] = useState('');

  // Common State
  const [distance, setDistance] = useState(50);
  const [latitude, setLatitude] = useState(44.1272); // Alès default
  const [longitude, setLongitude] = useState(4.0833);
  const [isLocating, setIsLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data?.user) {
        setUserId(data.user.id);
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
        if (profile?.role === 'admin_cfa') {
          router.push('/admin');
        }
      }
      else router.push('/login');
    });
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
          alert("Géolocalisation refusée ou indisponible. Localisation par défaut (Alès) conservée.");
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

  const handleSave = async () => {
    if (!userId || !role) return;
    setSaving(true);

    try {
      await supabase.from('profiles').update({ role }).eq('id', userId);

      if (role === 'patron') {
        await supabase.from('patrons_details').insert({
          profile_id: userId,
          nom_entreprise: nomEntreprise || 'Mon Salon',
          domaine: domaine || 'coiffure',
          adresse: adresse,
          distance_max: distance,
          latitude: latitude,
          longitude: longitude,
          photo_profil: photoUrl,
          presentation: presentation,
          diplome_recherche: diplomeRecherche
        });
      } else {
        await supabase.from('apprentis_details').insert({
          profile_id: userId,
          nom: nom || 'Apprenti',
          prenom: prenom || 'Nouveau',
          age: parseInt(age) || null,
          domaine: domaine || 'coiffure',
          adresse: adresse,
          moyen_transport: moyenTransport,
          distance_max: distance,
          stage_effectue: stage,
          experience_apprentissage: expApprentissage,
          autre_experience: expAutre,
          experience_pro: xp,
          diplome_souhaite: diplomeSouhaite,
          diplome_acquis: diplomeAcquis,
          motivation: motivation,
          latitude: latitude,
          longitude: longitude,
          photo_profil: photoUrl
        });
      }

      router.push('/swipe');
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la sauvegarde.");
      setSaving(false);
    }
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  if (step === 0) {
    return (
      <div className="max-w-md mx-auto min-h-screen flex flex-col justify-center p-6 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <h1 className="text-3xl font-bold mb-8 text-center">Que recherchez-vous ?</h1>
        <div className="space-y-4">
          <button
            onClick={() => { setRole('apprenti'); nextStep(); }}
            className="w-full p-6 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 flex flex-col items-center gap-4 hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 transition-all">
            <User size={48} className="text-[#D4AF37]" />
            <span className="font-bold text-xl">Je cherche un salon</span>
            <span className="text-sm text-zinc-500">Pour mon apprentissage</span>
          </button>
          <button
            onClick={() => { setRole('patron'); nextStep(); }}
            className="w-full p-6 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 flex flex-col items-center gap-4 hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 transition-all">
            <Building2 size={48} className="text-[#D4AF37]" />
            <span className="font-bold text-xl">Je cherche un apprenti</span>
            <span className="text-sm text-zinc-500">Pour mon salon / institut</span>
          </button>
        </div>
      </div>
    );
  }

  // Patron Flow
  if (role === 'patron') {
    return (
      <div className="max-w-md mx-auto min-h-screen flex flex-col p-6 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <div className="flex-1 flex flex-col justify-center py-10">
          <h1 className="text-3xl font-bold mb-4">Parlez-nous de votre salon</h1>
          <p className="text-zinc-500 mb-8">Pour attirer les meilleurs apprentis.</p>

          <div className="space-y-4 overflow-y-auto pb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nom de l'entreprise</label>
              <input type="text" value={nomEntreprise} onChange={e => setNomEntreprise(e.target.value)} className="w-full p-3 bg-zinc-100 dark:bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" placeholder="Ex: Salon de l'Élégance" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Domaine d'activité</label>
              <div className="flex gap-2">
                <button onClick={() => setDomaine('coiffure')} className={`flex-1 p-3 rounded-xl border-2 transition-colors ${domaine === 'coiffure' ? 'border-[#D4AF37] bg-[#D4AF37]/10 font-bold text-[#D4AF37]' : 'border-zinc-200 dark:border-zinc-800'}`}>Coiffure</button>
                <button onClick={() => setDomaine('esthetique')} className={`flex-1 p-3 rounded-xl border-2 transition-colors ${domaine === 'esthetique' ? 'border-[#D4AF37] bg-[#D4AF37]/10 font-bold text-[#D4AF37]' : 'border-zinc-200 dark:border-zinc-800'}`}>Esthétique</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Présentation / Profil recherché</label>
              <textarea value={presentation} onChange={e => setPresentation(e.target.value)} rows={4} className="w-full p-3 bg-zinc-100 dark:bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" placeholder="Décrivez votre salon et l'apprenti idéal..." />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Diplôme recherché</label>
              <select value={diplomeRecherche} onChange={e => setDiplomeRecherche(e.target.value)} className="w-full p-3 bg-zinc-100 dark:bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]">
                <option value="Tous les diplômes">Peu importe / Tous les diplômes</option>
                <option value="CAP">CAP</option>
                <option value="BP">BP</option>
                {domaine === 'coiffure' && <option value="CS-Mention">CS-Mention</option>}
              </select>
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 mt-4">
              <label className="block text-sm font-medium mb-2">Photo du salon (Optionnelle)</label>
              <div className="flex items-center gap-4">
                {photoUrl ? (
                  <img src={photoUrl} alt="Salon" className="w-16 h-16 rounded-xl object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                    <Camera size={24} />
                  </div>
                )}
                <div className="flex-1">
                  <label className="cursor-pointer inline-block bg-zinc-100 dark:bg-zinc-800 text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                    {uploading ? 'Chargement...' : 'Choisir une photo'}
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Adresse de l'entreprise</label>
                <input type="text" value={adresse} onChange={e => setAdresse(e.target.value)} className="w-full p-3 bg-zinc-100 dark:bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" placeholder="Rue, Ville, Code postal" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Localisation GPS</label>
                <button onClick={handleLocate} className="w-full flex items-center justify-center gap-2 p-3 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-bold rounded-xl hover:bg-blue-100 transition-colors">
                  <LocateFixed size={18} /> {isLocating ? "Localisation..." : "Me localiser précisément"}
                </button>
                <p className="text-xs text-zinc-400 text-center mt-2">Par défaut: Alès (30100)</p>
              </div>
            </div>

            <div className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Rechercher des apprentis dans un rayon de</span>
                <span className="font-bold text-[#D4AF37]">{distance} km</span>
              </div>
              <input type="range" min="5" max="100" value={distance} onChange={e => setDistance(Number(e.target.value))} className="w-full accent-[#D4AF37] h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg cursor-pointer" />
            </div>
          </div>
        </div>
        <div className="mt-4 pb-8">
          <button
            onClick={handleSave}
            disabled={saving || !nomEntreprise.trim() || !domaine}
            className="w-full py-4 rounded-xl bg-[#D4AF37] text-white font-bold text-lg hover:bg-[#B8962E] transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            {saving ? 'Création...' : 'Accéder aux profils'}
          </button>
        </div>
      </div>
    );
  }

  // Apprenti Flow
  const totalSteps = 7;
  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col p-6 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="flex items-center gap-2 mb-8 mt-4">
        {Array.from({length: totalSteps}).map((_, i) => (
          <div key={i} className={`h-2 flex-1 rounded-full transition-colors ${step > i ? 'bg-[#D4AF37]' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
        ))}
      </div>

      <div className="flex-1 flex flex-col">
        {step === 1 && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <h1 className="text-3xl font-bold mb-2">Votre photo professionnelle</h1>
            <p className="text-zinc-500 mb-8 text-center">Montrez-vous sous votre meilleur jour.</p>
            
            <label className="w-48 h-48 rounded-full border-4 border-dashed border-zinc-300 dark:border-zinc-700 flex flex-col items-center justify-center text-zinc-400 cursor-pointer hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors bg-zinc-50 dark:bg-zinc-900 overflow-hidden relative">
              {photoUrl ? (
                <img src={photoUrl} alt="Profil" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Camera size={48} className="mb-2" />
                  <span className="text-sm font-medium">{uploading ? 'Upload...' : 'Ajouter une photo'}</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} className="hidden" />
            </label>

            <button onClick={nextStep} className="mt-8 text-sm font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white underline">
              Passer (Optionnel)
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <h1 className="text-3xl font-bold mb-2">Votre domaine</h1>
            <button onClick={() => { setDomaine('coiffure'); nextStep(); }} className="w-full p-4 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 flex items-center justify-between hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 transition-colors">
              <span className="font-semibold text-lg">Coiffure</span><Briefcase className="text-[#D4AF37]" />
            </button>
            <button onClick={() => { setDomaine('esthetique'); nextStep(); }} className="w-full p-4 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 flex items-center justify-between hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 transition-colors">
              <span className="font-semibold text-lg">Esthétique</span><Briefcase className="text-[#D4AF37]" />
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <h1 className="text-3xl font-bold mb-4">Je suis...</h1>
            <div>
              <label className="text-sm font-medium">Prénom</label>
              <input value={prenom} onChange={e => setPrenom(e.target.value)} className="w-full mt-1 p-3 bg-zinc-100 dark:bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" placeholder="Ex: Jean" />
            </div>
            <div>
              <label className="text-sm font-medium">Nom</label>
              <input value={nom} onChange={e => setNom(e.target.value)} className="w-full mt-1 p-3 bg-zinc-100 dark:bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" placeholder="Ex: Dupont" />
            </div>
            <div>
              <label className="text-sm font-medium">Âge</label>
              <input type="number" value={age} onChange={e => setAge(e.target.value)} className="w-full mt-1 p-3 bg-zinc-100 dark:bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" placeholder="Ex: 19" />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <h1 className="text-3xl font-bold mb-4">Mon projet...</h1>
            <div>
              <label className="text-sm font-medium">Je recherche (Diplôme souhaité)</label>
              <select value={diplomeSouhaite} onChange={e => setDiplomeSouhaite(e.target.value)} className="w-full mt-1 p-3 bg-zinc-100 dark:bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]">
                <option value="" disabled>Sélectionnez un diplôme</option>
                <option value="CAP">CAP</option>
                <option value="BP">BP</option>
                {domaine === 'coiffure' && <option value="CS-Mention">CS-Mention</option>}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">J'ai obtenu (Diplôme acquis)</label>
              <input value={diplomeAcquis} onChange={e => setDiplomeAcquis(e.target.value)} className="w-full mt-1 p-3 bg-zinc-100 dark:bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" placeholder="Ex: CAP Coiffure, Brevet" />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="flex-1 flex flex-col justify-center space-y-4 overflow-y-auto pb-4">
            <h1 className="text-3xl font-bold mb-4">J'ai fait...</h1>
            <div>
              <label className="text-sm font-medium">Stages effectués</label>
              <textarea value={stage} onChange={e => setStage(e.target.value)} rows={2} className="w-full mt-1 p-3 bg-zinc-100 dark:bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" placeholder="Ex: 2 semaines chez XYZ..." />
            </div>
            <div>
              <label className="text-sm font-medium">Expérience en apprentissage</label>
              <textarea value={expApprentissage} onChange={e => setExpApprentissage(e.target.value)} rows={2} className="w-full mt-1 p-3 bg-zinc-100 dark:bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" placeholder="Ex: 1 an de CAP chez ABC..." />
            </div>
            <div>
              <label className="text-sm font-medium">Autre expérience professionnelle</label>
              <textarea value={expAutre} onChange={e => setExpAutre(e.target.value)} rows={2} className="w-full mt-1 p-3 bg-zinc-100 dark:bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" placeholder="Ex: Job d'été, vente..." />
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="flex-1 flex flex-col justify-center space-y-4 overflow-y-auto pb-4">
            <h1 className="text-3xl font-bold mb-2">Ma mobilité</h1>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Je peux me déplacer (Moyen de transport)</label>
              <input type="text" value={moyenTransport} onChange={e => setMoyenTransport(e.target.value)} className="w-full p-3 bg-zinc-100 dark:bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" placeholder="Ex: Bus, Scooter, Voiture..." />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Mon Adresse (Optionnelle)</label>
              <input type="text" value={adresse} onChange={e => setAdresse(e.target.value)} className="w-full p-3 bg-zinc-100 dark:bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]" placeholder="Rue, Ville, Code postal" />
            </div>

            <button onClick={handleLocate} className="w-full flex items-center justify-center gap-2 p-3 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-bold rounded-xl hover:bg-blue-100 transition-colors">
              <LocateFixed size={18} /> {isLocating ? "Localisation..." : "Me localiser précisément"}
            </button>
            <p className="text-xs text-zinc-400 text-center mb-4">Par défaut: Alès (30100)</p>

            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 font-medium"><MapPin className="text-[#D4AF37]" /> Rayon max.</span>
                <span className="font-bold text-[#D4AF37]">{distance} km</span>
              </div>
              <input type="range" min="5" max="100" value={distance} onChange={e => setDistance(Number(e.target.value))} className="w-full accent-[#D4AF37] h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg cursor-pointer" />
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <h1 className="text-3xl font-bold mb-4">Pourquoi moi ?</h1>
            <p className="text-zinc-500 mb-2">Exprimez votre motivation, ce qui vous passionne et vos qualités.</p>
            <div>
              <textarea value={motivation} onChange={e => setMotivation(e.target.value)} rows={6} className="w-full p-4 bg-zinc-100 dark:bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37] resize-none" placeholder="Je suis passionné par la coiffure depuis toujours. Je suis créatif, ponctuel et j'ai soif d'apprendre..." />
            </div>
          </div>
        )}

      </div>

      <div className="mt-4 pb-8 flex gap-4">
        {(step > 1) && (
          <button onClick={prevStep} className="py-4 px-6 rounded-xl bg-zinc-100 dark:bg-zinc-900 font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
            Retour
          </button>
        )}
        
        {(step === 1 || step > 2) && (
          <button 
            onClick={() => step < totalSteps ? nextStep() : handleSave()}
            disabled={saving}
            className="flex-1 py-4 rounded-xl bg-[#D4AF37] text-white font-bold text-lg hover:bg-[#B8962E] transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#D4AF37]/20 disabled:opacity-50"
          >
            {step === totalSteps ? (saving ? 'Création...' : "Terminer") : "Continuer"} {step < totalSteps && <ChevronRight size={20} />}
          </button>
        )}
      </div>
    </div>
  );
}
