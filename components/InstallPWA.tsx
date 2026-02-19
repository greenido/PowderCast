'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, DevicePhoneMobileIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPWA() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);

    if (standalone) {
      return; // Don't show prompt if already installed
    }

    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Detect Android
    const android = /Android/.test(navigator.userAgent);
    setIsAndroid(android);

    // Check if user has dismissed the prompt before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed) : 0;
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

    // Show prompt if on mobile and not dismissed in the last 7 days
    if ((ios || android) && daysSinceDismissed > 7) {
      setTimeout(() => setShowPrompt(true), 3000); // Show after 3 seconds
    }

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!dismissed || daysSinceDismissed > 7) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Android/Chrome installation
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
    // For iOS, just show the instructions (handled by the component UI)
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    setShowPrompt(false);
  };

  if (!showPrompt || isStandalone) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
      <div className="bg-gradient-to-r from-cyan-900/95 to-blue-900/95 backdrop-blur-lg border-t border-cyan-500/30 p-4 sm:p-6 shadow-2xl">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <DevicePhoneMobileIcon className="w-8 h-8 text-cyan-400" />
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white">Install PowderCast</h3>
                <p className="text-sm text-gray-300">Get quick access right from your home screen</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Android Installation */}
          {isAndroid && deferredPrompt && (
            <div className="space-y-3">
              <button
                onClick={handleInstallClick}
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all transform hover:scale-105"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                Install Now
              </button>
            </div>
          )}

          {/* iOS Installation Instructions */}
          {isIOS && (
            <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-cyan-400">Install on iPhone/iPad:</p>
              <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
                <li>
                  Tap the <span className="inline-flex items-center mx-1 font-mono bg-slate-800 px-2 py-0.5 rounded">Share</span> button 
                  <span className="ml-1">(square with arrow pointing up)</span> at the bottom of Safari
                </li>
                <li>
                  Scroll down and tap <span className="font-semibold text-white">&quot;Add to Home Screen&quot;</span>
                </li>
                <li>
                  Tap <span className="font-semibold text-white">&quot;Add&quot;</span> in the top right corner
                </li>
                <li>
                  Find the PowderCast icon on your home screen!
                </li>
              </ol>
            </div>
          )}

          {/* Android Manual Instructions */}
          {isAndroid && !deferredPrompt && (
            <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-cyan-400">Install on Android:</p>
              <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
                <li>
                  Tap the <span className="font-mono bg-slate-800 px-2 py-0.5 rounded">⋮</span> menu button in Chrome
                </li>
                <li>
                  Tap <span className="font-semibold text-white">&quot;Add to Home screen&quot;</span> or <span className="font-semibold text-white">&quot;Install app&quot;</span>
                </li>
                <li>
                  Tap <span className="font-semibold text-white">&quot;Add&quot;</span> or <span className="font-semibold text-white">&quot;Install&quot;</span>
                </li>
                <li>
                  Find the PowderCast icon in your app drawer!
                </li>
              </ol>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-3 text-center">
            Works offline • Faster loading • Full-screen experience
          </p>
        </div>
      </div>
    </div>
  );
}
