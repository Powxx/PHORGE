import { supabase } from '@/lib/supabase/client';

export type NotificationPermissionState = NotificationPermission;

/**
 * Joue un carillon subtil et agréable via la Web Audio API (aucun fichier MP3 requis)
 */
export function playNotificationChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Note 1 (D5 ~ 587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0.15, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.35);

    // Note 2 (A5 ~ 880 Hz) avec léger décalage
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    gain2.gain.setValueAtTime(0.18, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.55);
  } catch (err) {
    // AudioContext can fail if user hasn't interacted yet, silently ignore
  }
}

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }

  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";

  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (error) {
    console.error("Service worker registration failed:", error);
    return null;
  }
}

export async function showPushNotification(
  title: string,
  options?: NotificationOptions & { url?: string }
) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const { url, ...notificationOptions } = options || {};
  const payload: NotificationOptions = {
    icon: "/logo.png",
    badge: "/logo.png",
    ...notificationOptions,
    data: { ...(notificationOptions.data || {}), url },
  };

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.showNotification) {
      await registration.showNotification(title, payload);
      return;
    }
  } catch {
    // fall through to window Notification
  }

  try {
    const notification = new Notification(title, payload);
    if (url) {
      notification.onclick = () => {
        window.focus();
        window.location.href = url;
        notification.close();
      };
    }
  } catch (err) {
    console.error("Erreur lors de l'affichage de la notification locale:", err);
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeUserToPush(): Promise<NotificationPermission> {
  const permission = await ensureNotificationPermission();
  if (permission !== "granted") {
    throw new Error("Permission de notification non accordée : " + permission);
  }

  const registration = await registerNotificationServiceWorker();
  if (!registration) {
    throw new Error("L'enregistrement du Service Worker a échoué ou n'est pas pris en charge par ce navigateur.");
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error("Clé publique VAPID (NEXT_PUBLIC_VAPID_PUBLIC_KEY) manquante dans l'environnement.");
  }

  try {
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as any,
      });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Utilisateur non connecté.");
    }

    const subJson = subscription.toJSON();

    // Enregistrement avec vérification d'existence pour éviter les erreurs de doublons
    const { data: existing } = await supabase
      .from("user_push_subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    const { error } = await supabase
      .from("user_push_subscriptions")
      .upsert({
        user_id: user.id,
        subscription: subJson,
      }, { onConflict: 'user_id, subscription' });

    if (error && error.code !== "23505" && error.code !== "P0001") {
      console.warn("[Push Registration] DB upsert warning:", error);
    }
  } catch (error: any) {
    console.error("[Push Registration] Registration failed:", error);
    throw new Error(error.message || "Erreur inconnue lors de l'enregistrement de l'abonnement push.");
  }

  return permission;
}

/**
 * Envoie une notification push serveur à un utilisateur via /api/push/notify
 */
export async function sendPushNotification({
  userId,
  title,
  body,
  url
}: {
  userId: string;
  title: string;
  body: string;
  url?: string;
}): Promise<{ success: boolean; sent?: number; error?: string }> {
  try {
    const res = await fetch('/api/push/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title, body, url })
    });
    const data = await res.json();
    return { success: res.ok, sent: data.sent, error: data.error };
  } catch (err: any) {
    console.error("sendPushNotification error:", err);
    return { success: false, error: err.message };
  }
}
