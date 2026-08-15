"use client";

import React, { useState, useEffect } from 'react';
import { Download, Share2, PlusSquare, Smartphone, CheckCircle2, Monitor } from 'lucide-react';

export default function PWAInstallSection() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [deviceOS, setDeviceOS] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown');

  useEffect(() => {
    // 1. Detect if already running in standalone mode (PWA installed)
    const checkStandalone = () => {
      const isWindowStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isNavigatorStandalone = (window.navigator as any).standalone === true;
      setIsStandalone(isWindowStandalone || isNavigatorStandalone);
    };
    checkStandalone();

    // 2. Detect OS
    const detectOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod/.test(userAgent)) {
        setDeviceOS('ios');
      } else if (/android/.test(userAgent)) {
        setDeviceOS('android');
      } else {
        setDeviceOS('desktop');
      }
    };
    detectOS();

    // 3. Listen for browser install prompt (Android / Chrome Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If app is successfully installed, hide prompt
    window.addEventListener('appinstalled', () => {
      setIsStandalone(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show browser install prompt
    deferredPrompt.prompt();
    
    // Wait for user choice
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA installation choice outcome: ${outcome}`);
    
    // Reset deferred prompt
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  // If already installed, show success state
  if (isStandalone) {
    return (
      <div className="mt-6 text-left bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3 text-green-600 dark:text-green-400 font-bold text-lg">
          <CheckCircle2 size={22} />
          <span>Application installée</span>
        </div>
        <p className="text-zinc-500 text-sm mt-2">
          PHORGE est installé sur votre écran d'accueil. Vous profitez d'une expérience plein écran fluide et de notifications instantanées.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 text-left bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
      <h3 className="font-bold flex items-center gap-2 mb-4 text-lg">
        <Download size={20} className="text-[#D4AF37]" /> Installer l'application
      </h3>

      {/* Case 1: Android or Desktop Chrome/Edge showing direct install button */}
      {isInstallable ? (
        <div className="flex flex-col gap-3">
          <p className="text-zinc-500 text-sm">
            Ajoutez PHORGE sur votre écran d'accueil pour y accéder en un clic comme une vraie application.
          </p>
          <button
            onClick={handleInstallClick}
            className="py-3 px-4 bg-[#D4AF37] hover:bg-[#B8962E] text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-sm w-full shadow-lg shadow-[#D4AF37]/10"
          >
            <Download size={18} /> Installer maintenant
          </button>
        </div>
      ) : (
        <>
          {/* Case 2: iOS (iPhone / iPad) Step by Step Guide */}
          {deviceOS === 'ios' ? (
            <div className="flex flex-col gap-4">
              <p className="text-zinc-500 text-sm">
                Installez PHORGE sur votre iPhone en quelques secondes :
              </p>
              <div className="space-y-3 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-300">
                    Appuyez sur le bouton de partage <span className="inline-flex items-center justify-center p-1 bg-zinc-100 dark:bg-zinc-800 rounded mx-0.5"><Share2 size={14} className="text-blue-500 inline" /></span> en bas de Safari.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-300">
                    Faites défiler le menu vers le bas et sélectionnez <strong className="text-zinc-800 dark:text-white">Sur l'écran d'accueil</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-300">
                    Cliquez sur <strong className="text-zinc-800 dark:text-white">Ajouter</strong> en haut à droite. L'icône apparaîtra sur votre écran.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Case 3: Android without deferredPrompt yet or generic Desktop browser */
            <div className="flex flex-col gap-3">
              <p className="text-zinc-500 text-sm">
                Pour installer l'application sur votre écran d'accueil :
              </p>
              <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm space-y-2">
                <p className="text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
                  <Monitor size={16} className="text-[#D4AF37]" /> 
                  <span><strong>Sur ordinateur</strong> : Cliquez sur l'icône de téléchargement dans la barre d'adresse en haut à droite.</span>
                </p>
                <p className="text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
                  <Smartphone size={16} className="text-[#D4AF37]" /> 
                  <span><strong>Sur Android</strong> : Ouvrez le menu de Chrome (les trois petits points) puis sélectionnez <strong>Installer l'application</strong>.</span>
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
