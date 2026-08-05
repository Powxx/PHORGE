"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { User, LogOut, FileText, Settings, Bell, BellOff, BellRing } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProfileMap from '@/components/ProfileMap';
import { subscribeUserToPush } from '@/lib/notifications';

export default function ProfilPage() {
  const [profileData, setProfileData] = useState<any>(null);
  const [role, setRole] = useState<'apprenti'|'patron'|'admin_cfa'|null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!('Notification' in window)) {
        setNotificationPermission('unsupported');
      } else {
        setNotificationPermission(Notification.permission);
      }
    }
  }, []);

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
                <p className="flex flex-col sm:flex-row sm:gap-4"><span className="text-zinc-500 w-32 shrink-0">Distance Max</span> <strong className="break-words">{profileData?.distance_max} km</strong></p>
              </>
            )}
            {role === 'admin_cfa' && (
              <p className="text-zinc-500 text-sm italic">Vous avez tous les droits sur la plateforme. Accédez à la Control Tower pour superviser les mises en relation.</p>
            )}
          </div>

          {profileData && role !== 'admin_cfa' && profileData.latitude && profileData.longitude && (
            <ProfileMap 
              latitude={profileData.latitude} 
              longitude={profileData.longitude} 
              radius={profileData.distance_max || 50} 
              adresse={profileData.adresse}
            />
          )}

          {/* Configuration des Notifications */}
          <div className="mt-6 text-left bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
            <h3 className="font-bold flex items-center gap-2 mb-4 text-lg">
              <Bell size={20} className="text-[#D4AF37]" /> Notifications Push
            </h3>
            
            {notificationPermission === 'granted' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 text-green-600 dark:text-green-400 text-sm font-medium">
                  <BellRing size={20} className="shrink-0" />
                  <span>Les notifications sont activées sur votre navigateur ! Vous recevrez des alertes en cas de nouveau match, message ou profil.</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={async () => {
                      const result = await subscribeUserToPush();
                      setNotificationPermission(result);
                      alert("Votre appareil a été réenregistré avec succès !");
                    }}
                    className="py-2.5 px-4 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-xs"
                  >
                    <Bell size={14} /> Réenregistrer cet appareil
                  </button>
                  
                  <button
                    onClick={async () => {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (user) {
                        const res = await fetch('/api/push/notify', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            userId: user.id,
                            title: "Test de Notification PHORGE 🔔",
                            body: "Félicitations, vos notifications push fonctionnent parfaitement !",
                            url: "/profil"
                          })
                        });
                        const data = await res.json();
                        if (data.sent > 0) {
                          alert("Notification de test envoyée !");
                        } else {
                          alert("Aucun appareil enregistré trouvé pour l'envoi de la notification. Veuillez cliquer sur 'Réenregistrer cet appareil' d'abord.");
                        }
                      }
                    }}
                    className="py-2.5 px-4 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37] rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-xs"
                  >
                    Tester la notification
                  </button>
                </div>
              </div>
            )}

            {notificationPermission === 'default' && (
              <div className="flex flex-col gap-3">
                <p className="text-zinc-500 text-sm">
                  Activez les notifications pour ne rater aucun match ou message important.
                </p>
                <button
                  onClick={async () => {
                    const result = await subscribeUserToPush();
                    setNotificationPermission(result);
                  }}
                  className="py-3 px-4 bg-[#D4AF37] hover:bg-[#B8962E] text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-sm w-full"
                >
                  <Bell size={18} /> Activer les notifications
                </button>
              </div>
            )}

            {notificationPermission === 'denied' && (
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center gap-3 text-red-500 font-medium">
                  <BellOff size={20} className="shrink-0" />
                  <span>Notifications bloquées</span>
                </div>
                <p className="text-zinc-500 text-xs">
                  Les notifications sont bloquées par votre navigateur. Pour les activer, veuillez cliquer sur l'icône de cadenas à gauche de l'URL dans votre barre d'adresse et autoriser à nouveau les notifications.
                </p>
              </div>
            )}

            {notificationPermission === 'unsupported' && (
              <p className="text-zinc-500 text-sm italic">
                Les notifications ne sont pas prises en charge par votre navigateur ou votre appareil actuel.
              </p>
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
