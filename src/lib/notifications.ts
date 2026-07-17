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
