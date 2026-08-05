import { supabase } from '@/lib/supabase/client';

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }

  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";

  return Notification.requestPermission();
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
    icon: "/favicon.ico",
    badge: "/favicon.ico",
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

  const notification = new Notification(title, payload);
  if (url) {
    notification.onclick = () => {
      window.focus();
      window.location.href = url;
      notification.close();
    };
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
    console.log("[Push Registration] User ID:", user.id);
    console.log("[Push Registration] Subscription payload:", subJson);

    const { data: insertResult, error } = await supabase
      .from("user_push_subscriptions")
      .insert({
        user_id: user.id,
        subscription: subJson,
      })
      .select();
    
    if (error) {
      console.error("[Push Registration] DB insert error:", error);
      if (error.code !== "23505" && error.code !== "P0001") {
        throw new Error(`Échec de la sauvegarde de l'abonnement en base de données : ${error.message}`);
      }
    } else {
      console.log("[Push Registration] DB insert success. Result:", insertResult);
    }
  } catch (error: any) {
    console.error("[Push Registration] Registration failed:", error);
    throw new Error(error.message || "Erreur inconnue lors de l'enregistrement de l'abonnement push.");
  }

  return permission;
}
