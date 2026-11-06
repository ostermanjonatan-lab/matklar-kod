import React, { useState } from 'react';
import { Toast } from '../layout/Toast';
import { useRecipes } from '../../context/RecipeContext';
import { HouseholdShareModal } from '../auth/HouseholdShareModal';
import { HouseholdOnboarding } from '../auth/HouseholdOnboarding';
import { SupabaseConfigModal } from './SupabaseConfigModal';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import { APP_VERSION } from '../../version';
import { getThemeChoice, setThemeChoice, type ThemeChoice } from '../../utils/theme';
import { OPEN_STORE_ORDER_KEY } from '../shopping/storeOrderLink';
import { saveRecipeBackup, readRecipeBackup } from '../../utils/recipeBackup';
import { Check, Copy, ChevronRight, ChevronDown, Clock, ShieldAlert } from 'lucide-react';

/** A plain row in a list: text on the left, optional detail and arrow on the right. */
const Row: React.FC<{
  label: string;
  detail?: string;
  onClick: () => void;
  danger?: boolean;
}> = ({ label, detail, onClick, danger }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full min-h-[52px] py-3 flex items-center gap-3 text-left touch-manipulation active:bg-stone-100/70"
  >
    <span className={`flex-1 min-w-0 text-sm ${danger ? 'text-rose-700' : 'text-stone-900'}`}>{label}</span>
    {detail && <span className="text-xs text-stone-500 truncate max-w-[45%]">{detail}</span>}
    <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />
  </button>
);

/** Inline yes/no under a row, for things that cannot be undone. */
const Confirm: React.FC<{
  text: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ text, confirmLabel, onConfirm, onCancel }) => (
  <div className="pb-3 space-y-2.5">
    <p className="text-sm text-stone-700">{text}</p>
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 min-h-[44px] rounded-xl bg-stone-100 text-stone-700 text-sm font-semibold touch-manipulation"
      >
        Avbryt
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className="flex-1 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold touch-manipulation"
      >
        {confirmLabel}
      </button>
    </div>
  </div>
);

const sectionHeading = 'text-xs font-semibold text-stone-500 pt-6 pb-1';

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
    setActiveTab,
    addRecipe,
    customSubcategories,
    addCustomSubcategory,
  } = useRecipes();

  const [theme, setTheme] = useState<ThemeChoice>(getThemeChoice);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [showHouseholdModal, setShowHouseholdModal] = useState<boolean>(false);
  const [householdModalTab, setHouseholdModalTab] = useState<'create' | 'join'>('create');
  const [showSupabaseModal, setShowSupabaseModal] = useState<boolean>(false);

  // Synchronize settings modals with Android back button
  useModalBackHandler(showShareModal, () => setShowShareModal(false), 'share-modal');
  useModalBackHandler(showHouseholdModal, () => setShowHouseholdModal(false), 'household-auth-modal');
  useModalBackHandler(showSupabaseModal, () => setShowSupabaseModal(false), 'supabase-modal');

  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<'newCode' | 'clearRecipes' | 'reset' | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyCode = () => {
    if (!household) return;
    navigator.clipboard.writeText(household.joinCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const openHouseholdModal = (tab: 'create' | 'join') => {
    setHouseholdModalTab(tab);
    setShowHouseholdModal(true);
  };

  const openStoreOrder = () => {
    try {
      sessionStorage.setItem(OPEN_STORE_ORDER_KEY, '1');
    } catch {
      // ignore, the shopping list still opens
    }
    setActiveTab('shopping');
  };

  // Backup: save the recipes to a file, and read them back
  const handleSaveBackup = async () => {
    if (recipes.length === 0) {
      showToast('Det finns inga recept att spara');
      return;
    }
    const saved = await saveRecipeBackup(recipes, customSubcategories || []);
    if (saved) showToast(`${recipes.length} recept sparade i en fil`);
  };

  const handleReadBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const backup = await readRecipeBackup(file);
      const existingIds = new Set(recipes.map((r) => r.id));
      const existingTitles = new Set(recipes.map((r) => r.title.trim().toLowerCase()));
      let added = 0;
      let skipped = 0;
      for (const recipe of backup.recipes) {
        if (existingIds.has(recipe.id) || existingTitles.has(recipe.title.trim().toLowerCase())) {
          skipped++;
          continue;
        }
        // A new id, so a file from another household does not take over that household's recipe
        addRecipe({ ...recipe, id: `custom-rec-${Date.now()}-${added}` });
        existingTitles.add(recipe.title.trim().toLowerCase());
        added++;
      }
      backup.customSubcategories.forEach((sub) => {
        if (!(customSubcategories || []).includes(sub)) addCustomSubcategory(sub);
      });
      showToast(
        added === 0
          ? `Alla ${skipped} recept i filen finns redan`
          : skipped > 0
          ? `${added} recept ${added === 1 ? "inläst" : "inlästa"}, ${skipped} fanns redan`
          : `${added} recept ${added === 1 ? "inläst" : "inlästa"}`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Filen gick inte att läsa');
    }
  };

  const members = household?.members?.filter((m) => !m.status || m.status === 'approved') || [];

  return (
    <div className="min-h-screen bg-[#FCFAF5] pb-32 md:pb-16 w-full max-w-full overflow-x-hidden font-sans">
      {/* Toast Notification */}
      {toastMessage && <Toast message={toastMessage} />}

      {showShareModal && <HouseholdShareModal onClose={() => setShowShareModal(false)} />}
      {showHouseholdModal && (
        <HouseholdOnboarding onClose={() => setShowHouseholdModal(false)} initialTab={householdModalTab} />
      )}
      {showSupabaseModal && <SupabaseConfigModal onClose={() => setShowSupabaseModal(false)} />}

      {/* Header */}
      <div className="sticky top-0 md:static z-20 md:z-auto bg-[#FCFAF5]/95 backdrop-blur-md border-b border-[#EBE7DF] px-4 md:px-6 py-3 w-full">
        <div className="w-full max-w-md md:max-w-3xl lg:max-w-4xl mx-auto flex items-center justify-between gap-3">
          <h1 className="font-serif text-xl font-bold text-stone-900 leading-tight">Inställningar</h1>
          <span className="flex items-center gap-1.5 text-xs text-stone-500">
            <span className={`w-2 h-2 rounded-full ${isLiveSupabase ? 'bg-emerald-600' : 'bg-stone-400'}`} />
            {isLiveSupabase ? 'Synkas' : 'Bara på den här telefonen'}
          </span>
        </div>
      </div>

      <div className="w-full max-w-md md:max-w-3xl lg:max-w-4xl mx-auto px-4 md:px-6 pt-4">
        {/* Admin Pending Join Requests Banner */}
        {isHouseholdAdmin && joinRequests && joinRequests.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-amber-950 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-slide-down">
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
                        setToastMessage(`${joinRequests[0].displayName} är godkänd`);
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
          <div className="bg-stone-50 border border-amber-300/80 rounded-2xl p-4 text-stone-900 shadow-xs flex items-center justify-between gap-3 animate-slide-down">
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

        {/* Household: the one box on the page */}
        {!household ? (
          <div className="bg-white rounded-2xl border border-[#EBE7DF] p-4 space-y-3 mt-2">
            <div>
              <h2 className="font-serif text-lg font-bold text-stone-900">Hushåll</h2>
              <p className="text-sm text-stone-600 mt-0.5">Dela recept, veckoplan och inköpslista med dem du bor med.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => openHouseholdModal('create')}
                className="min-h-[44px] rounded-xl bg-[#284235] hover:bg-black text-white text-sm font-semibold touch-manipulation"
              >
                Skapa hushåll
              </button>
              <button
                type="button"
                onClick={() => openHouseholdModal('join')}
                className="min-h-[44px] rounded-xl border border-[#EBE7DF] bg-white hover:bg-stone-50 text-stone-800 text-sm font-semibold touch-manipulation"
              >
                Gå med via kod
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-[#EBE7DF] p-4 mt-2">
              <h2 className="font-serif text-lg font-bold text-stone-900 leading-tight">{household.name}</h2>
              <p className="text-sm text-stone-600 mt-0.5">
                Du är {currentUser.displayName}, {isHouseholdAdmin ? 'admin' : 'medlem'}
              </p>

              {/* Delningskod */}
              <div className="mt-4 pt-3 border-t border-[#EBE7DF]">
                <div className="text-xs text-stone-500">Delningskod</div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-2xl font-bold text-stone-900 font-mono tracking-widest">{household.joinCode}</span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-3 min-h-[40px] rounded-xl border border-[#EBE7DF] bg-white hover:bg-stone-50 text-stone-800 text-sm font-semibold flex items-center gap-1.5 touch-manipulation"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                    {copiedCode ? 'Kopierad' : 'Kopiera'}
                  </button>
                </div>
                {isHouseholdAdmin &&
                  (confirming === 'newCode' ? (
                    <div className="pt-2">
                      <Confirm
                        text="Den gamla koden slutar fungera. Inbjudningar med den behöver skickas igen."
                        confirmLabel="Byt kod"
                        onCancel={() => setConfirming(null)}
                        onConfirm={() => {
                          const newCode = regenerateHouseholdCode();
                          setConfirming(null);
                          showToast(`Ny kod: ${newCode}`);
                        }}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming('newCode')}
                      className="text-sm text-[#284235] font-semibold py-2 touch-manipulation"
                    >
                      Byt till ny kod
                    </button>
                  ))}
              </div>

              {/* Members */}
              <div className="mt-2 pt-3 border-t border-[#EBE7DF]">
                <div className="text-xs text-stone-500 pb-1">Medlemmar</div>
                <ul className="divide-y divide-[#EBE7DF]">
                  {members.map((m) => (
                    <li key={m.id} className="py-2 flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-stone-100 text-stone-700 text-xs font-semibold flex items-center justify-center shrink-0">
                        {m.initials || m.displayName[0]}
                      </span>
                      <span className="flex-1 min-w-0 text-sm text-stone-900 truncate">
                        {m.displayName}
                        {m.id === currentUser.id ? ' (du)' : ''}
                      </span>
                      {(m.isAdmin || m.id === household.creatorId) && (
                        <span className="text-xs text-stone-500">Admin</span>
                      )}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setShowShareModal(true)}
                  className="mt-1 text-sm text-[#284235] font-semibold py-2 flex items-center gap-1 touch-manipulation"
                >
                  {isHouseholdAdmin ? 'Hantera medlemmar' : 'Visa medlemmar'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="divide-y divide-[#EBE7DF] border-b border-[#EBE7DF] mt-2">
              <Row label="Skapa ett nytt hushåll" onClick={() => openHouseholdModal('create')} />
              <Row label="Gå med i ett annat hushåll" onClick={() => openHouseholdModal('join')} />
            </div>
          </>
        )}

        {/* Light or dark, on this phone */}
        <h2 className={sectionHeading}>Utseende</h2>
        <div className="grid grid-cols-3 gap-1 p-1 bg-stone-100 rounded-xl" role="radiogroup" aria-label="Utseende">
          {([
            ['system', 'Som telefonen'],
            ['light', 'Ljust'],
            ['dark', 'Mörkt'],
          ] as [ThemeChoice, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => {
                setTheme(value);
                setThemeChoice(value);
              }}
              className={`min-h-[40px] rounded-lg text-sm font-semibold touch-manipulation ${
                theme === value ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Other settings in the app */}
        <h2 className={sectionHeading}>Inköpslistan</h2>
        <div className="divide-y divide-[#EBE7DF] border-y border-[#EBE7DF]">
          <Row label="Butiker och avdelningarnas ordning" onClick={openStoreOrder} />
        </div>

        {/* Backup of the recipes */}
        <h2 className={sectionHeading}>Säkerhetskopia</h2>
        <div className="divide-y divide-[#EBE7DF] border-y border-[#EBE7DF]">
          <Row label="Spara recepten i en fil" detail={`${recipes.length} recept`} onClick={handleSaveBackup} />
          <label className="w-full min-h-[52px] py-3 flex items-center gap-3 text-left touch-manipulation active:bg-stone-100/70 cursor-pointer">
            <span className="flex-1 min-w-0 text-sm text-stone-900">Läs in recept från en fil</span>
            <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />
            <input type="file" accept="application/json,.json" className="hidden" onChange={handleReadBackup} />
          </label>
        </div>

        {/* Advanced: database, clearing and demo data */}
        <button
          type="button"
          onClick={() => {
            setShowAdvanced((v) => !v);
            setConfirming((c) => (c === 'newCode' ? c : null));
          }}
          aria-expanded={showAdvanced}
          className="w-full mt-6 min-h-[52px] flex items-center justify-between border-y border-[#EBE7DF] text-sm text-stone-900 touch-manipulation"
        >
          Avancerat
          <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        {showAdvanced && (
          <div className="divide-y divide-[#EBE7DF] border-b border-[#EBE7DF] animate-fade-in">
            <Row
              label="Databas och synk"
              detail={isLiveSupabase ? 'Supabase, ansluten' : 'Inte ansluten'}
              onClick={() => setShowSupabaseModal(true)}
            />

            {isHouseholdAdmin && (
              <div>
                <Row
                  label={`Rensa alla recept (${recipes.length})`}
                  danger
                  onClick={() => setConfirming(confirming === 'clearRecipes' ? null : 'clearRecipes')}
                />
                {confirming === 'clearRecipes' && (
                  <Confirm
                    text={`Alla ${recipes.length} recept tas bort för hela hushållet. Det går inte att ångra.`}
                    confirmLabel="Rensa recepten"
                    onCancel={() => setConfirming(null)}
                    onConfirm={() => {
                      clearAllRecipes();
                      setConfirming(null);
                      showToast('Alla recept är borttagna');
                    }}
                  />
                )}
              </div>
            )}

            <div>
              <Row
                label="Återställ demorecepten"
                detail="Bara den här telefonen"
                danger
                onClick={() => setConfirming(confirming === 'reset' ? null : 'reset')}
              />
              {confirming === 'reset' && (
                <Confirm
                  text="Recepten byts mot demorecepten, och veckoplanen och inköpslistan töms på den här telefonen."
                  confirmLabel="Återställ"
                  onCancel={() => setConfirming(null)}
                  onConfirm={() => {
                    resetToMockData();
                    setConfirming(null);
                    showToast('Demorecepten är återställda');
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* Version, so you can see that an update has arrived */}
        <p className="text-xs text-stone-500 pt-6 pb-8">Version {APP_VERSION}</p>
      </div>
    </div>
  );
};
