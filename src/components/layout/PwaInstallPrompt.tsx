import React, { useState, useEffect } from 'react';
import {
  Download,
  Share,
  PlusSquare,
  X,
  Smartphone
} from 'lucide-react';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);

  // Synchronize iOS guide modal with back button
  useModalBackHandler(showIosGuide, () => setShowIosGuide(false), 'ios-guide-modal');

  useEffect(() => {
    // Check if already installed / running in standalone mode
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // Listen for beforeinstallprompt on Android/Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else if (isIos) {
      setShowIosGuide(true);
    }
  };

  // Don't show if already in standalone app mode or dismissed
  if (isStandalone || isDismissed) {
    return null;
  }

  // Show if either Android deferred prompt is available OR on iOS browser
  if (!deferredPrompt && !isIos) {
    return null;
  }

  return (
    <>
      {/* Subtle Floating Install Banner (Mobile only) */}
      <div className="md:hidden bg-stone-900 text-white px-4 py-2.5 flex items-center justify-between shadow-md border-b border-stone-800 text-xs">
        <div className="flex items-center gap-2.5 truncate">
          <div className="w-8 h-8 rounded-lg bg-stone-800 text-emerald-400 flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="truncate">
            <span className="font-bold text-white block truncate">
              Installera som app
            </span>
            <span className="text-[10px] text-stone-400 block truncate">
              Fullskärm på hemskärmen
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-all touch-manipulation min-h-[40px]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Installera</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="w-9 h-9 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors touch-manipulation"
            aria-label="Stäng banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS Safari Installation Guide Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in font-sans">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-stone-100 text-stone-800 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-stone-900">
                    Installera på iPhone / iPad
                  </h3>
                  <p className="text-xs text-stone-500">Lägg till på hemskärmen</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="w-11 h-11 rounded-2xl bg-stone-100 text-stone-600 flex items-center justify-center touch-manipulation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 bg-stone-50 p-4 rounded-2xl border border-stone-200 text-xs text-stone-800">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-stone-900 text-white font-bold flex items-center justify-center shrink-0">
                  1
                </div>
                <div className="flex-1">
                  <span>Tryck på <strong>Dela-knappen</strong></span>
                  <div className="inline-flex items-center gap-1 bg-white border border-stone-300 rounded px-1.5 py-0.5 mx-1">
                    <Share className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <span>längst ned i Safari-webbläsaren.</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-stone-900 text-white font-bold flex items-center justify-center shrink-0">
                  2
                </div>
                <div className="flex-1">
                  <span>Skrolla ned och välj <strong>"Lägg till på hemskärmen"</strong></span>
                  <div className="inline-flex items-center gap-1 bg-white border border-stone-300 rounded px-1.5 py-0.5 mx-1">
                    <PlusSquare className="w-3.5 h-3.5 text-stone-700" />
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-stone-900 text-white font-bold flex items-center justify-center shrink-0">
                  3
                </div>
                <div className="flex-1">
                  <span>Tryck på <strong>"Lägg till"</strong> uppe till höger för att slutföra installationen.</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full py-4 bg-stone-900 text-white font-bold text-xs rounded-xl active:scale-95 touch-manipulation min-h-[52px]"
            >
              Jag förstår
            </button>
          </div>
        </div>
      )}
    </>
  );
};
