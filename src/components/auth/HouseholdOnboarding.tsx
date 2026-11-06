import React, { useState } from 'react';
import { useRecipes } from '../../context/RecipeContext';
import {
  UtensilsCrossed,
  Users,
  KeyRound,
  ArrowRight,
  BookOpen,
  X,
  Clock,
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

import { syncServerSupabaseConfig } from '../../services/supabaseClient';

export interface HouseholdOnboardingProps {
  onClose?: () => void;
  initialTab?: 'create' | 'join';
}

export const HouseholdOnboarding: React.FC<HouseholdOnboardingProps> = ({
  onClose,
  initialTab = 'create',
}) => {
  const { createHousehold, joinHouseholdByCode, currentUser, pendingJoin, cancelPendingJoin } = useRecipes();

  const [activeTab, setActiveTab] = useState<'create' | 'join'>(initialTab);

  // Auto-close modal when join request is approved
  const wasPendingRef = React.useRef<boolean>(Boolean(pendingJoin));
  React.useEffect(() => {
    if (wasPendingRef.current && !pendingJoin && onClose) {
      onClose();
    }
    wasPendingRef.current = Boolean(pendingJoin);
  }, [pendingJoin, onClose]);

  // Create state
  const [hhName, setHhName] = useState<string>('');
  const [creatorName, setCreatorName] = useState<string>(
    currentUser?.displayName && currentUser.displayName !== 'Huvudkock' ? currentUser.displayName : ''
  );
  const [includeStarters, setIncludeStarters] = useState<boolean>(true);

  // Join state
  const [joinCode, setJoinCode] = useState<string>('');
  const [joinMemberName, setJoinMemberName] = useState<string>(
    currentUser?.displayName && currentUser.displayName !== 'Huvudkock' ? currentUser.displayName : ''
  );
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState<boolean>(false);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalHhName = hhName.trim() || 'Vårt Kök';
    const finalCreator = creatorName.trim() || currentUser?.displayName || 'Huvudkock';

    createHousehold(finalHhName, finalCreator, 'Admin', includeStarters);
    if (onClose) {
      onClose();
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.replace(/\D/g, '').slice(0, 6);
    if (!cleaned) return;

    setJoinError(null);
    setIsJoining(true);

    // Auto-sync Supabase configuration from server so the phone never needs to configure anything
    await syncServerSupabaseConfig();

    const finalMemberName = joinMemberName.trim() || currentUser?.displayName || 'Medlem';
    const success = await joinHouseholdByCode(cleaned, finalMemberName, 'Medlem');
    setIsJoining(false);

    if (!success) {
      setJoinError(`Hittade inget hushåll med koden "${cleaned}". Kontrollera att koden stämmer och försök igen.`);
    }
  };

  const isModal = Boolean(onClose);

  return (
    <div
      className={
        isModal
          ? 'fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 selection:bg-emerald-200 font-sans overflow-y-auto'
          : 'min-h-screen bg-[#F5F2EC] flex flex-col items-center justify-center p-4 selection:bg-emerald-200 font-sans'
      }
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-stone-200 animate-fade-in flex flex-col my-auto max-h-[92vh]">
        {/* Decorative Brand Header */}
        <div className="bg-[#284235] text-white p-6 sm:p-7 text-center relative overflow-hidden shrink-0">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />

          {/* Close button if rendered as modal */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-emerald-200 hover:text-white flex items-center justify-center transition-all z-10 touch-manipulation"
              title="Stäng"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white/10 border border-white/20 mx-auto flex items-center justify-center text-emerald-300 shadow-inner mb-3">
            <UtensilsCrossed className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>

          <h1 className="font-serif text-2xl font-bold tracking-tight">
            {pendingJoin ? 'Gå med i hushåll' : isModal ? 'Hushåll i Matklar' : 'Välkommen till Matklar'}
          </h1>
          <p className="text-xs text-emerald-200/80 max-w-xs mx-auto mt-1.5 leading-relaxed">
            {pendingJoin
              ? 'Väntar på att hushållets administratör ska godkänna din förfrågan.'
              : 'Receptsamling, veckomatsedel och gemensam inköpslista i realtid för hela hemmet.'}
          </p>

          {/* Mode Switcher Tabs (hidden while waiting for approval) */}
          {!pendingJoin && (
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/25 rounded-2xl mt-5 border border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'create'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-emerald-100 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Skapa hushåll</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('join')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'join'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-emerald-100 hover:text-white'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Gå med via kod</span>
              </button>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1">
          {pendingJoin ? (
            <div className="space-y-5 text-center py-2 animate-fade-in">
              {pendingJoin.status === 'rejected' ? (
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-700 mx-auto flex items-center justify-center">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-bold text-stone-900">
                      Förfrågan nekades
                    </h3>
                    <p className="text-xs text-stone-600 mt-1.5 max-w-xs mx-auto leading-relaxed">
                      Administratören för <strong className="text-stone-900">{pendingJoin.householdName}</strong> godkände inte förfrågan om att ansluta.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={cancelPendingJoin}
                    className="w-full py-3.5 bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs rounded-2xl shadow-md transition-all touch-manipulation min-h-[46px]"
                  >
                    Försök igen med en annan kod
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-amber-400/25 animate-ping" />
                    <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center relative shadow-inner">
                      <Clock className="w-8 h-8" />
                    </div>
                  </div>

                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold mb-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                      <span>Väntar på godkännande</span>
                    </div>
                    <h3 className="font-serif text-xl font-bold text-stone-900 leading-tight">
                      {pendingJoin.householdName}
                    </h3>
                    <p className="text-xs font-mono font-bold tracking-widest text-emerald-800 mt-1">
                      KOD: {pendingJoin.joinCode}
                    </p>
                  </div>

                  <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 text-left space-y-2">
                    <div className="flex items-start gap-2.5">
                      <ShieldAlert className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
                      <div className="text-xs text-stone-600 leading-relaxed">
                        <strong className="text-stone-900 block mb-0.5">Skyddat hushåll</strong>
                        Endast hushållets administratör kan godkänna nya medlemmar. Detta förhindrar att obehöriga kan gissa koden och ändra eller ta bort recept.
                      </div>
                    </div>
                    <p className="text-[11px] text-stone-500 pl-6 leading-relaxed">
                      Du ansluts automatiskt så fort administratören godkänner förfrågan.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={cancelPendingJoin}
                      className="w-full py-3 bg-stone-100 hover:bg-stone-200 active:scale-98 text-stone-700 font-semibold text-xs rounded-xl border border-stone-200 transition-all touch-manipulation min-h-[44px]"
                    >
                      Avbryt förfrågan
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'create' ? (
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider block mb-1.5">
                  Vad ska ert hushåll heta?
                </label>
                <input
                  type="text"
                  value={hhName}
                  onChange={(e) => setHhName(e.target.value)}
                  placeholder="T.ex. Vårt Kök, Familjen Andersson..."
                  className="w-full h-11 bg-stone-50 border border-stone-300 rounded-xl px-3.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider flex items-center justify-between mb-1.5">
                  <span>Vad heter du?</span>
                  <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    👑 Blir admin
                  </span>
                </label>
                <input
                  type="text"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  placeholder="Ditt förnamn eller smeknamn..."
                  className="w-full h-11 bg-stone-50 border border-stone-300 rounded-xl px-3.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium"
                />
              </div>



              {/* Starter Recipes Checkbox */}
              <div
                onClick={() => setIncludeStarters(!includeStarters)}
                className="flex items-start gap-3 p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 cursor-pointer select-none hover:bg-emerald-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={includeStarters}
                  onChange={(e) => setIncludeStarters(e.target.checked)}
                  className="mt-0.5 rounded border-stone-300 text-emerald-700 focus:ring-emerald-600 w-4 h-4"
                />
                <div className="text-xs">
                  <span className="font-semibold text-emerald-950 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-800" />
                    Lägg till populära standardrecept
                  </span>
                  <p className="text-stone-500 text-[11px] mt-0.5 leading-snug">
                    Ger dig 8 klassiker (ugnspannkaka, bolognese, lax m.fl.) som du kan ändra eller ta bort när som helst.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-[#284235] hover:bg-[#162c20] active:scale-[0.98] text-white font-semibold text-sm rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all touch-manipulation min-h-[52px]"
              >
                <span>Skapa hushåll & Kom igång</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider block mb-1.5">
                  Delningskod
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="T.ex. 482195"
                  className="w-full h-12 bg-stone-50 border border-stone-300 rounded-xl px-4 text-xl font-mono tracking-widest text-center text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-bold"
                />
                <p className="text-[11px] text-stone-500 mt-1.5 text-center">
                  Ange den 6-siffriga koden (t.ex. 482195)
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider block mb-1.5">
                  Ditt namn
                </label>
                <input
                  type="text"
                  value={joinMemberName}
                  onChange={(e) => setJoinMemberName(e.target.value)}
                  placeholder="Ditt namn..."
                  className="w-full h-11 bg-stone-50 border border-stone-300 rounded-xl px-3.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium"
                />
              </div>



              {joinError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium leading-relaxed">
                  {joinError}
                </div>
              )}

              <button
                type="submit"
                disabled={!joinCode.trim() || isJoining}
                className="w-full py-4 bg-[#284235] hover:bg-[#162c20] disabled:opacity-50 active:scale-[0.98] text-white font-semibold text-sm rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all touch-manipulation min-h-[52px]"
              >
                <span>{isJoining ? 'Söker hushåll...' : 'Anslut till hushåll'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="bg-stone-50 p-3.5 text-center border-t border-stone-200 shrink-0">
          <p className="text-[11px] text-stone-400 text-center">
            Du kan när som helst byta namn, växla eller ta bort hushåll.
          </p>
        </div>
      </div>
    </div>
  );
};
