"use client";
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function NotificationProvider() {
  useEffect(() => {
    let channel: any = null;

    const setupNotifications = async () => {
      // 0. Register Service Worker for PWA
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => console.log("Service Worker registered successfully:", reg.scope))
          .catch((err) => console.error("Service Worker registration failed:", err));
      }

      // 1. Request Permission
      if ("Notification" in window) {
        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
          await Notification.requestPermission();
        }
      }

      // 2. Get User
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (!profile) return;

      const notify = (title: string, body: string) => {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(title, { body });
        }
      };

      channel = supabase.channel('global_notifications');

      if (profile.role === 'admin_cfa') {
        // Admin: listen to new profiles that are not approved
        channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles', filter: 'is_approved=eq.false' }, (payload: any) => {
          notify("Nouveau compte à valider", "Un utilisateur s'est inscrit et attend validation.");
        });
      } else {
        // Apprenti / Patron: listen to matches & messages
        channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, (payload: any) => {
          if (payload.new.apprenti_id === user.id || payload.new.patron_id === user.id) {
            notify("Nouveau Match !", "Vous avez un nouveau match ! Allez voir vos messages.");
          }
        });

        channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, (payload: any) => {
          if (payload.new.apprenti_id === user.id || payload.new.patron_id === user.id) {
            if (payload.new.statut === 'essai_demande' && payload.old.statut !== 'essai_demande') {
              notify("Demande d'essai", "Une demande d'essai a été envoyée !");
            }
            if (payload.new.statut === 'contrat_demande' && payload.old.statut !== 'contrat_demande') {
              notify("Demande de contrat", "Félicitations, une intention de contrat a été déclarée !");
            }
          }
        });

        channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
          if (payload.new.expediteur_id !== user.id) {
            // Need to verify if this message is for a match that involves the current user
            supabase.from('matches').select('id')
              .eq('id', payload.new.match_id)
              .or(`apprenti_id.eq.${user.id},patron_id.eq.${user.id}`)
              .single()
              .then(({ data }) => {
                if (data) notify("Nouveau message", "Vous avez reçu un nouveau message.");
              });
          }
        });
      }

      channel.subscribe();
    };

    setupNotifications();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
