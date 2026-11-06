import React, { useState } from 'react';
import { useRecipes } from '../../context/RecipeContext';
import { X } from 'lucide-react';
import { INITIAL_RECIPES } from '../../data/mockRecipes';

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
      setJoinError(`Inget hushåll har koden ${cleaned}.`);
    }
  };

  const isModal = Boolean(onClose);

  const inputClass =
    'w-full h-11 bg-stone-50 border border-stone-300 rounded-xl px-3.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]';
  const primaryButton =
    'w-full min-h-[50px] bg-[#284235] hover:bg-black disabled:opacity-50 text-white font-semibold text-sm rounded-2xl touch-manipulation';

  return (
    <div
      className={
        isModal
          ? 'fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4 font-sans'
          : 'min-h-screen bg-[#FCFAF5] flex flex-col items-center justify-center p-4 font-sans'
      }
      onClick={(e) => {
        if (isModal && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`w-full max-w-md bg-white flex flex-col max-h-[92vh] animate-fade-in ${
          isModal ? 'rounded-t-3xl sm:rounded-3xl' : 'rounded-3xl border border-[#EBE7DF]'
        }`}
      >
        <div className="px-5 pt-4 pb-3 border-b border-[#EBE7DF] flex items-center justify-between shrink-0">
          <h2 className="font-serif text-lg font-bold text-stone-900 leading-tight">
            {pendingJoin ? 'Gå med i hushåll' : 'Hushåll'}
          </h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-100 touch-manipulation"
              aria-label="Stäng"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] overflow-y-auto flex-1 space-y-4">
          {!pendingJoin && (
            <div className="grid grid-cols-2 gap-1 p-1 bg-stone-100 rounded-xl" role="tablist">
              {(['create', 'join'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className={`min-h-[40px] rounded-lg text-sm font-semibold touch-manipulation ${
                    activeTab === tab ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                  }`}
                >
                  {tab === 'create' ? 'Skapa nytt' : 'Gå med med kod'}
                </button>
              ))}
            </div>
          )}

          {pendingJoin ? (
            pendingJoin.status === 'rejected' ? (
              <div className="space-y-3">
                <h3 className="font-serif text-lg font-bold text-stone-900">Förfrågan nekades</h3>
                <p className="text-sm text-stone-600">
                  Administratören för {pendingJoin.householdName} godkände inte förfrågan.
                </p>
                <button type="button" onClick={cancelPendingJoin} className={primaryButton}>
                  Försök med en annan kod
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="font-serif text-lg font-bold text-stone-900">{pendingJoin.householdName}</h3>
                <p className="text-sm text-stone-600">
                  Väntar på att administratören godkänner dig. Du kommer in av dig själv när det är gjort.
                </p>
                <p className="text-sm text-stone-500 tabular-nums">Kod {pendingJoin.joinCode}</p>
                <button
                  type="button"
                  onClick={cancelPendingJoin}
                  className="w-full min-h-[46px] bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-sm rounded-xl touch-manipulation"
                >
                  Avbryt förfrågan
                </button>
              </div>
            )
          ) : activeTab === 'create' ? (
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label htmlFor="hh-name" className="text-sm font-semibold text-stone-900 block mb-1.5">
                  Vad ska hushållet heta?
                </label>
                <input
                  id="hh-name"
                  type="text"
                  value={hhName}
                  onChange={(e) => setHhName(e.target.value)}
                  placeholder="Till exempel Familjen Andersson"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="hh-creator" className="text-sm font-semibold text-stone-900 flex items-baseline justify-between mb-1.5">
                  <span>Vad heter du?</span>
                  <span className="text-xs font-normal text-stone-500">Du blir admin</span>
                </label>
                <input
                  id="hh-creator"
                  type="text"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  placeholder="Förnamn"
                  className={inputClass}
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer select-none py-1">
                <input
                  type="checkbox"
                  checked={includeStarters}
                  onChange={(e) => setIncludeStarters(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#284235] shrink-0"
                />
                <span className="text-sm text-stone-800">
                  Lägg in {INITIAL_RECIPES.length} recept att börja med
                  <span className="block text-xs text-stone-500 mt-0.5">De går att ändra eller ta bort.</span>
                </span>
              </label>

              <button type="submit" className={primaryButton}>
                Skapa hushåll
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div>
                <label htmlFor="hh-code" className="text-sm font-semibold text-stone-900 block mb-1.5">
                  Kod från hushållet
                </label>
                <input
                  id="hh-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6 siffror"
                  className={`${inputClass} h-12 text-lg font-mono tracking-widest`}
                />
              </div>

              <div>
                <label htmlFor="hh-join-name" className="text-sm font-semibold text-stone-900 block mb-1.5">
                  Vad heter du?
                </label>
                <input
                  id="hh-join-name"
                  type="text"
                  value={joinMemberName}
                  onChange={(e) => setJoinMemberName(e.target.value)}
                  placeholder="Förnamn"
                  className={inputClass}
                />
              </div>

              {joinError && <p className="text-sm text-rose-700">{joinError}</p>}

              <button type="submit" disabled={!joinCode.trim() || isJoining} className={primaryButton}>
                {isJoining ? 'Söker hushållet' : 'Gå med'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
