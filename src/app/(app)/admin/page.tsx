"use client";
import React, { useEffect, useState } from 'react';
import { ShieldCheck, ChevronRight, Download, Bell, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const [apprentis, setApprentis] = useState<any[]>([]);
  const [patrons, setPatrons] = useState<any[]>([]);
  const [allMatches, setAllMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<{id: number, msg: string, type: string}[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) {
        router.push('/login');
      } else {
        supabase.from('profiles').select('role').eq('id', data.user.id).single().then(({ data: profile }) => {
          if (profile?.role !== 'admin_cfa') {
            router.push('/swipe');
          }
        });
      }
    });
  }, [router]);

  const fetchData = async () => {
    const { data: appData } = await supabase.from('apprentis_details').select('*');
    const { data: patData } = await supabase.from('patrons_details').select('*');
    const { data: matches } = await supabase.from('matches').select('*');
    const { data: profiles } = await supabase.from('profiles').select('id, is_approved').in('role', ['apprenti', 'patron']);
    const approvalMap: Record<string, boolean> = {};
    profiles?.forEach(p => { approvalMap[p.id] = !!p.is_approved; });

    const nameMap: Record<string, string> = {};
    if (appData) {
      appData.forEach(a => nameMap[a.profile_id] = `${a.prenom} ${a.nom}`);
    }
    if (patData) {
      patData.forEach(p => nameMap[p.profile_id] = p.nom_entreprise);
      setPatrons(patData.map(p => ({ ...p, is_approved: approvalMap[p.profile_id] ?? false })));
    }

    if (appData && matches) {
      const enriched = appData.map(app => {
        const userMatches = matches.filter(m => m.apprenti_id === app.profile_id);
        
        let status = 'Sans match';
        let color = 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400';
        
        if (userMatches.some(m => m.statut === 'contrat_demande')) { 
          status = 'Contrat'; 
          color = 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400'; 
        }
        else if (userMatches.some(m => m.statut === 'essai_demande')) { 
          status = 'Essai'; 
          color = 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400'; 
        }
        else if (userMatches.length > 0) { 
          status = 'Matché'; 
          color = 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400'; 
        }

        return { ...app, currentStatus: status, statusColor: color, is_approved: approvalMap[app.profile_id] ?? false };
      });
      setApprentis(enriched);

      const enrichedMatches = matches.map(m => ({
        ...m,
        apprentiName: nameMap[m.apprenti_id] || m.apprenti_id,
        patronName: nameMap[m.patron_id] || m.patron_id
      }));
      setAllMatches(enrichedMatches);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    // Listen to matches table for real-time alerts
    const channel = supabase.channel('admin_alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, payload => {
        setAlerts(prev => [{ id: Date.now(), msg: "Nouveau Match !", type: 'info' }, ...prev]);
        fetchData();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, payload => {
        if (payload.new.statut === 'essai_demande' && payload.old.statut !== 'essai_demande') {
          setAlerts(prev => [{ id: Date.now(), msg: "Demande d'essai envoyée par un salon !", type: 'warning' }, ...prev]);
        }
        if (payload.new.statut === 'contrat_demande' && payload.old.statut !== 'contrat_demande') {
          setAlerts(prev => [{ id: Date.now(), msg: "🎉 Intention de contrat déclarée !", type: 'success' }, ...prev]);
        }
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const exportCSV = () => {
    const headers = ["Nom", "Prenom", "Domaine", "Statut", "Stage", "Experience", "Diplome Souhaite", "Diplome Acquis"];
    const rows = apprentis.map(a => [
      a.nom, a.prenom, a.domaine, a.currentStatus, a.stage_effectue || "", a.experience_pro || "", a.diplome_souhaite || "", a.diplome_acquis || ""
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.map(cell => `"${cell}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "apprentis_phorge.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const removeAlert = (id: number) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleApprove = async (profileId: string) => {
    try {
      await supabase.from('profiles').update({ is_approved: true }).eq('id', profileId);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la validation du compte.");
    }
  };

  const handleDeleteProfile = async (profileId: string, name: string) => {
    const confirmed = window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement le profil de "${name}" ainsi que toutes ses données et photos associées ? Cette action est irréversible.`);
    if (!confirmed) return;

    try {
      // 1. Liste et supprime les fichiers dans le bucket 'photos' sous le dossier {profileId}
      const { data: files, error: listError } = await supabase.storage.from('photos').list(profileId);
      if (listError) {
        console.error("Erreur lors de la liste des fichiers de stockage:", listError);
      } else if (files && files.length > 0) {
        const pathsToDelete = files.map(f => `${profileId}/${f.name}`);
        const { error: deleteStorageError } = await supabase.storage.from('photos').remove(pathsToDelete);
        if (deleteStorageError) {
          console.error("Erreur lors de la suppression des fichiers de stockage:", deleteStorageError);
        }
      }

      // 2. Supprime la ligne dans la table 'profiles' (cascade pour le reste)
      const { error: deleteProfileError } = await supabase.from('profiles').delete().eq('id', profileId);
      if (deleteProfileError) {
        throw deleteProfileError;
      }

      // 3. Rafraîchit les données localement
      setAlerts(prev => [{ id: Date.now(), msg: `Le profil de "${name}" a été supprimé avec succès.`, type: 'success' }, ...prev]);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression du profil.");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 relative">
      
      {/* Toast Notifications */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {alerts.map((alert) => (
            <motion.div 
              key={alert.id}
              initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => removeAlert(alert.id)}
              className={`p-4 rounded-xl shadow-lg border cursor-pointer flex items-center gap-3 font-medium ${
                alert.type === 'success' ? 'bg-green-500 text-white border-green-600' :
                alert.type === 'warning' ? 'bg-orange-500 text-white border-orange-600' :
                'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700'
              }`}
            >
              <Bell size={20} />
              {alert.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-[#D4AF37]">CFA Control Tower</h1>
            <p className="text-zinc-500">Supervision en temps réel des mises en relation</p>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm">
              <Download size={16} /> Exporter Apprentis
            </button>
            <div className="w-12 h-12 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center shrink-0">
              <ShieldCheck className="text-[#D4AF37]" size={24} />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Liste Apprentis */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex justify-between items-center">
              <h2 className="font-bold text-xl">Suivi Apprentis ({apprentis.length})</h2>
            </div>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 flex-1 overflow-y-auto max-h-[600px]">
              {loading && <div className="p-6 text-zinc-500">Chargement...</div>}
              {!loading && apprentis.length === 0 && <div className="p-6 text-zinc-500">Aucun apprenti.</div>}
              {apprentis.map(a => (
                <Link key={a.profile_id} href={`/admin/profil/${a.profile_id}?role=apprenti`} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors group">
                  <div>
                    <p className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-[#D4AF37] transition-colors">{a.prenom} {a.nom}</p>
                    <p className="text-sm text-zinc-500 capitalize">{a.domaine}</p>
                  </div>
                  <div className="flex items-center flex-wrap justify-end gap-2 sm:gap-3 max-w-[65%] sm:max-w-none ml-2">
                    <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:py-1 border rounded-md shrink-0 ${
                      a.is_approved
                        ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400'
                        : 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400'
                    }`}>
                      {a.is_approved ? 'Validé' : 'En attente'}
                    </span>
                    {!a.is_approved && (
                      <button onClick={(e) => { e.preventDefault(); handleApprove(a.profile_id); }} className="text-[10px] sm:text-xs px-2.5 sm:px-3 py-0.5 sm:py-1 bg-[#D4AF37] text-white font-bold rounded-lg hover:bg-[#B8962E] transition-colors shadow-sm shrink-0">
                        Valider
                      </button>
                    )}
                    <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:py-1 border rounded-md shrink-0 ${a.statusColor}`}>
                      {a.currentStatus}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteProfile(a.profile_id, `${a.prenom} ${a.nom}`);
                      }}
                      className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
                      title="Supprimer le profil"
                    >
                      <Trash2 size={16} />
                    </button>
                    <ChevronRight size={20} className="text-zinc-400 shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Liste Patrons */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <h2 className="font-bold text-xl">Salons inscrits ({patrons.length})</h2>
            </div>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 flex-1 overflow-y-auto max-h-[600px]">
              {loading && <div className="p-6 text-zinc-500">Chargement...</div>}
              {!loading && patrons.length === 0 && <div className="p-6 text-zinc-500">Aucun salon.</div>}
              {patrons.map(p => (
                <Link key={p.profile_id} href={`/admin/profil/${p.profile_id}?role=patron`} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors group">
                  <div>
                    <p className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-[#D4AF37] transition-colors">{p.nom_entreprise}</p>
                    <p className="text-sm text-zinc-500 capitalize">{p.domaine}</p>
                  </div>
                  <div className="flex items-center flex-wrap justify-end gap-2 sm:gap-3 max-w-[65%] sm:max-w-none ml-2">
                    <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:py-1 border rounded-md shrink-0 ${
                      p.is_approved
                        ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400'
                        : 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400'
                    }`}>
                      {p.is_approved ? 'Validé' : 'En attente'}
                    </span>
                    {!p.is_approved && (
                      <button onClick={(e) => { e.preventDefault(); handleApprove(p.profile_id); }} className="text-[10px] sm:text-xs px-2.5 sm:px-3 py-0.5 sm:py-1 bg-[#D4AF37] text-white font-bold rounded-lg hover:bg-[#B8962E] transition-colors shadow-sm shrink-0">
                        Valider
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteProfile(p.profile_id, p.nom_entreprise);
                      }}
                      className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
                      title="Supprimer le profil"
                    >
                      <Trash2 size={16} />
                    </button>
                    <ChevronRight size={20} className="text-zinc-400 shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

        </div>

        {/* Tableau Récapitulatif des Matches */}
        <div className="mt-8 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
            <h2 className="font-bold text-xl">Tableau Récapitulatif des Mises en Relation ({allMatches.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-950/50 text-zinc-500 font-medium">
                <tr>
                  <th className="p-4 border-b border-zinc-200 dark:border-zinc-800">Apprenti</th>
                  <th className="p-4 border-b border-zinc-200 dark:border-zinc-800">Salon / Patron</th>
                  <th className="p-4 border-b border-zinc-200 dark:border-zinc-800">Statut actuel</th>
                  <th className="p-4 border-b border-zinc-200 dark:border-zinc-800">Date du Match</th>
                  <th className="p-4 border-b border-zinc-200 dark:border-zinc-800">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {allMatches.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-zinc-500">Aucun match pour le moment.</td>
                  </tr>
                )}
                {allMatches.map(m => (
                  <tr key={m.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100">{m.apprentiName}</td>
                    <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100">{m.patronName}</td>
                    <td className="p-4">
                      <span className={`text-xs font-bold px-2 py-1 border rounded-md ${
                        m.statut === 'contrat_demande' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400' :
                        m.statut === 'essai_demande' ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400' :
                        'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400'
                      }`}>
                        {m.statut.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-500">{new Date(m.created_at).toLocaleDateString()}</td>
                    <td className="p-4">
                      <Link href={`/admin/profil/${m.apprenti_id}?role=apprenti`} className="text-[#D4AF37] hover:underline font-medium text-xs">
                        Voir apprenti
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
