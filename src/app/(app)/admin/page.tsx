"use client";

import React, { useEffect, useState, useMemo } from 'react';
import {
  ShieldCheck,
  ChevronRight,
  Download,
  Bell,
  Trash2,
  Lock,
  Building2,
  Users,
  GraduationCap,
  Briefcase,
  Heart,
  Plus,
  RefreshCw,
  Search,
  Check,
  Edit2,
  Crown,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();

  // Auth & Roles
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'super_admin' | 'admin_cfa' | null>(null);
  const [adminSchoolId, setAdminSchoolId] = useState<string | null>(null);
  const [isApprovedAdmin, setIsApprovedAdmin] = useState<boolean | null>(null);

  // Structures (Schools)
  const [allSchools, setAllSchools] = useState<{ id: string; name: string; created_at?: string }[]>([]);
  const [viewedSchoolId, setViewedSchoolId] = useState<string>('all');
  const [newSchoolName, setNewSchoolName] = useState('');
  const [showAddSchoolModal, setShowAddSchoolModal] = useState(false);
  const [editingSchoolId, setEditingSchoolId] = useState<string | null>(null);
  const [editingSchoolName, setEditingSchoolName] = useState('');

  // Data
  const [apprentis, setApprentis] = useState<any[]>([]);
  const [patrons, setPatrons] = useState<any[]>([]);
  const [allMatches, setAllMatches] = useState<any[]>([]);
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [orphanProfiles, setOrphanProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // UI State
  const [activeTab, setActiveTab] = useState<'apprentis' | 'patrons' | 'matches' | 'structures' | 'admins' | 'orphans'>('apprentis');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [alerts, setAlerts] = useState<{ id: number; msg: string; type: 'success' | 'warning' | 'info' }[]>([]);

  // Structure Name Helper
  const schoolMap = useMemo(() => {
    const map: Record<string, string> = {};
    allSchools.forEach(s => { map[s.id] = s.name; });
    return map;
  }, [allSchools]);

  // Initial Auth Verification
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) {
        router.push('/login');
      } else {
        setCurrentAdminId(data.user.id);
        supabase
          .from('profiles')
          .select('role, school_id, is_approved')
          .eq('id', data.user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile?.role !== 'admin_cfa' && profile?.role !== 'super_admin') {
              router.push('/swipe');
            } else {
              const role = profile.role as 'super_admin' | 'admin_cfa';
              setUserRole(role);
              setIsApprovedAdmin(role === 'super_admin' ? true : !!profile.is_approved);
              setAdminSchoolId(profile.school_id || null);

              // Set default viewed structure
              if (role === 'super_admin') {
                setViewedSchoolId('all');
              } else {
                setViewedSchoolId(profile.school_id || '');
              }
            }
          });
      }
    });
  }, [router]);

  // Fetch all schools
  const fetchSchools = async () => {
    const { data } = await supabase.from('schools').select('*').order('name');
    if (data) {
      setAllSchools(data);
    }
  };

  useEffect(() => {
    fetchSchools();
  }, []);

  // Main Data Fetcher
  const fetchData = async () => {
    if (!userRole) return;
    setLoading(true);

    try {
      // 1. Fetch profiles based on viewed structure
      let query = supabase
        .from('profiles')
        .select('id, is_approved, role, email, school_id, created_at');

      if (userRole === 'admin_cfa') {
        if (!adminSchoolId) {
          setLoading(false);
          return;
        }
        query = query.eq('school_id', adminSchoolId);
      } else if (userRole === 'super_admin' && viewedSchoolId !== 'all') {
        query = query.eq('school_id', viewedSchoolId);
      }

      const { data: profiles, error: pError } = await query;
      if (pError) throw pError;

      const allProfilesList = profiles || [];

      // Admins (both super_admin and admin_cfa)
      const admins = allProfilesList.filter(p => p.role === 'admin_cfa' || p.role === 'super_admin');
      setAdminsList(admins);

      // Candidate apprentices & patrons
      const candidateApprentis = allProfilesList.filter(p => p.role === 'apprenti');
      const candidatePatrons = allProfilesList.filter(p => p.role === 'patron');

      const appIds = candidateApprentis.map(p => p.id);
      const patIds = candidatePatrons.map(p => p.id);

      // 2. Fetch details
      let appData: any[] = [];
      let patData: any[] = [];

      if (appIds.length > 0) {
        const { data: aData } = await supabase.from('apprentis_details').select('*').in('profile_id', appIds);
        if (aData) appData = aData;
      }

      if (patIds.length > 0) {
        const { data: pData } = await supabase.from('patrons_details').select('*').in('profile_id', patIds);
        if (pData) patData = pData;
      }

      // 3. Detect "Invisible" / Orphan profiles (registered in profiles but missing detail row)
      const foundAppIds = new Set(appData.map(a => a.profile_id));
      const foundPatIds = new Set(patData.map(p => p.profile_id));

      const orphans = allProfilesList.filter(p => {
        if (p.role === 'admin_cfa' || p.role === 'super_admin') return false;
        if (p.role === 'apprenti' && !foundAppIds.has(p.id)) return true;
        if (p.role === 'patron' && !foundPatIds.has(p.id)) return true;
        if (!p.role) return true;
        return false;
      });
      setOrphanProfiles(orphans);

      // 4. Fetch Matches
      let matchesQuery = supabase.from('matches').select('*').order('created_at', { ascending: false });
      if (userRole === 'admin_cfa' || (userRole === 'super_admin' && viewedSchoolId !== 'all')) {
        const targetIds = [...appIds, ...patIds];
        if (targetIds.length > 0) {
          matchesQuery = matchesQuery.or(`apprenti_id.in.(${targetIds.join(',')}),patron_id.in.(${targetIds.join(',')})`);
        } else {
          matchesQuery = matchesQuery.eq('id', '00000000-0000-0000-0000-000000000000'); // empty
        }
      }
      const { data: matches } = await matchesQuery;

      // 5. Build lookup maps
      const approvalMap: Record<string, boolean> = {};
      const schoolIdMap: Record<string, string> = {};
      allProfilesList.forEach(p => {
        approvalMap[p.id] = !!p.is_approved;
        if (p.school_id) schoolIdMap[p.id] = p.school_id;
      });

      const nameMap: Record<string, string> = {};
      appData.forEach(a => { nameMap[a.profile_id] = `${a.prenom} ${a.nom}`; });
      patData.forEach(p => { nameMap[p.profile_id] = p.nom_entreprise; });

      // Enriched Patrons
      setPatrons(
        patData.map(p => ({
          ...p,
          is_approved: approvalMap[p.profile_id] ?? false,
          school_id: schoolIdMap[p.profile_id] || null,
          school_name: schoolMap[schoolIdMap[p.profile_id]] || 'Non assigné'
        }))
      );

      // Enriched Apprentices with Match Status
      const matchesList = matches || [];
      const enrichedApprentis = appData.map(app => {
        const userMatches = matchesList.filter(m => m.apprenti_id === app.profile_id);

        let status = 'Sans match';
        let color = 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400';

        if (userMatches.some(m => m.statut === 'contrat_demande')) {
          status = 'Contrat demandé';
          color = 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400';
        } else if (userMatches.some(m => m.statut === 'essai_demande')) {
          status = 'Essai demandé';
          color = 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400';
        } else if (userMatches.length > 0) {
          status = 'Matché';
          color = 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400';
        }

        return {
          ...app,
          currentStatus: status,
          statusColor: color,
          is_approved: approvalMap[app.profile_id] ?? false,
          school_id: schoolIdMap[app.profile_id] || null,
          school_name: schoolMap[schoolIdMap[app.profile_id]] || 'Non assigné'
        };
      });
      setApprentis(enrichedApprentis);

      // Enriched Matches
      const enrichedMatches = matchesList.map(m => ({
        ...m,
        apprentiName: nameMap[m.apprenti_id] || m.apprenti_id,
        patronName: nameMap[m.patron_id] || m.patron_id,
        schoolName: schoolMap[schoolIdMap[m.apprenti_id]] || 'Structure'
      }));
      setAllMatches(enrichedMatches);

    } catch (err: any) {
      console.error("Erreur lors du chargement des données:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Live subscriptions for realtime updates
    const channel = supabase
      .channel('admin_live_watch')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, () => {
        setAlerts(prev => [{ id: Date.now(), msg: "Nouveau Match détecté en temps réel !", type: 'info' }, ...prev]);
        fetchData();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, (payload) => {
        if (payload.new.statut === 'essai_demande') {
          setAlerts(prev => [{ id: Date.now(), msg: "Demande de période d'essai reçue !", type: 'warning' }, ...prev]);
        }
        if (payload.new.statut === 'contrat_demande') {
          setAlerts(prev => [{ id: Date.now(), msg: "🎉 Intention de contrat déclarée !", type: 'success' }, ...prev]);
        }
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userRole, viewedSchoolId, adminSchoolId]);

  // Actions
  const handleApprove = async (profileId: string, roleName?: string) => {
    try {
      const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('id', profileId);
      if (error) throw error;

      // Déclenchement de la notification push vers l'utilisateur validé
      fetch('/api/push/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profileId,
          title: "Compte Validé ! 🎉",
          body: "Votre compte a été approuvé par l'administration. Vous pouvez maintenant accéder à PHORGE !",
          url: "/swipe"
        })
      }).catch(() => {});

      setAlerts(prev => [{ id: Date.now(), msg: `Le compte a été validé avec succès.`, type: 'success' }, ...prev]);
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert("Erreur lors de la validation du compte : " + err.message);
    }
  };

  const handleDeleteProfile = async (profileId: string, name: string) => {
    const confirmed = window.confirm(
      `Êtes-vous certain de vouloir supprimer définitivement "${name}" ainsi que toutes ses données et photos associées ? Cette action est irréversible.`
    );
    if (!confirmed) return;

    try {
      // 1. Suppression du dossier de photos dans storage
      const { data: files } = await supabase.storage.from('photos').list(profileId);
      if (files && files.length > 0) {
        const paths = files.map(f => `${profileId}/${f.name}`);
        await supabase.storage.from('photos').remove(paths);
      }

      // 2. Suppression de la ligne profiles (cascade)
      const { error } = await supabase.from('profiles').delete().eq('id', profileId);
      if (error) throw error;

      setAlerts(prev => [{ id: Date.now(), msg: `Le profil "${name}" a été supprimé.`, type: 'success' }, ...prev]);
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert("Erreur lors de la suppression : " + err.message);
    }
  };

  // Super Admin: Create Structure
  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName.trim()) return;

    try {
      const { error } = await supabase.from('schools').insert({ name: newSchoolName.trim() });
      if (error) throw error;

      setNewSchoolName('');
      setShowAddSchoolModal(false);
      await fetchSchools();
      setAlerts(prev => [{ id: Date.now(), msg: `Structure "${newSchoolName}" ajoutée avec succès.`, type: 'success' }, ...prev]);
      fetchData();
    } catch (err: any) {
      alert("Erreur lors de la création de la structure : " + err.message);
    }
  };

  // Super Admin: Rename Structure
  const handleRenameSchool = async (schoolId: string) => {
    if (!editingSchoolName.trim()) return;
    try {
      const { error } = await supabase.from('schools').update({ name: editingSchoolName.trim() }).eq('id', schoolId);
      if (error) throw error;

      setEditingSchoolId(null);
      setEditingSchoolName('');
      await fetchSchools();
      setAlerts(prev => [{ id: Date.now(), msg: "Structure renommée avec succès.", type: 'success' }, ...prev]);
      fetchData();
    } catch (err: any) {
      alert("Erreur : " + err.message);
    }
  };

  // Super Admin: Change Admin Role or Structure
  const handleChangeAdminRole = async (adminId: string, newRole: 'super_admin' | 'admin_cfa', newSchoolId?: string | null) => {
    try {
      const updatePayload: any = { role: newRole };
      if (newSchoolId !== undefined) {
        updatePayload.school_id = newSchoolId;
      }
      const { error } = await supabase.from('profiles').update(updatePayload).eq('id', adminId);
      if (error) throw error;

      setAlerts(prev => [{ id: Date.now(), msg: "Rôle/structure de l'administrateur mis à jour.", type: 'success' }, ...prev]);
      fetchData();
    } catch (err: any) {
      alert("Erreur de modification des droits : " + err.message);
    }
  };

  // Export CSV
  const exportCSV = () => {
    const headers = ["Nom", "Prénom", "Domaine", "Structure", "Statut Match", "Validation", "Stage", "Expérience", "Diplôme Souhaité"];
    const rows = filteredApprentis.map(a => [
      a.nom,
      a.prenom,
      a.domaine,
      a.school_name,
      a.currentStatus,
      a.is_approved ? "Validé" : "En attente",
      a.stage_effectue || "",
      a.experience_pro || "",
      a.diplome_souhaite || ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(";"), ...rows.map(e => e.map(cell => `"${cell}"`).join(";"))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `apprentis_phorge_${viewedSchoolId === 'all' ? 'plateforme' : 'structure'}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Filtered Lists
  const filteredApprentis = useMemo(() => {
    return apprentis.filter(a => {
      const matchesSearch = `${a.prenom} ${a.nom} ${a.domaine}`.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ? true :
        statusFilter === 'approved' ? a.is_approved :
        !a.is_approved;
      return matchesSearch && matchesStatus;
    });
  }, [apprentis, searchQuery, statusFilter]);

  const filteredPatrons = useMemo(() => {
    return patrons.filter(p => {
      const matchesSearch = `${p.nom_entreprise} ${p.domaine}`.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ? true :
        statusFilter === 'approved' ? p.is_approved :
        !p.is_approved;
      return matchesSearch && matchesStatus;
    });
  }, [patrons, searchQuery, statusFilter]);

  // Statistics per School (for Super Admin)
  const schoolStats = useMemo(() => {
    const stats: Record<string, { apprentisCount: number; patronsCount: number; adminsCount: number }> = {};
    allSchools.forEach(s => {
      stats[s.id] = { apprentisCount: 0, patronsCount: 0, adminsCount: 0 };
    });

    apprentis.forEach(a => {
      if (a.school_id && stats[a.school_id]) stats[a.school_id].apprentisCount++;
    });
    patrons.forEach(p => {
      if (p.school_id && stats[p.school_id]) stats[p.school_id].patronsCount++;
    });
    adminsList.forEach(adm => {
      if (adm.school_id && stats[adm.school_id]) stats[adm.school_id].adminsCount++;
    });

    return stats;
  }, [allSchools, apprentis, patrons, adminsList]);

  // Non-approved CFA Admin Screen
  if (isApprovedAdmin === false) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="w-16 h-16 mx-auto bg-[#D4AF37]/10 rounded-full flex items-center justify-center mb-6">
            <Lock size={32} className="text-[#D4AF37]" />
          </div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-3">
            Compte en attente de validation 🔑
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6 leading-relaxed">
            Votre compte administrateur a bien été créé. Cependant, pour garantir la sécurité de votre établissement, il doit être validé par un Super-Administrateur ou un·e collègue de votre CFA.
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/login');
            }}
            className="py-3 px-6 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold rounded-2xl transition-colors text-sm"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 sm:p-8 relative">
      
      {/* Toast Alerts Flottants */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full">
        <AnimatePresence>
          {alerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}
              className={`p-4 rounded-2xl shadow-xl border cursor-pointer flex items-center gap-3 font-semibold text-sm ${
                alert.type === 'success' ? 'bg-green-600 text-white border-green-700 shadow-green-500/20' :
                alert.type === 'warning' ? 'bg-orange-600 text-white border-orange-700 shadow-orange-500/20' :
                'bg-zinc-900 text-white border-zinc-800 shadow-black/20'
              }`}
            >
              <Bell size={18} className="shrink-0" />
              <span className="flex-1">{alert.msg}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">

        {/* 1. HEADER CONTROL TOWER */}
        <header className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-[#D4AF37] tracking-tight">
                {userRole === 'super_admin' ? 'PHORGE Master Tower' : 'CFA Control Tower'}
              </h1>
              {userRole === 'super_admin' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
                  <Crown size={14} /> Super Administrateur (Plateforme)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <ShieldCheck size={14} /> Admin de Structure — {schoolMap[adminSchoolId || ''] || 'CFA'}
                </span>
              )}
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              {userRole === 'super_admin'
                ? 'Supervision globale de l\'ensemble des CFA, apprentis, entreprises et administrateurs.'
                : `Gestion et validation des apprentis et entreprises rattachés à votre établissement.`}
            </p>
          </div>

          {/* Actions & Sélecteur de Structure */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
            {userRole === 'super_admin' && (
              <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                <Building2 size={16} className="text-zinc-500 ml-2" />
                <select
                  value={viewedSchoolId}
                  onChange={(e) => setViewedSchoolId(e.target.value)}
                  className="bg-transparent text-sm font-bold text-zinc-900 dark:text-zinc-100 outline-none pr-3 py-1 cursor-pointer"
                >
                  <option value="all">🌍 Toutes les structures (Plateforme globale)</option>
                  {allSchools.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-all shadow-sm"
              title="Exporter au format CSV"
            >
              <Download size={14} /> Exporter CSV
            </button>

            <button
              onClick={() => fetchData()}
              className="p-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl transition-all shadow-sm"
              title="Rafraîchir les données"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </header>

        {/* 2. STATS KPI CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {userRole === 'super_admin' && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-bold uppercase mb-2">
                <span>Structures</span>
                <Building2 size={18} className="text-[#D4AF37]" />
              </div>
              <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{allSchools.length}</div>
              <span className="text-xs text-zinc-400">Écoles & CFA enregistrés</span>
            </div>
          )}

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 text-xs font-bold uppercase mb-2">
              <span>Apprenti·e·s</span>
              <GraduationCap size={18} className="text-blue-500" />
            </div>
            <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{apprentis.length}</div>
            <span className="text-xs text-zinc-400">{apprentis.filter(a => a.is_approved).length} validé·e·s</span>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 text-xs font-bold uppercase mb-2">
              <span>Entreprises</span>
              <Briefcase size={18} className="text-purple-500" />
            </div>
            <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{patrons.length}</div>
            <span className="text-xs text-zinc-400">{patrons.filter(p => p.is_approved).length} validées</span>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 text-xs font-bold uppercase mb-2">
              <span>Mises en relation</span>
              <Heart size={18} className="text-red-500 fill-red-500/20" />
            </div>
            <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{allMatches.length}</div>
            <span className="text-xs text-zinc-400">Matches enregistrés</span>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 text-xs font-bold uppercase mb-2">
              <span>Nettoyage</span>
              <AlertTriangle size={18} className="text-orange-500" />
            </div>
            <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{orphanProfiles.length}</div>
            <span className="text-xs text-zinc-400">Comptes invisibles/incomplets</span>
          </div>
        </div>

        {/* 3. BARRE D'ONGLETS & FILTRES */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
            <button
              onClick={() => setActiveTab('apprentis')}
              className={`px-4 py-2.5 rounded-2xl font-bold text-xs whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === 'apprentis'
                  ? 'bg-[#D4AF37] text-white shadow-md shadow-[#D4AF37]/20'
                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
              }`}
            >
              <GraduationCap size={16} /> Apprenti·e·s ({apprentis.length})
            </button>

            <button
              onClick={() => setActiveTab('patrons')}
              className={`px-4 py-2.5 rounded-2xl font-bold text-xs whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === 'patrons'
                  ? 'bg-[#D4AF37] text-white shadow-md shadow-[#D4AF37]/20'
                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
              }`}
            >
              <Briefcase size={16} /> Entreprises ({patrons.length})
            </button>

            <button
              onClick={() => setActiveTab('matches')}
              className={`px-4 py-2.5 rounded-2xl font-bold text-xs whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === 'matches'
                  ? 'bg-[#D4AF37] text-white shadow-md shadow-[#D4AF37]/20'
                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
              }`}
            >
              <Heart size={16} /> Matches ({allMatches.length})
            </button>

            {userRole === 'super_admin' && (
              <button
                onClick={() => setActiveTab('structures')}
                className={`px-4 py-2.5 rounded-2xl font-bold text-xs whitespace-nowrap transition-all flex items-center gap-2 ${
                  activeTab === 'structures'
                    ? 'bg-[#D4AF37] text-white shadow-md shadow-[#D4AF37]/20'
                    : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                }`}
              >
                <Building2 size={16} /> Structures ({allSchools.length})
              </button>
            )}

            <button
              onClick={() => setActiveTab('admins')}
              className={`px-4 py-2.5 rounded-2xl font-bold text-xs whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === 'admins'
                  ? 'bg-[#D4AF37] text-white shadow-md shadow-[#D4AF37]/20'
                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
              }`}
            >
              <Users size={16} /> Équipe Admins ({adminsList.length})
            </button>

            <button
              onClick={() => setActiveTab('orphans')}
              className={`px-4 py-2.5 rounded-2xl font-bold text-xs whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === 'orphans'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
              }`}
            >
              <Trash2 size={16} /> Incomplets / Invisibles ({orphanProfiles.length})
            </button>
          </div>

          {/* Recherche & Filtre de statut pour apprentis/patrons */}
          {(activeTab === 'apprentis' || activeTab === 'patrons') && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-60">
                <Search size={14} className="absolute left-3 top-3 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#D4AF37] text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-zinc-100 dark:bg-zinc-800 py-2 px-3 rounded-xl text-xs font-bold text-zinc-800 dark:text-zinc-200 outline-none cursor-pointer"
              >
                <option value="all">Tous</option>
                <option value="pending">En attente</option>
                <option value="approved">Validés</option>
              </select>
            </div>
          )}
        </div>

        {/* 4. CONTENU DES ONGLETS */}

        {/* TAB: APPRENTIS */}
        {activeTab === 'apprentis' && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
              <h2 className="font-extrabold text-lg">Suivi des Apprenti·e·s ({filteredApprentis.length})</h2>
              {userRole === 'super_admin' && (
                <span className="text-xs font-semibold text-zinc-400">
                  Vue : {viewedSchoolId === 'all' ? 'Toutes les structures' : schoolMap[viewedSchoolId]}
                </span>
              )}
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 overflow-y-auto max-h-[650px]">
              {loading && <div className="p-8 text-center text-zinc-400">Chargement des profils...</div>}
              {!loading && filteredApprentis.length === 0 && (
                <div className="p-8 text-center text-zinc-400">Aucun·e apprenti·e correspondant aux critères.</div>
              )}
              {filteredApprentis.map(a => (
                <div key={a.profile_id} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center font-black text-sm text-[#D4AF37]">
                      {a.photo_profil ? (
                        <img src={a.photo_profil} alt={a.nom} className="w-full h-full object-cover" />
                      ) : (
                        <span>{a.prenom?.[0]}{a.nom?.[0]}</span>
                      )}
                    </div>
                    <div>
                      <Link
                        href={`/admin/profil/${a.profile_id}?role=apprenti`}
                        className="font-bold text-zinc-900 dark:text-zinc-100 hover:text-[#D4AF37] transition-colors text-base flex items-center gap-2"
                      >
                        {a.prenom} {a.nom}
                        <ChevronRight size={14} className="text-zinc-400" />
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs text-zinc-500 capitalize">{a.domaine}</span>
                        {userRole === 'super_admin' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-md">
                            🏛️ {a.school_name}
                          </span>
                        )}
                        {a.diplome_souhaite && (
                          <span className="text-[10px] text-zinc-400 italic">· {a.diplome_souhaite}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center flex-wrap gap-2 justify-end">
                    <span className={`text-xs font-bold px-2.5 py-1 border rounded-lg shrink-0 ${a.statusColor}`}>
                      {a.currentStatus}
                    </span>

                    <span className={`text-xs font-bold px-2.5 py-1 border rounded-lg shrink-0 ${
                      a.is_approved
                        ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400'
                        : 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400'
                    }`}>
                      {a.is_approved ? 'Validé·e' : 'En attente'}
                    </span>

                    {!a.is_approved && (
                      <button
                        onClick={() => handleApprove(a.profile_id, 'apprenti')}
                        className="text-xs px-3 py-1.5 bg-[#D4AF37] hover:bg-[#B8962E] text-white font-bold rounded-xl transition-colors shadow-sm flex items-center gap-1 shrink-0"
                      >
                        <Check size={14} /> Valider
                      </button>
                    )}

                    <Link
                      href={`/admin/profil/${a.profile_id}?role=apprenti`}
                      className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-xl transition-colors shrink-0"
                    >
                      Détails
                    </Link>

                    <button
                      onClick={() => handleDeleteProfile(a.profile_id, `${a.prenom} ${a.nom}`)}
                      className="p-2 text-zinc-400 hover:text-red-500 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
                      title="Supprimer définitivement le profil et ses fichiers"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: PATRONS */}
        {activeTab === 'patrons' && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
              <h2 className="font-extrabold text-lg">Entreprises Inscrites ({filteredPatrons.length})</h2>
              {userRole === 'super_admin' && (
                <span className="text-xs font-semibold text-zinc-400">
                  Vue : {viewedSchoolId === 'all' ? 'Toutes les structures' : schoolMap[viewedSchoolId]}
                </span>
              )}
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 overflow-y-auto max-h-[650px]">
              {loading && <div className="p-8 text-center text-zinc-400">Chargement des entreprises...</div>}
              {!loading && filteredPatrons.length === 0 && (
                <div className="p-8 text-center text-zinc-400">Aucune entreprise trouvée.</div>
              )}
              {filteredPatrons.map(p => (
                <div key={p.profile_id} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center font-black text-sm text-[#D4AF37]">
                      {p.photo_profil ? (
                        <img src={p.photo_profil} alt={p.nom_entreprise} className="w-full h-full object-cover" />
                      ) : (
                        <span>{p.nom_entreprise?.[0]}</span>
                      )}
                    </div>
                    <div>
                      <Link
                        href={`/admin/profil/${p.profile_id}?role=patron`}
                        className="font-bold text-zinc-900 dark:text-zinc-100 hover:text-[#D4AF37] transition-colors text-base flex items-center gap-2"
                      >
                        {p.nom_entreprise}
                        <ChevronRight size={14} className="text-zinc-400" />
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs text-zinc-500 capitalize">{p.domaine}</span>
                        {userRole === 'super_admin' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-md">
                            🏛️ {p.school_name}
                          </span>
                        )}
                        {p.adresse && <span className="text-[10px] text-zinc-400">· {p.adresse}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center flex-wrap gap-2 justify-end">
                    <span className={`text-xs font-bold px-2.5 py-1 border rounded-lg shrink-0 ${
                      p.is_approved
                        ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400'
                        : 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400'
                    }`}>
                      {p.is_approved ? 'Validée' : 'En attente'}
                    </span>

                    {!p.is_approved && (
                      <button
                        onClick={() => handleApprove(p.profile_id, 'patron')}
                        className="text-xs px-3 py-1.5 bg-[#D4AF37] hover:bg-[#B8962E] text-white font-bold rounded-xl transition-colors shadow-sm flex items-center gap-1 shrink-0"
                      >
                        <Check size={14} /> Valider
                      </button>
                    )}

                    <Link
                      href={`/admin/profil/${p.profile_id}?role=patron`}
                      className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-xl transition-colors shrink-0"
                    >
                      Détails
                    </Link>

                    <button
                      onClick={() => handleDeleteProfile(p.profile_id, p.nom_entreprise)}
                      className="p-2 text-zinc-400 hover:text-red-500 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
                      title="Supprimer définitivement l'entreprise et ses fichiers"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: MATCHES */}
        {activeTab === 'matches' && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
              <h2 className="font-extrabold text-lg">Mises en Relation & Discussions ({allMatches.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-950/50 text-zinc-500 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4 border-b border-zinc-200 dark:border-zinc-800">Apprenti·e</th>
                    <th className="p-4 border-b border-zinc-200 dark:border-zinc-800">Entreprise</th>
                    {userRole === 'super_admin' && (
                      <th className="p-4 border-b border-zinc-200 dark:border-zinc-800">Structure</th>
                    )}
                    <th className="p-4 border-b border-zinc-200 dark:border-zinc-800">Statut</th>
                    <th className="p-4 border-b border-zinc-200 dark:border-zinc-800">Date du Match</th>
                    <th className="p-4 border-b border-zinc-200 dark:border-zinc-800">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {allMatches.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-400">Aucun match enregistré.</td>
                    </tr>
                  )}
                  {allMatches.map(m => (
                    <tr key={m.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100">
                        <Link href={`/admin/profil/${m.apprenti_id}?role=apprenti`} className="hover:text-[#D4AF37] transition-colors">
                          {m.apprentiName}
                        </Link>
                      </td>
                      <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100">
                        <Link href={`/admin/profil/${m.patron_id}?role=patron`} className="hover:text-[#D4AF37] transition-colors">
                          {m.patronName}
                        </Link>
                      </td>
                      {userRole === 'super_admin' && (
                        <td className="p-4 text-xs font-semibold text-zinc-500">
                          {m.schoolName}
                        </td>
                      )}
                      <td className="p-4">
                        <span className={`text-xs font-bold px-2.5 py-1 border rounded-lg ${
                          m.statut === 'contrat_demande' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400' :
                          m.statut === 'essai_demande' ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400' :
                          'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400'
                        }`}>
                          {m.statut.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-zinc-500">
                        {new Date(m.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <Link
                          href={`/admin/profil/${m.apprenti_id}?role=apprenti`}
                          className="text-[#D4AF37] hover:underline font-bold text-xs"
                        >
                          Voir l&apos;apprenti·e
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: STRUCTURES (SUPER ADMIN ONLY) */}
        {userRole === 'super_admin' && activeTab === 'structures' && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden space-y-6 p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="font-extrabold text-xl flex items-center gap-2">
                  <Building2 className="text-[#D4AF37]" size={22} /> Gestion des Structures & CFA ({allSchools.length})
                </h2>
                <p className="text-sm text-zinc-500 mt-0.5">
                  Créer et administrer les établissements indépendants de la plateforme.
                </p>
              </div>

              <button
                onClick={() => setShowAddSchoolModal(true)}
                className="px-4 py-2.5 bg-[#D4AF37] hover:bg-[#B8962E] text-white font-bold rounded-2xl text-xs transition-all shadow-md shadow-[#D4AF37]/20 flex items-center gap-2"
              >
                <Plus size={16} /> Nouvelle Structure
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allSchools.map(s => {
                const stat = schoolStats[s.id] || { apprentisCount: 0, patronsCount: 0, adminsCount: 0 };
                const isEditing = editingSchoolId === s.id;

                return (
                  <div key={s.id} className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      {isEditing ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editingSchoolName}
                            onChange={(e) => setEditingSchoolName(e.target.value)}
                            className="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-bold"
                          />
                          <button
                            onClick={() => handleRenameSchool(s.id)}
                            className="p-2 bg-green-500 text-white rounded-xl hover:bg-green-600"
                          >
                            <Check size={16} />
                          </button>
                        </div>
                      ) : (
                        <h3 className="font-black text-lg text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          <Building2 size={18} className="text-[#D4AF37]" /> {s.name}
                        </h3>
                      )}

                      {!isEditing && (
                        <button
                          onClick={() => {
                            setEditingSchoolId(s.id);
                            setEditingSchoolName(s.name);
                          }}
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
                          title="Renommer la structure"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-white dark:bg-zinc-900/60 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800">
                        <span className="block font-black text-base text-blue-500">{stat.apprentisCount}</span>
                        <span className="text-[10px] text-zinc-400">Apprentis</span>
                      </div>
                      <div className="bg-white dark:bg-zinc-900/60 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800">
                        <span className="block font-black text-base text-purple-500">{stat.patronsCount}</span>
                        <span className="text-[10px] text-zinc-400">Entreprises</span>
                      </div>
                      <div className="bg-white dark:bg-zinc-900/60 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800">
                        <span className="block font-black text-base text-[#D4AF37]">{stat.adminsCount}</span>
                        <span className="text-[10px] text-zinc-400">Admins</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 text-xs">
                      <button
                        onClick={() => {
                          setViewedSchoolId(s.id);
                          setActiveTab('apprentis');
                        }}
                        className="text-[#D4AF37] font-bold hover:underline"
                      >
                        Filtrer sur ce CFA →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: ADMINS (GESTION DES DROITS & MULTI-STRUCTURES) */}
        {activeTab === 'admins' && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-between items-center">
              <div>
                <h2 className="font-extrabold text-lg flex items-center gap-2">
                  <ShieldCheck size={20} className="text-[#D4AF37]" /> Équipe Administrative & Droits d&apos;Accès ({adminsList.length})
                </h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Gestion des Super-Administrateurs de la plateforme et des Administrateurs rattachés à chaque structure.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-950/50 text-zinc-500 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4 border-b border-zinc-200 dark:border-zinc-800">Email</th>
                    <th className="p-4 border-b border-zinc-200 dark:border-zinc-800">Rôle Actuel</th>
                    <th className="p-4 border-b border-zinc-200 dark:border-zinc-800">Structure Assignée</th>
                    <th className="p-4 border-b border-zinc-200 dark:border-zinc-800">Statut</th>
                    <th className="p-4 border-b border-zinc-200 dark:border-zinc-800">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {adminsList.map(admin => {
                    const isSelf = admin.id === currentAdminId;
                    const isSuper = admin.role === 'super_admin';

                    return (
                      <tr key={admin.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          {admin.email || admin.id}
                          {isSelf && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                              Vous
                            </span>
                          )}
                        </td>

                        <td className="p-4">
                          {isSuper ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
                              <Crown size={14} /> Super Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                              <ShieldCheck size={14} /> Admin Structure
                            </span>
                          )}
                        </td>

                        <td className="p-4">
                          {userRole === 'super_admin' && !isSelf ? (
                            <select
                              value={admin.school_id || ''}
                              onChange={(e) => handleChangeAdminRole(admin.id, admin.role, e.target.value || null)}
                              className="p-1.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-semibold outline-none cursor-pointer"
                            >
                              <option value="">Non assigné</option>
                              {allSchools.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-zinc-500 font-medium">
                              {isSuper ? '🌍 Toute la plateforme' : (schoolMap[admin.school_id] || 'Non assigné')}
                            </span>
                          )}
                        </td>

                        <td className="p-4">
                          <span className={`text-xs font-bold px-2.5 py-1 border rounded-lg ${
                            admin.is_approved
                              ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400'
                              : 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400'
                          }`}>
                            {admin.is_approved ? 'Validé' : 'En attente'}
                          </span>
                        </td>

                        <td className="p-4 flex items-center gap-2">
                          {!admin.is_approved && (
                            <button
                              onClick={() => handleApprove(admin.id, 'admin')}
                              className="px-3 py-1 bg-[#D4AF37] hover:bg-[#B8962E] text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
                            >
                              Approuver
                            </button>
                          )}

                          {userRole === 'super_admin' && !isSelf && (
                            <>
                              {isSuper ? (
                                <button
                                  onClick={() => handleChangeAdminRole(admin.id, 'admin_cfa', admin.school_id)}
                                  className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold rounded-lg text-xs transition-colors"
                                  title="Rétrograder en administrateur de structure"
                                >
                                  Passer Admin Structure
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleChangeAdminRole(admin.id, 'super_admin', null)}
                                  className="px-2.5 py-1 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/25 text-[#D4AF37] font-bold rounded-lg text-xs transition-colors flex items-center gap-1"
                                  title="Promouvoir au rang de super-administrateur"
                                >
                                  <Crown size={12} /> Promouvoir Super Admin
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteProfile(admin.id, admin.email || 'Membre')}
                                className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                title="Supprimer le compte"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: ORPHANS & INVISIBLES (NETTOYAGE DU TRI DES FICHIERS) */}
        {activeTab === 'orphans' && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="font-extrabold text-xl flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <Trash2 size={22} /> Nettoyage des Comptes & Fichiers Invisibles ({orphanProfiles.length})
                </h2>
                <p className="text-sm text-zinc-500 mt-1">
                  Ce module identifie les inscriptions incomplètes, profils fantômes et fichiers orphelins qui n&apos;apparaissaient pas dans les listings standards.
                </p>
              </div>

              {orphanProfiles.length > 0 && (
                <button
                  onClick={async () => {
                    const ok = window.confirm(`Voulez-vous supprimer l'intégralité des ${orphanProfiles.length} comptes incomplets et leurs fichiers de stockage associés ?`);
                    if (!ok) return;
                    for (const p of orphanProfiles) {
                      await handleDeleteProfile(p.id, p.email || 'Compte fantôme');
                    }
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-xs transition-colors shadow-md flex items-center gap-2"
                >
                  <Trash2 size={14} /> Tout Nettoyer ({orphanProfiles.length})
                </button>
              )}
            </div>

            {orphanProfiles.length === 0 ? (
              <div className="p-12 text-center bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <Sparkles size={40} className="text-green-500 mx-auto mb-3" />
                <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">Base de données propre !</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Aucun profil incomplet ou fichier fantôme n&apos;a été détecté sur votre plateforme.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                {orphanProfiles.map(p => (
                  <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <div>
                      <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{p.email || p.id}</div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                        <span>Rôle choisi : <strong className="capitalize">{p.role || 'Non renseigné'}</strong></span>
                        <span>· Inscrit le : {new Date(p.created_at).toLocaleDateString()}</span>
                        <span>· Structure : {schoolMap[p.school_id] || 'Non assigné'}</span>
                      </div>
                      <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 rounded-md">
                        ⚠️ Onboarding non finalisé (aucune fiche détaillée)
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteProfile(p.id, p.email || 'Compte incomplet')}
                      className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      <Trash2 size={14} /> Supprimer et purger fichiers
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* MODAL: AJOUT DE STRUCTURE (SUPER ADMIN) */}
      <AnimatePresence>
        {showAddSchoolModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="font-black text-xl flex items-center gap-2">
                  <Building2 size={22} className="text-[#D4AF37]" /> Nouvelle Structure
                </h3>
                <button
                  onClick={() => setShowAddSchoolModal(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddSchool} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                    Nom du CFA / École / Établissement
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: CFA Nîmes, École de Coiffure Montpellier..."
                    value={newSchoolName}
                    onChange={(e) => setNewSchoolName(e.target.value)}
                    className="w-full p-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#D4AF37] text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddSchoolModal(false)}
                    className="py-2.5 px-4 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 px-5 bg-[#D4AF37] hover:bg-[#B8962E] text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-[#D4AF37]/20"
                  >
                    Créer la Structure
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
