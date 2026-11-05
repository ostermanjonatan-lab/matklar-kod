import React, { useState } from 'react';
import { useRecipes } from '../../context/RecipeContext';
import {
  X,
  Users,
  Copy,
  Check,
  Plus,
  KeyRound,
  Pencil,
  Trash2,
  UserCheck,
  UserPlus,
  RotateCw,
  Home,
  Crown,
  Shield,
  ShieldAlert,
  LogOut,
} from 'lucide-react';

interface HouseholdShareModalProps {
  onClose: () => void;
}

export const HouseholdShareModal: React.FC<HouseholdShareModalProps> = ({ onClose }) => {
  const {
    household,
    households,
    currentUser,
    isHouseholdAdmin,
    setCurrentUser,
    createHousehold,
    joinHouseholdByCode,
    switchHousehold,
    deleteHousehold,
    leaveHousehold,
    regenerateHouseholdCode,
    setHouseholdName,
    addMemberToHousehold,
    updateMemberInHousehold,
    removeMemberFromHousehold,
    joinRequests,
    approveJoinRequest,
    rejectJoinRequest,
  } = useRecipes();

  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [newHhNameInput, setNewHhNameInput] = useState<string>('');
  const [showJoinForm, setShowJoinForm] = useState<boolean>(false);
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Household name editing
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [householdNameInput, setHouseholdNameInput] = useState<string>(household?.name || '');

  // Member management
  const [showAddMember, setShowAddMember] = useState<boolean>(false);
  const [newMemberName, setNewMemberName] = useState<string>('');

  // Member editing
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingMemberName, setEditingMemberName] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyCode = () => {
    if (!household) return;
    navigator.clipboard.writeText(household.joinCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);

    if (navigator.share) {
      navigator.share({
        title: 'Gå med i vårt hushåll',
        text: `Gå med i ${household.name} i Matklar med vår delningskod: ${household.joinCode}`,
      }).catch(() => {});
    }
  };

  const handleSaveHouseholdName = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isHouseholdAdmin) {
      showToast('Endast hushållets admin kan byta namn på hushållet');
      return;
    }
    const trimmed = householdNameInput.trim();
    if (!trimmed) return;
    setHouseholdName(trimmed);
    setIsEditingName(false);
    showToast(`Hushållet döptes om till "${trimmed}"`);
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMemberName.trim();
    if (!trimmed) return;

    addMemberToHousehold({
      displayName: trimmed,
      roleTitle: 'Medlem',
    });

    setNewMemberName('');
    setShowAddMember(false);
    showToast(`${trimmed} lades till i hushållet`);
  };

  const handleStartEditMember = (member: any) => {
    setEditingMemberId(member.id);
    setEditingMemberName(member.displayName);
  };

  const handleSaveMemberEdit = (e: React.FormEvent, memberId: string) => {
    e.preventDefault();
    const trimmed = editingMemberName.trim();
    if (!trimmed) return;

    updateMemberInHousehold(memberId, {
      displayName: trimmed,
    });

    setEditingMemberId(null);
    showToast(`Namnet ändrades till "${trimmed}"`);
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!isHouseholdAdmin) {
      showToast('Endast hushållets admin kan ta bort medlemmar');
      return;
    }

    if (!household || household.members.length <= 1) {
      showToast('Hushållet måste ha minst en medlem');
      return;
    }

    const adminId = household.creatorId || household.members[0]?.id;
    if (memberId === adminId) {
      showToast('Administratören och skaparen av hushållet kan inte tas bort');
      return;
    }

    if (window.confirm(`Vill du ta bort ${memberName} från hushållet?`)) {
      const removed = await removeMemberFromHousehold(memberId);
      if (removed) {
        showToast(`${memberName} togs bort från hushållet`);
      }
    }
  };

  const handleLeaveHousehold = async (hhId: string, hhName: string) => {
    if (window.confirm(`Vill du lämna hushållet "${hhName}"?`)) {
      await leaveHousehold(hhId);
      showToast(`Du har lämnat "${hhName}"`);
    }
  };

  const handleDeleteHousehold = (hhId: string, hhName: string) => {
    const targetHh = households.find((h) => h.id === hhId);
    const adminId = targetHh?.creatorId || targetHh?.members[0]?.id;
    const isTargetAdmin = currentUser.id === adminId || targetHh?.members[0]?.id === currentUser.id;

    if (!isTargetAdmin) {
      handleLeaveHousehold(hhId, hhName);
      return;
    }

    if (window.confirm(`Är du säker på att du vill ta bort hushållet "${hhName}"?`)) {
      deleteHousehold(hhId);
      showToast(`Hushållet "${hhName}" togs bort`);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;

    const success = await joinHouseholdByCode(joinCodeInput.trim(), currentUser.displayName, currentUser.roleTitle);
    if (success) {
      showToast(`Gick med i hushåll ${joinCodeInput.toUpperCase()}`);
      setShowJoinForm(false);
      setJoinCodeInput('');
    } else {
      showToast(`Hittade inget hushåll med koden "${joinCodeInput.toUpperCase()}"`);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHhNameInput.trim()) return;

    createHousehold(newHhNameInput.trim(), currentUser.displayName, currentUser.roleTitle, false);
    showToast(`Skapade hushållet "${newHhNameInput.trim()}"`);
    setShowCreateForm(false);
    setNewHhNameInput('');
  };


  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in font-sans">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-stone-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-stone-800 border border-stone-700 text-emerald-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Hushåll & Medlemmar</h3>
              <p className="text-xs text-stone-400">Växla, byt namn eller lägg till medlemmar</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-2xl bg-stone-800 text-stone-300 hover:text-white flex items-center justify-center touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast */}
        {toastMessage && (
          <div className="bg-emerald-900 text-white px-4 py-2.5 text-xs font-semibold flex items-center gap-2 animate-fade-in border-b border-emerald-800">
            <Check className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Section: Väntande förfrågningar (Admin only) */}
          {isHouseholdAdmin && joinRequests && joinRequests.length > 0 && (
            <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 space-y-3 shadow-xs animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-200/80 text-amber-900 flex items-center justify-center">
                    <ShieldAlert className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                      <span>Väntande förfrågningar</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 font-mono text-[10px] font-bold">
                        {joinRequests.length}
                      </span>
                    </h4>
                    <p className="text-[10px] text-amber-800/80">
                      Endast du som admin kan släppa in nya medlemmar
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                {joinRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-white rounded-xl p-3 border border-amber-200/70 shadow-2xs flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                        {(req.displayName || 'M').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-stone-900 text-xs block truncate">
                          {req.displayName}
                        </span>
                        <span className="text-[10px] text-stone-400 block">
                          Vill gå med i hushållet
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await approveJoinRequest(req.id);
                          if (ok) showToast(`${req.displayName} godkändes och lades till!`);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-semibold text-[11px] flex items-center gap-1 shadow-2xs transition-all touch-manipulation min-h-[36px]"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Godkänn</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await rejectJoinRequest(req.id);
                          if (ok) showToast(`Förfrågan från ${req.displayName} nekades`);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-rose-50 hover:text-rose-700 text-stone-600 font-semibold text-[11px] border border-stone-200 transition-all touch-manipulation min-h-[36px]"
                        title="Neka förfrågan"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Neka</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Mina Hushåll (Växla & Hantera) */}
          <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-bold text-stone-900 block text-xs">
                  Mina Hushåll ({households.length})
                </label>
                <p className="text-[11px] text-stone-400">
                  Klicka på ett hushåll för att växla
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(!showCreateForm);
                    setShowJoinForm(false);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-[11px] flex items-center gap-1 transition-all"
                  title="Skapa ytterligare hushåll"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nytt</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowJoinForm(!showJoinForm);
                    setShowCreateForm(false);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-[11px] flex items-center gap-1 transition-all"
                  title="Gå med med kod"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Gå med</span>
                </button>
              </div>
            </div>

            {/* Create inline form */}
            {showCreateForm && (
              <form
                onSubmit={handleCreate}
                className="bg-stone-50 border border-emerald-600/40 rounded-xl p-3.5 space-y-3 animate-slide-down"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-stone-800 text-xs flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5 text-emerald-700" />
                    Skapa nytt hushåll
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="text-stone-400 hover:text-stone-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <input
                  type="text"
                  value={newHhNameInput}
                  onChange={(e) => setNewHhNameInput(e.target.value)}
                  placeholder="T.ex. Sommarstugan, Kollektivet..."
                  className="w-full h-10 bg-white border border-stone-300 rounded-xl px-3 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium"
                  autoFocus
                />

                <button
                  type="submit"
                  disabled={!newHhNameInput.trim()}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl active:scale-95 shadow-xs transition-all touch-manipulation min-h-[40px]"
                >
                  Skapa hushåll
                </button>
              </form>
            )}

            {/* Join inline form */}
            {showJoinForm && (
              <form
                onSubmit={handleJoin}
                className="bg-stone-50 border border-emerald-600/40 rounded-xl p-3.5 space-y-3 animate-slide-down"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-stone-800 text-xs flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                    Gå med i hushåll med kod
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowJoinForm(false)}
                    className="text-stone-400 hover:text-stone-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="T.ex. 482195"
                  className="w-full h-11 bg-white border border-stone-300 rounded-xl px-3 text-base font-mono tracking-widest text-center text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-bold"
                  autoFocus
                />

                <button
                  type="submit"
                  disabled={!joinCodeInput.trim()}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl active:scale-95 shadow-xs transition-all touch-manipulation min-h-[40px]"
                >
                  Anslut & Växla
                </button>
              </form>
            )}

            {/* List of households */}
            <div className="space-y-1.5">
              {households.map((hh) => {
                const isActive = household?.id === hh.id;

                return (
                  <div
                    key={hh.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      isActive
                        ? 'bg-emerald-50/80 border-emerald-400/80 shadow-xs'
                        : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!isActive) switchHousehold(hh.id);
                      }}
                      className="flex items-center gap-2.5 text-left flex-1 min-w-0"
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                          isActive ? 'bg-emerald-700 text-white' : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        <Home className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-stone-900 text-xs truncate">
                            {hh.name}
                          </span>
                          {isActive && (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900 text-[10px] font-bold">
                              Aktivt
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-stone-400 block font-mono">
                          Kod: {hh.joinCode} • {hh.members?.length || 1} medlem{(hh.members?.length || 1) > 1 ? 'mar' : ''}
                        </span>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => switchHousehold(hh.id)}
                          className="px-2.5 py-1.5 bg-stone-200 hover:bg-emerald-600 hover:text-white rounded-lg text-[11px] font-semibold text-stone-700 transition-all flex items-center gap-1"
                        >
                          <RotateCw className="w-3 h-3" />
                          <span>Växla</span>
                        </button>
                      )}

                      {/* If admin: trash icon (delete). If member: LogOut icon (leave) */}
                      <button
                        type="button"
                        onClick={() => handleDeleteHousehold(hh.id, hh.name)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          hh.creatorId === currentUser.id || hh.members[0]?.id === currentUser.id
                            ? 'text-stone-400 hover:text-red-600 hover:bg-red-50'
                            : 'text-stone-400 hover:text-amber-700 hover:bg-amber-50'
                        }`}
                        title={
                          hh.creatorId === currentUser.id || hh.members[0]?.id === currentUser.id
                            ? `Ta bort ${hh.name}`
                            : `Lämna ${hh.name}`
                        }
                      >
                        {hh.creatorId === currentUser.id || hh.members[0]?.id === currentUser.id ? (
                          <Trash2 className="w-3.5 h-3.5" />
                        ) : (
                          <LogOut className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Household Card with Edit Name & Sharing Code */}
          {household && (
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                    Aktivt Hushåll
                  </span>
                  {isHouseholdAdmin && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                      <Crown className="w-2.5 h-2.5 text-amber-700" />
                      Du är admin
                    </span>
                  )}
                </div>

                {isEditingName ? (
                  <form onSubmit={handleSaveHouseholdName} className="mt-1.5 flex items-center gap-2">
                    <input
                      type="text"
                      value={householdNameInput}
                      onChange={(e) => setHouseholdNameInput(e.target.value)}
                      placeholder="Namn på hushållet"
                      className="flex-1 h-10 bg-white border border-emerald-600 rounded-xl px-3 text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="h-10 px-3.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-semibold text-xs rounded-xl transition-all"
                    >
                      Spara
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHouseholdNameInput(household.name);
                        setIsEditingName(false);
                      }}
                      className="h-10 px-2.5 text-stone-500 hover:text-stone-800 text-xs font-medium"
                    >
                      Avbryt
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <h2 className="text-xl font-bold text-stone-900">
                      {household.name}
                    </h2>
                    {isHouseholdAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setHouseholdNameInput(household.name);
                          setIsEditingName(true);
                        }}
                        className="p-1.5 text-stone-400 hover:text-emerald-700 rounded-lg hover:bg-stone-200/70 transition-colors"
                        title="Byt namn på hushållet"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Sharing Code Display */}
              <div className="bg-white border border-stone-300 rounded-xl py-3 px-4 flex items-center justify-between shadow-xs">
                <div className="text-left">
                  <span className="text-[10px] text-stone-400 font-semibold block uppercase">
                    Delningskod
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-stone-900 tracking-widest font-mono">
                      {household.joinCode}
                    </span>
                    {isHouseholdAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          const newCode = regenerateHouseholdCode();
                          showToast(`Ny 6-siffrig kod genererad: ${newCode}`);
                        }}
                        className="p-1 text-stone-400 hover:text-emerald-700 rounded-lg hover:bg-stone-100 transition-colors"
                        title="Skapa ny 6-siffrig kod"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-black active:scale-95 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all touch-manipulation min-h-[44px]"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? 'Kopierad' : 'Dela kod'}</span>
                </button>
              </div>

              <p className="text-[11px] text-stone-500 text-center leading-relaxed">
                Dela koden med din sambo eller familj så synkas recept, veckoplan och inköpslistor.
              </p>
            </div>
          )}

          {/* Members List & Management */}
          {household && (
            <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-bold text-stone-900 block text-xs">
                    Medlemmar ({household.members?.length || 0})
                  </label>
                  <p className="text-[11px] text-stone-400">
                    {isHouseholdAdmin
                      ? 'Som administratör kan du hantera hushållets medlemmar'
                      : 'Endast administratören kan ta bort andra medlemmar'}
                  </p>
                </div>

                {isHouseholdAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowAddMember(!showAddMember)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-semibold text-xs flex items-center gap-1.5 transition-all touch-manipulation min-h-[36px]"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Lägg till</span>
                  </button>
                )}
              </div>

              {/* Informational note for non-admins */}
              {!isHouseholdAdmin && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-amber-900">
                  <Shield className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <span className="font-bold block">Du är ansluten som medlem</span>
                    Endast hushållets admin ({household.members.find(m => m.id === (household.creatorId || household.members[0]?.id))?.displayName || 'skaparen'}) kan ta bort andra medlemmar och ändra inställningar.
                  </div>
                </div>
              )}

              {/* Add Member Form */}
              {showAddMember && isHouseholdAdmin && (
                <form
                  onSubmit={handleAddMember}
                  className="bg-stone-50 border border-emerald-600/40 rounded-xl p-3.5 space-y-3 animate-slide-down"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-800 text-xs flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-emerald-700" />
                      Lägg till ny medlem
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddMember(false)}
                      className="text-stone-400 hover:text-stone-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-stone-500 block mb-1">
                        Namn
                      </label>
                      <input
                        type="text"
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        placeholder="T.ex. Elin eller Sambon"
                        className="w-full h-10 bg-white border border-stone-300 rounded-xl px-3 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                        autoFocus
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!newMemberName.trim()}
                    className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl active:scale-95 shadow-xs transition-all touch-manipulation min-h-[42px]"
                  >
                    Spara medlem
                  </button>
                </form>
              )}

              {/* Member Cards */}
              <div className="space-y-2 pt-1">
                {household.members && household.members.length > 0 ? (
                  household.members.map((member) => {
                    const adminId = household.creatorId || household.members[0]?.id;
                    const isMemberAdmin = member.id === adminId || member.roleTitle === 'Admin';
                    const isCurrent = currentUser.id === member.id || currentUser.displayName === member.displayName;
                    const isEditingThis = editingMemberId === member.id;

                    if (isEditingThis) {
                      return (
                        <form
                          key={member.id}
                          onSubmit={(e) => handleSaveMemberEdit(e, member.id)}
                          className="p-3.5 bg-stone-50 border border-emerald-600/50 rounded-xl space-y-2.5 animate-fade-in shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-stone-800 text-xs flex items-center gap-1.5">
                              <Pencil className="w-3.5 h-3.5 text-emerald-700" />
                              Ändra namn
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingMemberId(null)}
                              className="text-stone-400 hover:text-stone-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div>
                            <label className="text-[10px] uppercase font-bold text-stone-500 block mb-1">
                              Namn
                            </label>
                            <input
                              type="text"
                              value={editingMemberName}
                              onChange={(e) => setEditingMemberName(e.target.value)}
                              className="w-full h-9 bg-white border border-stone-300 rounded-xl px-3 text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                              autoFocus
                            />
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="submit"
                              disabled={!editingMemberName.trim()}
                              className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl active:scale-95 transition-all touch-manipulation min-h-[38px]"
                            >
                              Spara ändring
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingMemberId(null)}
                              className="px-3 py-2 text-stone-500 hover:text-stone-800 text-xs font-medium"
                            >
                              Avbryt
                            </button>
                          </div>
                        </form>
                      );
                    }

                    return (
                      <div
                        key={member.id}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                          isCurrent
                            ? 'bg-emerald-50/70 border-emerald-300 shadow-xs'
                            : 'bg-white border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (isMemberAdmin && !isHouseholdAdmin) {
                              showToast('Endast skaparen av hushållet har tillgång till administratörsprofilen');
                              return;
                            }
                            setCurrentUser(member);
                          }}
                          className="flex items-center gap-3 text-left flex-1 min-w-0"
                        >
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                              isCurrent
                                ? 'bg-emerald-700 text-white'
                                : isMemberAdmin
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-stone-200 text-stone-700'
                            }`}
                          >
                            {isMemberAdmin && !isCurrent ? (
                              <Crown className="w-4 h-4 text-amber-700" />
                            ) : (
                              member.initials || member.displayName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-stone-900 text-xs truncate">
                                {member.displayName}
                              </span>

                              {isMemberAdmin && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300/80 text-[10px] font-bold shrink-0">
                                  <Crown className="w-2.5 h-2.5 text-amber-700" />
                                  Admin
                                </span>
                              )}

                              {isCurrent && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-200/70 text-emerald-800 text-[10px] font-bold shrink-0">
                                  <UserCheck className="w-2.5 h-2.5" />
                                  Du
                                </span>
                              )}

                              {!isMemberAdmin && !isCurrent && (
                                <span className="text-[10px] text-stone-400 font-medium">
                                  Medlem
                                </span>
                              )}
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-1 ml-2">
                          {/* Only allow editing own name, or admin editing members */}
                          {(isCurrent || isHouseholdAdmin) && (
                            <button
                              type="button"
                              onClick={() => handleStartEditMember(member)}
                              className="p-2 text-stone-400 hover:text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors touch-manipulation"
                              title={`Ändra namn för ${member.displayName}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Only Admin can remove other members */}
                          {isHouseholdAdmin && !isMemberAdmin && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member.id, member.displayName)}
                              className="p-2 text-stone-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors touch-manipulation"
                              title={`Ta bort ${member.displayName} från hushållet`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-stone-400 py-3">Inga medlemmar hittades</p>
                )}
              </div>

              {/* Leave household button for non-admins */}
              {!isHouseholdAdmin && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleLeaveHousehold(household.id, household.name)}
                    className="w-full py-2.5 px-3 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-50 text-red-700 font-semibold text-xs flex items-center justify-center gap-2 transition-all touch-manipulation min-h-[40px]"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Lämna detta hushåll</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 bg-stone-900 hover:bg-black active:scale-95 text-white font-semibold text-xs rounded-xl touch-manipulation min-h-[48px]"
          >
            Klar
          </button>
        </div>
      </div>
    </div>
  );
};
