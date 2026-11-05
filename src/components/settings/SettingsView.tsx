import React, { useState } from 'react';
import { useRecipes } from '../../context/RecipeContext';
import { HouseholdShareModal } from '../auth/HouseholdShareModal';
import { HouseholdOnboarding } from '../auth/HouseholdOnboarding';
import { SupabaseConfigModal } from './SupabaseConfigModal';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import { APP_VERSION } from '../../version';
import {
  RotateCcw,
  Check,
  Copy,
  Database,
  Radio,
  ChevronRight,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Users,
  KeyRound,
  Crown,
  Clock,
  ShieldAlert,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    recipes,
    household,
    currentUser,
    isHouseholdAdmin,
    isLiveSupabase,
    resetToMockData,
    regenerateHouseholdCode,
    clearAllRecipes,
    joinRequests,
    approveJoinRequest,
    rejectJoinRequest,
    pendingJoin,
    cancelPendingJoin,
  } = useRecipes();

  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [showHouseholdModal, setShowHouseholdModal] = useState<boolean>(false);
  const [householdModalTab, setHouseholdModalTab] = useState<'create' | 'join'>('create');
  const [showSupabaseModal, setShowSupabaseModal] = useState<boolean>(false);

  // Synchronize settings modals with Android back button
  useModalBackHandler(showShareModal, () => setShowShareModal(false), 'share-modal');
  useModalBackHandler(showHouseholdModal, () => setShowHouseholdModal(false), 'household-auth-modal');
  useModalBackHandler(showSupabaseModal, () => setShowSupabaseModal(false), 'supabase-modal');
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [showClearRecipesConfirm, setShowClearRecipesConfirm] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleCopyCode = () => {
    if (!household) return;
    navigator.clipboard.writeText(household.joinCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleClearAllRecipes = () => {
    clearAllRecipes();
    setShowClearRecipesConfirm(false);
    setToastMessage('Alla recept har rensats bort.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="min-h-screen bg-[#FCFAF5] pb-32 md:pb-16 w-full max-w-full overflow-x-hidden font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-4 right-4 z-40 max-w-md mx-auto bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-slide-down text-xs font-semibold">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Household Share Modal */}
      {showShareModal && <HouseholdShareModal onClose={() => setShowShareModal(false)} />}

      {/* Household Create/Join Onboarding Modal */}
      {showHouseholdModal && (
        <HouseholdOnboarding
          onClose={() => setShowHouseholdModal(false)}
          initialTab={householdModalTab}
        />
      )}

      {/* Supabase Config Modal */}
      {showSupabaseModal && <SupabaseConfigModal onClose={() => setShowSupabaseModal(false)} />}

      {/* Header (Sticky top-0 on mobile, static on desktop) */}
      <div className="sticky top-0 md:static z-20 md:z-auto bg-[#FCFAF5]/95 backdrop-blur-md border-b border-[#EBE7DF] px-4 md:px-6 py-3 shadow-xs w-full">
        <div className="w-full max-w-md md:max-w-3xl lg:max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-serif text-xl font-bold text-stone-900 leading-tight">Inställningar</h1>
            <p className="text-[11px] text-stone-500">Hushåll, Profil & Synk</p>
          </div>

          {/* Realtime Status Badge */}
          <div
            onClick={() => setShowSupabaseModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer active:scale-95 transition-all touch-manipulation min-h-[38px] ${
              isLiveSupabase
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-950 hover:bg-emerald-100'
                : 'bg-stone-100 border border-stone-200 text-stone-600 hover:bg-stone-200/70'
            }`}
            title={isLiveSupabase ? 'Ansluten till Supabase molndatabas' : 'Endast lokalt på denna enhet. Klicka för att konfigurera molnsynk.'}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isLiveSupabase ? 'bg-emerald-600 animate-ping' : 'bg-stone-400'
              }`}
            />
            <span>{isLiveSupabase ? 'Molnsynk Aktiv' : 'Lokal lagring'}</span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-md md:max-w-3xl lg:max-w-4xl mx-auto p-4 md:px-6 md:py-6 space-y-6">
        {/* Admin Pending Join Requests Banner */}
        {isHouseholdAdmin && joinRequests && joinRequests.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-3xl p-4 sm:p-5 text-amber-950 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-slide-down">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-sm text-stone-900 block truncate">
                  {joinRequests.length === 1
                    ? `${joinRequests[0].displayName} vill gå med i hushållet`
                    : `${joinRequests.length} personer vill ansluta till hushållet`}
                </span>
                <p className="text-xs text-amber-800 truncate">
                  Endast du som hushållets admin kan godkänna nya medlemmar
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {joinRequests.length === 1 ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await approveJoinRequest(joinRequests[0].id);
                      if (ok) {
                        setToastMessage(`${joinRequests[0].displayName} godkändes!`);
                        setTimeout(() => setToastMessage(null), 3000);
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shrink-0 shadow-xs active:scale-95 transition-all touch-manipulation min-h-[38px] flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Godkänn</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await rejectJoinRequest(joinRequests[0].id);
                      if (ok) {
                        setToastMessage(`Förfrågan nekades`);
                        setTimeout(() => setToastMessage(null), 3000);
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-stone-600 hover:text-rose-700 font-semibold text-xs border border-stone-200 shrink-0 transition-all touch-manipulation min-h-[38px]"
                  >
                    Neka
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowShareModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shrink-0 shadow-xs active:scale-95 transition-all touch-manipulation min-h-[40px]"
                >
                  Hantera alla ({joinRequests.length})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Applicant Pending Waiting Status Card */}
        {pendingJoin && pendingJoin.status === 'pending' && (
          <div className="bg-stone-50 border border-amber-300/80 rounded-3xl p-4 sm:p-5 text-stone-900 shadow-xs flex items-center justify-between gap-3 animate-slide-down">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-xs text-stone-900 block truncate">
                  Väntar på godkännande till {pendingJoin.householdName}
                </span>
                <span className="text-[11px] font-mono text-stone-500 block">
                  Kod: {pendingJoin.joinCode}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={cancelPendingJoin}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 font-semibold text-xs shrink-0 transition-all touch-manipulation min-h-[38px]"
            >
              Avbryt
            </button>
          </div>
        )}

        {/* Household Section */}
        {!household ? (
          <div className="bg-[#284235] rounded-3xl p-5 text-white shadow-sm space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 text-emerald-300 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-emerald-200/80 font-bold uppercase tracking-wider block">
                  Gemensamt kök & synkning
                </span>
                <h3 className="font-serif text-lg font-bold text-white leading-tight mt-0.5">
                  Inget hushåll anslutet
                </h3>
                <p className="text-xs text-emerald-100/80 mt-1 leading-relaxed">
                  Skapa ett hushåll eller anslut med delningskod för att dela recept, veckomatsedel och inköpslista i realtid med familj eller sambo.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setHouseholdModalTab('create');
                  setShowHouseholdModal(true);
                }}
                className="py-3 px-3 rounded-2xl bg-white text-stone-900 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 hover:bg-emerald-50 transition-all touch-manipulation min-h-[46px]"
              >
                <Plus className="w-4 h-4 text-emerald-800" />
                <span>Skapa hushåll</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHouseholdModalTab('join');
                  setShowHouseholdModal(true);
                }}
                className="py-3 px-3 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/20 active:scale-95 transition-all touch-manipulation min-h-[46px]"
              >
                <KeyRound className="w-4 h-4 text-emerald-300" />
                <span>Gå med via kod</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Active Household Profile & Share Code Card */}
            <div className="bg-[#284235] rounded-3xl p-5 text-white shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 text-white font-bold text-sm flex items-center justify-center shrink-0">
                    {currentUser.initials || currentUser.displayName[0]}
                  </div>
                  <div>
                    <div className="text-xs text-emerald-200/80 font-medium flex items-center gap-1.5 flex-wrap">
                      <span>Aktiv profil: <span className="font-semibold text-white">{currentUser.displayName}</span></span>
                      {isHouseholdAdmin ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/40 text-[10px] font-bold">
                          <Crown className="w-2.5 h-2.5 text-amber-300" />
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/10 text-emerald-200 text-[10px] font-medium">
                          Medlem
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif text-lg font-bold text-white leading-tight">
                      {household.name}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowShareModal(true)}
                  className="px-3.5 py-2 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-semibold text-xs flex items-center gap-1.5 border border-white/20 transition-all touch-manipulation min-h-[42px]"
                >
                  <span>Hantera</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Delningskod Section */}
              <div className="bg-black/25 rounded-2xl p-3.5 border border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-200/70 uppercase tracking-wider block font-semibold">
                    Delningskod till hushållet
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-emerald-300 font-mono tracking-widest">
                      {household.joinCode}
                    </span>
                    {isHouseholdAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          const newCode = regenerateHouseholdCode();
                          setToastMessage(`Ny 6-siffrig kod genererad: ${newCode}`);
                          setTimeout(() => setToastMessage(null), 3000);
                        }}
                        className="p-1.5 text-emerald-300/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                        title="Skapa ny 6-siffrig kod"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-xs flex items-center gap-1.5 active:scale-95 border border-white/15 transition-all touch-manipulation min-h-[44px]"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? 'Kopierad' : 'Kopiera'}</span>
                </button>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setHouseholdModalTab('create');
                  setShowHouseholdModal(true);
                }}
                className="bg-white rounded-2xl border border-[#EBE7DF] p-3.5 flex items-center gap-2.5 hover:bg-stone-50 active:scale-[0.98] transition-all shadow-xs touch-manipulation text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-xs text-stone-900 block truncate">Nytt hushåll</span>
                  <span className="text-[10px] text-stone-500 block truncate">Skapa ett till</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHouseholdModalTab('join');
                  setShowHouseholdModal(true);
                }}
                className="bg-white rounded-2xl border border-[#EBE7DF] p-3.5 flex items-center gap-2.5 hover:bg-stone-50 active:scale-[0.98] transition-all shadow-xs touch-manipulation text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold shrink-0">
                  <KeyRound className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-xs text-stone-900 block truncate">Gå med i hushåll</span>
                  <span className="text-[10px] text-stone-500 block truncate">Anslut via kod</span>
                </div>
              </button>
            </div>
          </>
        )}

        {/* Databas & Synkning Card */}
        <div
          onClick={() => setShowSupabaseModal(true)}
          className="bg-white rounded-3xl border border-[#EBE7DF] p-4 flex items-center justify-between cursor-pointer hover:bg-stone-50 transition-colors shadow-xs touch-manipulation"
          style={{ minHeight: '64px' }}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#FCFAF5] text-stone-800 flex items-center justify-center font-bold text-sm shrink-0 border border-[#EBE7DF]">
              <Database className="w-5 h-5 stroke-[1.75] text-[#284235]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm text-stone-900 leading-tight">
                  Databas & Synkning
                </h4>
                <span className="text-[10px] bg-[#FCFAF5] text-stone-700 font-medium px-2 py-0.5 rounded-md border border-[#EBE7DF]">
                  {isLiveSupabase ? 'Molnsynk Aktiv' : 'Lokal Realtid'}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Hantera anslutning för delning och molnlagring
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-stone-400" />
        </div>

        {/* Realtime Features Info */}
        <div className="bg-white border border-[#EBE7DF] rounded-3xl p-4 space-y-2.5 shadow-xs">
          <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
            <Radio className="w-4 h-4 text-[#284235]" />
            <span>Realtidssynkronisering</span>
          </div>
          <ul className="text-xs text-stone-600 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>Recept och ändringar synkas direkt mellan hushållets enheter</li>
            <li>Gemensamma anteckningar och betyg uppdateras omedelbart</li>
            <li>Inköpslistan bockas av i realtid när någon är i butiken</li>
            <li>Veckoplanen hålls automatiskt synkroniserad</li>
          </ul>
        </div>

        {/* Clear All Recipes Card (Admin Only) */}
        {isHouseholdAdmin ? (
          <div className="bg-white rounded-3xl border border-[#EBE7DF] shadow-xs p-4 space-y-3">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Rensa alla recept</span>
            </div>

            <p className="text-xs text-stone-500 leading-relaxed">
              Tar bort samtliga recept ({recipes.length} st) från appen så att du kan börja om med en helt tom samling.
            </p>

            {showClearRecipesConfirm ? (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Vill du radera alla {recipes.length} recept?</span>
                </div>
                <p className="text-xs text-rose-700">
                  Detta tar bort alla sparade recept permanent från hushållet.
                </p>
                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowClearRecipesConfirm(false)}
                    className="flex-1 py-3 rounded-2xl bg-white border border-rose-200 text-stone-700 text-xs font-semibold touch-manipulation min-h-[46px]"
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllRecipes}
                    className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs active:scale-95 touch-manipulation min-h-[46px]"
                  >
                    Ja, rensa alla
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={recipes.length === 0}
                onClick={() => setShowClearRecipesConfirm(true)}
                className="w-full py-3.5 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 active:scale-95 disabled:opacity-40 text-xs font-semibold transition-all touch-manipulation min-h-[48px] flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Rensa alla {recipes.length} recept</span>
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-[#EBE7DF] shadow-xs p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
              <Crown className="w-4 h-4" />
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              Endast hushållets admin kan rensa bort receptsamlingen eller hantera medlemmar.
            </p>
          </div>
        )}

        {/* Data Reset */}
        <div className="bg-white rounded-3xl border border-[#EBE7DF] shadow-xs p-4 space-y-3">
          <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
            <RotateCcw className="w-4 h-4 text-stone-600" />
            <span>Återställ till standard-demo</span>
          </div>

          <p className="text-xs text-stone-500 leading-relaxed">
            Återställ all data till de ursprungliga demorecepten och standardveckoplanen.
          </p>

          {showResetConfirm ? (
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3.5 space-y-2.5">
              <p className="text-xs font-semibold text-stone-800">
                Är du säker? Egna ändringar ersätts med demodata.
              </p>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-3 rounded-2xl bg-stone-200 text-stone-700 text-xs font-semibold touch-manipulation min-h-[46px]"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetToMockData();
                    setShowResetConfirm(false);
                    setToastMessage('Återställt till standard-demodata!');
                    setTimeout(() => setToastMessage(null), 3000);
                  }}
                  className="flex-1 py-3 rounded-2xl bg-stone-900 text-white text-xs font-semibold shadow-xs active:scale-95 touch-manipulation min-h-[46px]"
                >
                  Ja, återställ
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="w-full py-3 px-4 rounded-2xl border border-[#EBE7DF] hover:bg-stone-50 active:scale-95 text-stone-700 text-xs font-semibold transition-all touch-manipulation min-h-[48px]"
            >
              Återställ standardrecept
            </button>
          )}
        </div>

        {/* Brand & App Info Footer */}
        <div className="text-center pt-3 pb-8 text-stone-400 space-y-1.5">
          <p className="font-serif font-bold text-base text-stone-700">Matklar</p>
          <p className="text-[11px] text-stone-500">Receptsamling, veckoplanering & inköp för hela hushållet</p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-200/70 text-stone-600 text-[11px] font-semibold mt-1">
            <span>Version {APP_VERSION}</span>
            <span className="text-stone-300">•</span>
            <span>PWA</span>
          </div>
        </div>
      </div>
    </div>
  );
};
