"use client";

import React, { useState, useEffect } from 'react';
import { X, Download, ArrowRight } from 'lucide-react';

export default function PWAInstallBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [deviceOS, setDeviceOS] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown');

  useEffect(() => {
    // 1. Check if already installed (standalone mode)
    const isWindowStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isNavigatorStandalone = (window.navigator as any).standalone === true;
    if (isWindowStandalone || isNavigatorStandalone) return;

    // 2. Check if dismissed recently
    const isDismissed = localStorage.getItem('phorge_pwa_dismissed') === 'true';
    if (isDismissed) return;

    // 3. Detect OS
    const userAgent = window.navigator.userAgent.toLowerCase();
    let os: 'ios' | 'android' | 'desktop' | 'unknown' = 'unknown';
    if (/iphone|ipad|ipod/.test(userAgent)) {
      os = 'ios';
    } else if (/android/.test(userAgent)) {
      os = 'android';
    } else {
      os = 'desktop';
    }
    setDeviceOS(os);

    // 4. Delay banner trigger for iOS
    if (os === 'ios') {
      const timer = setTimeout(() => setShowBanner(true), 4000);
      return () => clearTimeout(timer);
    }

    // 5. Listen for prompt for Android/Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('phorge_pwa_dismissed', 'true');
    setShowBanner(false);
  };

  const handleInstall = async () => {
    if (deviceOS === 'ios') {
      // For iOS, redirect to profile page where step-by-step is located
      window.location.href = '/profil';
      return;
    }

    if (!deferredPrompt) {
      window.location.href = '/profil';
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User installation choice outcome: ${outcome}`);
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-24 md:bottom-6 right-0 left-0 md:left-auto md:right-6 px-4 md:px-0 z-[100] animate-fade-in-up">
      <div className="bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 max-w-md mx-auto border border-zinc-800 dark:border-zinc-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D4AF37] text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-md">
            P
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-extrabold text-sm tracking-wide truncate">Installer PHORGE</h4>
            <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-0.5">
              {deviceOS === 'ios' ? "Ajoutez l'application sur l'écran d'accueil" : "Accédez à PHORGE en un clic"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleInstall}
            className="px-3 py-2 bg-[#D4AF37] hover:bg-[#B8962E] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-[#D4AF37]/20"
          >
            {deviceOS === 'ios' ? (
              <>
                <span>Guide</span>
                <ArrowRight size={12} />
              </>
            ) : (
              <>
                <Download size={12} />
                <span>Installer</span>
              </>
            )}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 hover:bg-zinc-800 dark:hover:bg-zinc-100 rounded-lg text-zinc-400 dark:text-zinc-500 transition-colors"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
