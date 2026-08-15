"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Bell } from "lucide-react";
import {
  registerNotificationServiceWorker,
  showPushNotification,
  subscribeUserToPush,
} from "@/lib/notifications";

type MatchRow = {
  id: string;
  apprenti_id: string;
  patron_id: string;
  statut: string;
};

type MessageRow = {
  id: string;
  match_id: string;
  expediteur_id: string;
  texte: string;
};

export default function PushNotifications() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const userIdRef = useRef<string | null>(null);
  const roleRef = useRef<string | null>(null);
  const schoolIdRef = useRef<string | null>(null);
  const domainRef = useRef<string | null>(null);
  const matchIdsRef = useRef<Set<string>>(new Set());
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const setup = async () => {
      await registerNotificationServiceWorker();

      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "default" && !localStorage.getItem("phorge_notifications_prompted")) {
          setShowPrompt(true);
        } else if (Notification.permission === "granted") {
          // If already granted, auto-subscribe to update DB subscription
          await subscribeUserToPush();
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

      // Fetch user domain
      let userDomaine: string | null = null;
      if (profile?.role === "apprenti") {
        const { data: details } = await supabase
          .from("apprentis_details")
          .select("domaine")
          .eq("profile_id", user.id)
          .single();
        userDomaine = details?.domaine || null;
      } else if (profile?.role === "patron") {
        const { data: details } = await supabase
          .from("patrons_details")
          .select("domaine")
          .eq("profile_id", user.id)
          .single();
        userDomaine = details?.domaine || null;
      }
      domainRef.current = userDomaine;

      const { data: matches } = await supabase
        .from("matches")
        .select("id, apprenti_id, patron_id, statut")
        .or(`apprenti_id.eq.${user.id},patron_id.eq.${user.id}`);

      matchIdsRef.current = new Set((matches || []).map((m) => m.id));

      channel = supabase
        .channel(`push_notifications_${user.id}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles" },
          async (payload) => {
            const oldApproved = (payload.old as any)?.is_approved;
            const newApproved = (payload.new as any)?.is_approved;
            const targetRole = (payload.new as any)?.role;
            const targetId = (payload.new as any)?.id;

            if (newApproved && !oldApproved && targetId !== userIdRef.current) {
              const targetSchoolId = (payload.new as any)?.school_id;
              if (schoolIdRef.current && targetSchoolId && targetSchoolId !== schoolIdRef.current) {
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
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "apprentis_details" },
          async (payload) => {
            const newApprenti = payload.new as any;
            const myRole = roleRef.current;
            const myDomain = domainRef.current;

            if (myRole === "patron" && myDomain && newApprenti.domaine === myDomain) {
              const { data: prof } = await supabase
                .from("profiles")
                .select("is_approved")
                .eq("id", newApprenti.profile_id)
                .single();
              if (prof?.is_approved) {
                await showPushNotification("Nouvel apprenti disponible !", {
                  body: `${newApprenti.prenom} ${newApprenti.nom} recherche un employeur.`,
                  tag: `new-profile-${newApprenti.profile_id}`,
                  url: "/swipe",
                });
              }
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "patrons_details" },
          async (payload) => {
            const newPatron = payload.new as any;
            const myRole = roleRef.current;
            const myDomain = domainRef.current;

            if (myRole === "apprenti" && myDomain && newPatron.domaine === myDomain) {
              const { data: prof } = await supabase
                .from("profiles")
                .select("is_approved")
                .eq("id", newPatron.profile_id)
                .single();
              if (prof?.is_approved) {
                await showPushNotification("Nouvelle entreprise disponible !", {
                  body: `L'entreprise "${newPatron.nom_entreprise}" recrute.`,
                  tag: `new-profile-${newPatron.profile_id}`,
                  url: "/swipe",
                });
              }
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "matches" },
          async (payload) => {
            const match = payload.new as MatchRow;
            const uid = userIdRef.current;
            if (!uid) return;

            const isParticipant = match.apprenti_id === uid || match.patron_id === uid;
            if (isParticipant) {
              matchIdsRef.current.add(match.id);
              await showPushNotification("Nouveau match !", {
                body: "Vous avez une nouvelle mise en relation.",
                tag: `match-${match.id}`,
                url: `/chat/${match.id}`,
              });
            }

            if (roleRef.current === "admin_cfa") {
              await showPushNotification("Nouveau match (CFA)", {
                body: "Une nouvelle mise en relation a été créée.",
                tag: `admin-match-${match.id}`,
                url: "/admin",
              });
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "matches" },
          async (payload) => {
            const match = payload.new as MatchRow;
            const old = payload.old as Partial<MatchRow>;
            const uid = userIdRef.current;
            if (!uid || match.statut === old.statut) return;

            const isParticipant = match.apprenti_id === uid || match.patron_id === uid;
            const isAdmin = roleRef.current === "admin_cfa";

            if (match.statut === "essai_demande" && (isParticipant || isAdmin)) {
              await showPushNotification("Demande de période d'essai", {
                body: isAdmin
                  ? "Une entreprise a demandé une période d'essai."
                  : "Une demande de période d'essai a été envoyée au CFA.",
                tag: `essai-${match.id}`,
                url: isAdmin ? "/admin" : `/chat/${match.id}`,
              });
            }

            if (match.statut === "contrat_demande" && (isParticipant || isAdmin)) {
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
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          async (payload) => {
            const message = payload.new as MessageRow;
            const uid = userIdRef.current;
            if (!uid || message.expediteur_id === uid) return;

            // Refresh match membership if needed (new match race)
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
    await subscribeUserToPush();
  };

  const handleDismiss = () => {
    localStorage.setItem("phorge_notifications_prompted", "true");
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-[#D4AF37]/10 to-transparent"></div>
        
        <div className="relative z-10">
          <div className="w-16 h-16 mx-auto bg-[#D4AF37]/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <Bell size={32} className="text-[#D4AF37]" />
          </div>

          <h2 className="text-xl font-black text-zinc-900 dark:text-white mb-2 animate-bounce">
            Activez les notifications 🔔
          </h2>
          
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8 leading-relaxed">
            Ne manquez aucun match, message ou opportunité de contrat importante sur la plateforme ! PHORGE vous informe en temps réel.
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
  );
}
