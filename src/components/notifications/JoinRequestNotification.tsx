import React, { useEffect, useRef, useState } from 'react';
import { useRecipes } from '../../context/RecipeContext';
import { Check, X, Bell } from 'lucide-react';

export const JoinRequestNotification: React.FC = () => {
  const { household, isHouseholdAdmin, joinRequests, approveJoinRequest, rejectJoinRequest } = useRecipes();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const prevCountRef = useRef<number>(0);

  // Sound and vibration feedback when a new join request arrives
  useEffect(() => {
    const currentCount = joinRequests?.length || 0;
    if (isHouseholdAdmin && currentCount > prevCountRef.current) {
      // Haptic feedback
      try {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([100, 60, 100]);
        }
      } catch {}

      // Audio chime
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        }
      } catch {}

      // Web Notification if permission granted
      try {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          const latest = joinRequests[joinRequests.length - 1];
          new Notification('Ny förfrågan till hushållet!', {
            body: `${latest.displayName} vill gå med i ${household?.name || 'hushållet'}`,
            icon: '/icon-192.png',
          });
        } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }
      } catch {}
    }
    prevCountRef.current = currentCount;
  }, [joinRequests, isHouseholdAdmin, household?.name]);

  if (!isHouseholdAdmin || !joinRequests || joinRequests.length === 0) {
    return null;
  }

  const handleApprove = async (id: string, name: string) => {
    setProcessingId(id);
    const ok = await approveJoinRequest(id);
    setProcessingId(null);
    if (ok) {
      setToastMessage(`${name} godkändes och är nu med i hushållet!`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleReject = async (id: string, name: string) => {
    setProcessingId(id);
    const ok = await rejectJoinRequest(id);
    setProcessingId(null);
    if (ok) {
      setToastMessage(`Förfrågan från ${name} nekades.`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  return (
    <div className="w-full px-4 pt-3 pb-1 transition-all z-30 animate-slide-down">
      {toastMessage && (
        <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="w-full max-w-md md:max-w-3xl lg:max-w-4xl mx-auto space-y-2.5">
        {joinRequests.map((req) => (
          <div
            key={req.id}
            className="bg-amber-50/95 border-2 border-amber-300 rounded-2xl p-3.5 sm:p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-stone-900"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-400/90 text-amber-950 flex items-center justify-center shrink-0 shadow-xs relative">
                <Bell className="w-5 h-5 stroke-[2.3] animate-bounce" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full ring-2 ring-amber-50" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-sm text-stone-900 truncate">
                    {req.displayName}
                  </span>
                  <span className="text-[11px] bg-amber-200/80 text-amber-900 font-semibold px-2 py-0.5 rounded-full">
                    Vill gå med
                  </span>
                </div>
                <p className="text-xs text-amber-900/80 truncate mt-0.5">
                  Begär att ansluta till <strong className="font-semibold">{household?.name || 'hushållet'}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                disabled={processingId === req.id}
                onClick={() => handleApprove(req.id, req.displayName)}
                className="px-4 py-2 rounded-xl bg-[#284235] hover:bg-[#1C3026] active:scale-95 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all touch-manipulation min-h-[40px] cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[2.8]" />
                <span>Godkänn</span>
              </button>

              <button
                type="button"
                disabled={processingId === req.id}
                onClick={() => handleReject(req.id, req.displayName)}
                className="px-3 py-2 rounded-xl bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 text-stone-600 font-semibold text-xs border border-stone-200 shadow-2xs active:scale-95 disabled:opacity-50 transition-all touch-manipulation min-h-[40px] cursor-pointer"
                title="Neka förfrågan"
              >
                <X className="w-4 h-4 stroke-[2.3]" />
                <span>Neka</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
