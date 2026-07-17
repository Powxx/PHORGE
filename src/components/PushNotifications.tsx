"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  ensureNotificationPermission,
  registerNotificationServiceWorker,
  showPushNotification,
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
  const matchIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const setup = async () => {
      await registerNotificationServiceWorker();
      await ensureNotificationPermission();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      userIdRef.current = user.id;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      roleRef.current = profile?.role || null;

      const { data: matches } = await supabase
        .from("matches")
        .select("id, apprenti_id, patron_id, statut")
        .or(`apprenti_id.eq.${user.id},patron_id.eq.${user.id}`);

      matchIdsRef.current = new Set((matches || []).map((m) => m.id));

      channel = supabase
        .channel(`push_notifications_${user.id}`)
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
                  ? "Un salon a demandé une période d'essai."
                  : "Une demande de période d'essai a été envoyée au CFA.",
                tag: `essai-${match.id}`,
                url: isAdmin ? "/admin" : `/chat/${match.id}`,
              });
            }

            if (match.statut === "contrat_demande" && (isParticipant || isAdmin)) {
              await showPushNotification("Demande de contrat", {
                body: isAdmin
                  ? "Un salon a déclaré une intention de contrat."
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

  return null;
}
