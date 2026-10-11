"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Bell, Heart, MessageCircle, ShieldCheck, CheckCircle2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  registerNotificationServiceWorker,
  showPushNotification,
  subscribeUserToPush,
  playNotificationChime
} from "@/lib/notifications";

type ToastAlert = {
  id: string;
  title: string;
  body: string;
  type?: 'match' | 'message' | 'approval' | 'contract' | 'admin' | 'info';
  url?: string;
};

export default function PushNotifications() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const userIdRef = useRef<string | null>(null);
  const roleRef = useRef<string | null>(null);
  const schoolIdRef = useRef<string | null>(null);
  const domainRef = useRef<string | null>(null);
  const matchIdsRef = useRef<Set<string>>(new Set());

  const [showPrompt, setShowPrompt] = useState(false);
  const [toasts, setToasts] = useState<ToastAlert[]>([]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const addToast = (toast: Omit<ToastAlert, 'id'>) => {
    const id = `${Date.now()}_${Math.random()}`;
    const newToast: ToastAlert = { ...toast, id };
    setToasts(prev => [newToast, ...prev].slice(0, 5)); // Keep max 5 toasts
    playNotificationChime();

    // Auto-dismiss after 6s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const setup = async () => {
      await registerNotificationServiceWorker();

      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "default" && !localStorage.getItem("phorge_notifications_prompted")) {
          setShowPrompt(true);
        } else if (Notification.permission === "granted") {
          // Si déjà accordé, synchroniser l'abonnement push
          try {
            await subscribeUserToPush();
          } catch (e) {
            console.debug("Silent push sync notice:", e);
          }
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      userIdRef.current = user.id;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, school_id")
        .eq("id", user.id)
        .single();
      roleRef.current = profile?.role || null;
      schoolIdRef.current = profile?.school_id || null;

      // Récupération du domaine de métier
      if (profile?.role === "apprenti") {
        const { data: details } = await supabase
          .from("apprentis_details")
          .select("domaine")
          .eq("profile_id", user.id)
          .single();
        domainRef.current = details?.domaine || null;
      } else if (profile?.role === "patron") {
        const { data: details } = await supabase
          .from("patrons_details")
          .select("domaine")
          .eq("profile_id", user.id)
          .single();
        domainRef.current = details?.domaine || null;
      }

      // Récupération des matches actifs de l'utilisateur
      const { data: matches } = await supabase
        .from("matches")
        .select("id, apprenti_id, patron_id, statut")
        .or(`apprenti_id.eq.${user.id},patron_id.eq.${user.id}`);

      matchIdsRef.current = new Set((matches || []).map((m) => m.id));

      channel = supabase
        .channel(`push_notifications_hub_${user.id}`)
        // 1. Écoute des mises à jour de profils (Validation)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles" },
          async (payload) => {
            const oldApproved = (payload.old as any)?.is_approved;
            const newApproved = (payload.new as any)?.is_approved;
            const targetId = (payload.new as any)?.id;
            const targetRole = (payload.new as any)?.role;

            // CAS A : Mon propre compte vient d'être validé !
            if (targetId === userIdRef.current && newApproved && !oldApproved) {
              addToast({
                title: "Compte Validé ! 🎉",
                body: "Votre profil a été approuvé par l'administration. Bienvenue sur PHORGE !",
                type: "approval",
                url: "/swipe"
              });
              await showPushNotification("Compte validé ! 🎉", {
                body: "Votre profil a été approuvé. Vous avez désormais plein accès !",
                tag: "self-approved",
                url: "/swipe"
              });
              return;
            }

            // CAS B : Un profil de mon domaine a été validé
            if (newApproved && !oldApproved && targetId !== userIdRef.current) {
              const targetSchoolId = (payload.new as any)?.school_id;
              if (schoolIdRef.current && targetSchoolId && targetSchoolId !== schoolIdRef.current && roleRef.current !== 'super_admin') {
                return;
              }
              const myRole = roleRef.current;
              const myDomain = domainRef.current;
              if (!myRole || !myDomain) return;

              if (myRole === "apprenti" && targetRole === "patron") {
                const { data: details } = await supabase
                  .from("patrons_details")
                  .select("nom_entreprise, domaine")
                  .eq("profile_id", targetId)
                  .single();
                if (details && details.domaine === myDomain) {
                  addToast({
                    title: "Nouvelle entreprise disponible !",
                    body: `"${details.nom_entreprise}" vient d'arriver sur la plateforme.`,
                    type: "info",
                    url: "/swipe"
                  });
                  await showPushNotification("Nouvelle entreprise disponible !", {
                    body: `L'entreprise "${details.nom_entreprise}" a été approuvée.`,
                    tag: `approved-profile-${targetId}`,
                    url: "/swipe",
                  });
                }
              } else if (myRole === "patron" && targetRole === "apprenti") {
                const { data: details } = await supabase
                  .from("apprentis_details")
                  .select("prenom, nom, domaine")
                  .eq("profile_id", targetId)
                  .single();
                if (details && details.domaine === myDomain) {
                  addToast({
                    title: "Nouvel apprenti disponible !",
                    body: `${details.prenom} ${details.nom} recherche un employeur.`,
                    type: "info",
                    url: "/swipe"
                  });
                  await showPushNotification("Nouvel apprenti disponible !", {
                    body: `${details.prenom} ${details.nom} a été approuvé.`,
                    tag: `approved-profile-${targetId}`,
                    url: "/swipe",
                  });
                }
              }
            }
          }
        )
        // 2. Écoute des nouveaux comptes à valider (Pour les Admins)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "profiles" },
          async (payload) => {
            const isAdmin = roleRef.current === "admin_cfa" || roleRef.current === "super_admin";
            if (!isAdmin) return;

            const newProfile = payload.new as any;
            if (roleRef.current === "admin_cfa" && newProfile.school_id && newProfile.school_id !== schoolIdRef.current) {
              return;
            }

            if (!newProfile.is_approved) {
              addToast({
                title: "Nouveau compte à valider 👤",
                body: `Un nouvel utilisateur (${newProfile.email}) s'est inscrit.`,
                type: "admin",
                url: "/admin"
              });
              await showPushNotification("Nouveau compte à valider (CFA)", {
                body: `Inscription de ${newProfile.email} en attente de validation.`,
                tag: `admin-new-user-${newProfile.id}`,
                url: "/admin"
              });
            }
          }
        )
        // 3. Écoute des nouveaux Matches
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "matches" },
          async (payload) => {
            const match = payload.new as any;
            const uid = userIdRef.current;
            if (!uid) return;

            const isParticipant = match.apprenti_id === uid || match.patron_id === uid;
            const isAdmin = roleRef.current === "admin_cfa" || roleRef.current === "super_admin";

            if (isParticipant) {
              matchIdsRef.current.add(match.id);
              addToast({
                title: "Nouveau Match ! 🎉",
                body: "Félicitations, vous avez une nouvelle mise en relation !",
                type: "match",
                url: `/chat/${match.id}`
              });
              await showPushNotification("Nouveau match !", {
                body: "Vous avez une nouvelle mise en relation. Cliquez pour discuter !",
                tag: `match-${match.id}`,
                url: `/chat/${match.id}`,
              });
            } else if (isAdmin) {
              addToast({
                title: "Nouveau Match (CFA)",
                body: "Une nouvelle mise en relation a eu lieu sur votre structure.",
                type: "admin",
                url: "/admin"
              });
              await showPushNotification("Nouveau match (CFA)", {
                body: "Une nouvelle mise en relation a été créée.",
                tag: `admin-match-${match.id}`,
                url: "/admin",
              });
            }
          }
        )
        // 4. Écoute des changements de statut des Matches (Essais & Contrats)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "matches" },
          async (payload) => {
            const match = payload.new as any;
            const old = payload.old as any;
            const uid = userIdRef.current;
            if (!uid || match.statut === old.statut) return;

            const isParticipant = match.apprenti_id === uid || match.patron_id === uid;
            const isAdmin = roleRef.current === "admin_cfa" || roleRef.current === "super_admin";

            if (match.statut === "essai_demande" && (isParticipant || isAdmin)) {
              addToast({
                title: "Demande de période d'essai 📢",
                body: isAdmin
                  ? "Une entreprise a demandé une période d'essai."
                  : "Une demande de période d'essai a été envoyée au CFA.",
                type: "contract",
                url: isAdmin ? "/admin" : `/chat/${match.id}`
              });
              await showPushNotification("Demande de période d'essai", {
                body: isAdmin
                  ? "Une entreprise a demandé une période d'essai."
                  : "Une demande de période d'essai a été envoyée au CFA.",
                tag: `essai-${match.id}`,
                url: isAdmin ? "/admin" : `/chat/${match.id}`,
              });
            }

            if (match.statut === "contrat_demande" && (isParticipant || isAdmin)) {
              addToast({
                title: "Intention de contrat déclarée ! ✍️",
                body: isAdmin
                  ? "Une entreprise a déclaré une intention de contrat."
                  : "Une intention de contrat d'apprentissage a été envoyée au CFA.",
                type: "contract",
                url: isAdmin ? "/admin" : `/chat/${match.id}`
              });
              await showPushNotification("Demande de contrat", {
                body: isAdmin
                  ? "Une entreprise a déclaré une intention de contrat."
                  : "Une intention de contrat a été déclarée au CFA.",
                tag: `contrat-${match.id}`,
                url: isAdmin ? "/admin" : `/chat/${match.id}`,
              });
            }
          }
        )
        // 5. Écoute des Messages
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          async (payload) => {
            const message = payload.new as any;
            const uid = userIdRef.current;
            if (!uid || message.expediteur_id === uid) return;

            // Vérification de participation au match si non présent dans le cache
            if (!matchIdsRef.current.has(message.match_id)) {
              const { data: match } = await supabase
                .from("matches")
                .select("id")
                .eq("id", message.match_id)
                .or(`apprenti_id.eq.${uid},patron_id.eq.${uid}`)
                .maybeSingle();
              if (match) matchIdsRef.current.add(match.id);
            }

            if (!matchIdsRef.current.has(message.match_id)) return;

            const onThisChat = pathnameRef.current === `/chat/${message.match_id}`;
            if (onThisChat && document.visibilityState === "visible") return;

            addToast({
              title: "Nouveau message 💬",
              body: message.texte.slice(0, 90),
              type: "message",
              url: `/chat/${message.match_id}`
            });

            await showPushNotification("Nouveau message", {
              body: message.texte.slice(0, 120),
              tag: `msg-${message.match_id}`,
              url: `/chat/${message.match_id}`,
            });
          }
        )
        .subscribe();
    };

    setup();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const handleEnable = async () => {
    localStorage.setItem("phorge_notifications_prompted", "true");
    setShowPrompt(false);
    try {
      await subscribeUserToPush();
      addToast({
        title: "Notifications activées !",
        body: "Vous serez prévenu·e immédiatement de chaque nouveau message ou match.",
        type: "info"
      });
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("phorge_notifications_prompted", "true");
    setShowPrompt(false);
  };

  const getToastIcon = (type?: string) => {
    switch (type) {
      case 'match': return <Heart size={20} className="text-[#D4AF37] fill-[#D4AF37]" />;
      case 'message': return <MessageCircle size={20} className="text-blue-500" />;
      case 'approval': return <CheckCircle2 size={20} className="text-green-500" />;
      case 'contract': return <ShieldCheck size={20} className="text-purple-500" />;
      case 'admin': return <Bell size={20} className="text-orange-500" />;
      default: return <Bell size={20} className="text-[#D4AF37]" />;
    }
  };

  return (
    <>
      {/* 1. Toasts flottants en haut à droite */}
      <div className="fixed top-5 right-5 z-[999] flex flex-col gap-3 pointer-events-none max-w-sm w-full px-4 sm:px-0">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              onClick={() => {
                if (toast.url) router.push(toast.url);
                removeToast(toast.id);
              }}
              className="pointer-events-auto bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-4 flex items-start gap-3 cursor-pointer hover:border-[#D4AF37] transition-all group"
            >
              <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 shrink-0 mt-0.5">
                {getToastIcon(toast.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-[#D4AF37] transition-colors leading-tight">
                  {toast.title}
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                  {toast.body}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeToast(toast.id);
                }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 2. Modal d'invitation à activer les notifications */}
      {showPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-[#D4AF37]/10 to-transparent"></div>
            
            <div className="relative z-10">
              <div className="w-16 h-16 mx-auto bg-[#D4AF37]/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <Bell size={32} className="text-[#D4AF37]" />
              </div>

              <h2 className="text-xl font-black text-zinc-900 dark:text-white mb-2">
                Activez les alertes en direct 🔔
              </h2>
              
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8 leading-relaxed">
                Soyez alerté·e instantanément dès qu&apos;une entreprise ou un·e apprenti·e vous match, ou qu&apos;un nouveau message vous attend !
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleEnable}
                  className="py-3.5 px-6 bg-[#D4AF37] hover:bg-[#B8962E] text-white font-bold rounded-2xl w-full transition-all shadow-lg shadow-[#D4AF37]/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Autoriser les notifications
                </button>
                
                <button
                  onClick={handleDismiss}
                  className="py-3 px-6 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 text-sm font-semibold rounded-2xl transition-colors"
                >
                  Plus tard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
