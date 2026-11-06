import React, { useState } from 'react';
import { useRecipes } from '../../context/RecipeContext';
import { X, Copy, Check, Plus, Pencil, Trash2, ChevronRight } from 'lucide-react';

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

  // Inline confirmation instead of the browser's own dialog
  const [confirming, setConfirming] = useState<
    { kind: 'removeMember'; id: string; name: string } | { kind: 'newCode' } | { kind: 'deleteOrLeave' } | null
  >(null);

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
    showToast(`Hushållet heter nu ${trimmed}`);
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
    showToast(`${trimmed} är tillagd`);
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
    showToast(`Namnet är ändrat till ${trimmed}`);
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
      showToast('Den som skapade hushållet kan inte tas bort');
      return;
    }

    const removed = await removeMemberFromHousehold(memberId);
    setConfirming(null);
    if (removed) {
      showToast(`${memberName} är borttagen från hushållet`);
    }
  };

  const handleLeaveHousehold = async (hhId: string, hhName: string) => {
    await leaveHousehold(hhId);
    setConfirming(null);
    showToast(`Du har lämnat ${hhName}`);
  };

  const handleDeleteHousehold = (hhId: string, hhName: string) => {
    const targetHh = households.find((h) => h.id === hhId);
    const adminId = targetHh?.creatorId || targetHh?.members[0]?.id;
    const isTargetAdmin = currentUser.id === adminId || targetHh?.members[0]?.id === currentUser.id;

    if (!isTargetAdmin) {
      handleLeaveHousehold(hhId, hhName);
      return;
    }

    deleteHousehold(hhId);
    setConfirming(null);
    showToast(`${hhName} är borttaget`);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;

    const success = await joinHouseholdByCode(joinCodeInput.trim(), currentUser.displayName, currentUser.roleTitle);
    if (success) {
      showToast('Du har gått med i hushållet');
      setShowJoinForm(false);
      setJoinCodeInput('');
    } else {
      showToast(`Inget hushåll har koden ${joinCodeInput}`);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHhNameInput.trim()) return;

    createHousehold(newHhNameInput.trim(), currentUser.displayName, currentUser.roleTitle, false);
    showToast(`${newHhNameInput.trim()} är skapat`);
    setShowCreateForm(false);
    setNewHhNameInput('');
  };


  const input = 'w-full h-11 bg-white border border-stone-300 rounded-xl px-3 text-base sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]';
  const primaryBtn = 'min-h-[44px] px-4 rounded-xl bg-[#284235] hover:bg-black disabled:opacity-40 text-white text-sm font-semibold touch-manipulation';
  const textBtn = 'text-sm text-[#284235] font-semibold py-2 touch-manipulation';
  const rowBtn = 'w-full min-h-[52px] py-3 flex items-center gap-3 text-left touch-manipulation active:bg-stone-100/70';
  const adminId = household?.creatorId || household?.members[0]?.id;
  const otherHouseholds = households.filter((h) => h.id !== household?.id);

  const ConfirmBox = ({ text, label, onConfirm }: { text: string; label: string; onConfirm: () => void }) => (
    <div className="pb-3 space-y-2.5 animate-fade-in">
      <p className="text-sm text-stone-700">{text}</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setConfirming(null)} className="flex-1 min-h-[44px] rounded-xl bg-stone-100 text-stone-700 text-sm font-semibold touch-manipulation">
          Avbryt
        </button>
        <button type="button" onClick={onConfirm} className="flex-1 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold touch-manipulation">
          {label}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in font-sans">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[#EBE7DF]">
          <h3 className="font-serif font-bold text-lg text-stone-900">Hushåll och medlemmar</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-100 touch-manipulation"
            aria-label="Stäng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast */}
        {toastMessage && (
          <div className="bg-stone-900 text-white px-5 py-2.5 text-sm flex items-center gap-2 animate-fade-in">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        <div className="px-5 pb-6 overflow-y-auto flex-1 text-sm">
          {/* Join requests (admin) */}
          {isHouseholdAdmin && joinRequests && joinRequests.length > 0 && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-1 divide-y divide-amber-200/70">
              {joinRequests.map((req) => (
                <div key={req.id} className="py-3 flex items-center gap-3">
                  <span className="flex-1 min-w-0 text-stone-900">
                    <span className="font-semibold">{req.displayName}</span> vill gå med
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await rejectJoinRequest(req.id);
                      if (ok) showToast(`Förfrågan från ${req.displayName} är nekad`);
                    }}
                    className="px-3 min-h-[40px] rounded-xl bg-white border border-stone-200 text-stone-700 text-sm font-semibold touch-manipulation"
                  >
                    Neka
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await approveJoinRequest(req.id);
                      if (ok) showToast(`${req.displayName} är med i hushållet`);
                    }}
                    className="px-3 min-h-[40px] rounded-xl bg-[#284235] text-white text-sm font-semibold touch-manipulation"
                  >
                    Godkänn
                  </button>
                </div>
              ))}
            </div>
          )}

          {household && (
            <>
              {/* Name and your role */}
              <div className="pt-4">
                {isEditingName ? (
                  <form onSubmit={handleSaveHouseholdName} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={householdNameInput}
                      onChange={(e) => setHouseholdNameInput(e.target.value)}
                      placeholder="Namn på hushållet"
                      aria-label="Namn på hushållet"
                      className={input}
                    />
                    <button type="submit" className={primaryBtn}>Spara</button>
                    <button
                      type="button"
                      onClick={() => {
                        setHouseholdNameInput(household.name);
                        setIsEditingName(false);
                      }}
                      className="px-2 min-h-[44px] text-stone-600 text-sm"
                    >
                      Avbryt
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-1">
                    <h2 className="font-serif text-2xl font-bold text-stone-900 truncate">{household.name}</h2>
                    {isHouseholdAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setHouseholdNameInput(household.name);
                          setIsEditingName(true);
                        }}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-800 hover:bg-stone-100 touch-manipulation shrink-0"
                        aria-label="Byt namn på hushållet"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
                <p className="text-stone-600">Du är {isHouseholdAdmin ? 'admin' : 'medlem'}</p>
              </div>

              {/* The code: the one box */}
              <div className="mt-4 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl p-4">
                <div className="text-xs text-stone-500">Delningskod</div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-3xl font-bold text-stone-900 tracking-[0.15em] tabular-nums">{household.joinCode}</span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-3.5 min-h-[44px] rounded-xl bg-[#284235] hover:bg-black text-white text-sm font-semibold flex items-center gap-1.5 touch-manipulation shrink-0"
                  >
                    {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedCode ? 'Kopierad' : 'Dela kod'}
                  </button>
                </div>
                <p className="text-xs text-stone-500 mt-1">Den som ska gå med skriver in koden i sin app.</p>
                {isHouseholdAdmin &&
                  (confirming?.kind === 'newCode' ? (
                    <div className="pt-3">
                      <ConfirmBox
                        text="Den gamla koden slutar fungera. Inbjudningar med den behöver skickas igen."
                        label="Byt kod"
                        onConfirm={() => {
                          const newCode = regenerateHouseholdCode();
                          setConfirming(null);
                          showToast(`Ny kod: ${newCode}`);
                        }}
                      />
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirming({ kind: 'newCode' })} className={`${textBtn} mt-1`}>
                      Byt till ny kod
                    </button>
                  ))}
              </div>

              {/* Members */}
              <h4 className="text-xs font-semibold text-stone-500 pt-6 pb-1">Medlemmar ({household.members?.length || 0})</h4>
              <ul className="divide-y divide-[#EBE7DF] border-y border-[#EBE7DF]">
                {household.members.map((member) => {
                  const isMemberAdmin = member.id === adminId || member.roleTitle === 'Admin';
                  const isCurrent = currentUser.id === member.id || currentUser.displayName === member.displayName;

                  if (editingMemberId === member.id) {
                    return (
                      <li key={member.id} className="py-3">
                        <form onSubmit={(e) => handleSaveMemberEdit(e, member.id)} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingMemberName}
                            onChange={(e) => setEditingMemberName(e.target.value)}
                            aria-label="Namn"
                            className={input}
                          />
                          <button type="submit" disabled={!editingMemberName.trim()} className={primaryBtn}>Spara</button>
                          <button type="button" onClick={() => setEditingMemberId(null)} className="px-2 min-h-[44px] text-stone-600 text-sm">
                            Avbryt
                          </button>
                        </form>
                      </li>
                    );
                  }

                  return (
                    <li key={member.id}>
                      <div className="py-2 flex items-center gap-3">
                        {/* Tapping a name uses that profile on this phone */}
                        <button
                          type="button"
                          onClick={() => {
                            if (isMemberAdmin && !isHouseholdAdmin) {
                              showToast('Bara den som skapade hushållet kan använda admins profil');
                              return;
                            }
                            setCurrentUser(member);
                          }}
                          className="flex items-center gap-3 text-left flex-1 min-w-0 min-h-[44px] touch-manipulation"
                        >
                          <span className="w-8 h-8 rounded-full bg-stone-100 text-stone-700 text-xs font-semibold flex items-center justify-center shrink-0">
                            {member.initials || member.displayName.charAt(0).toUpperCase()}
                          </span>
                          <span className="flex-1 min-w-0 truncate text-stone-900">
                            {member.displayName}
                            {isCurrent ? ' (du)' : ''}
                          </span>
                          {isMemberAdmin && <span className="text-xs text-stone-500">admin</span>}
                        </button>
                        {(isCurrent || isHouseholdAdmin) && (
                          <button
                            type="button"
                            onClick={() => handleStartEditMember(member)}
                            className="w-10 h-10 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-800 hover:bg-stone-100 touch-manipulation shrink-0"
                            aria-label={`Ändra namn för ${member.displayName}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {isHouseholdAdmin && !isMemberAdmin && (
                          <button
                            type="button"
                            onClick={() => setConfirming({ kind: 'removeMember', id: member.id, name: member.displayName })}
                            className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-stone-400 hover:text-rose-700 hover:bg-rose-50 touch-manipulation shrink-0"
                            aria-label={`Ta bort ${member.displayName} från hushållet`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {confirming?.kind === 'removeMember' && confirming.id === member.id && (
                        <ConfirmBox
                          text={`${member.displayName} tas bort från hushållet.`}
                          label="Ta bort"
                          onConfirm={() => handleRemoveMember(member.id, member.displayName)}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>

              {/* Add a person without an account (admin) */}
              {isHouseholdAdmin &&
                (showAddMember ? (
                  <form onSubmit={handleAddMember} className="pt-3 space-y-2">
                    <label className="block text-xs text-stone-500" htmlFor="new-member-name">
                      Namn på personen
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="new-member-name"
                        type="text"
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        placeholder="T.ex. Elin"
                        className={input}
                      />
                      <button type="submit" disabled={!newMemberName.trim()} className={primaryBtn}>Lägg till</button>
                    </div>
                    <button type="button" onClick={() => setShowAddMember(false)} className="text-sm text-stone-600 py-1">
                      Avbryt
                    </button>
                  </form>
                ) : (
                  <button type="button" onClick={() => setShowAddMember(true)} className={`${textBtn} flex items-center gap-1`}>
                    <Plus className="w-4 h-4" />
                    Lägg till person utan konto
                  </button>
                ))}
            </>
          )}

          {/* Other households, new, join */}
          <h4 className="text-xs font-semibold text-stone-500 pt-6 pb-1">
            {otherHouseholds.length > 0 ? 'Byt hushåll' : 'Fler hushåll'}
          </h4>
          <div className="divide-y divide-[#EBE7DF] border-y border-[#EBE7DF]">
            {otherHouseholds.map((hh) => (
              <button key={hh.id} type="button" onClick={() => switchHousehold(hh.id)} className={rowBtn}>
                <span className="flex-1 min-w-0 truncate text-stone-900">{hh.name}</span>
                <span className="text-xs text-stone-500">
                  {hh.members?.length || 1} {(hh.members?.length || 1) === 1 ? 'medlem' : 'medlemmar'}
                </span>
                <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />
              </button>
            ))}

            <div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(!showCreateForm);
                  setShowJoinForm(false);
                }}
                className={rowBtn}
                aria-expanded={showCreateForm}
              >
                <span className="flex-1 text-stone-900">Skapa nytt hushåll</span>
                <ChevronRight className={`w-4 h-4 text-stone-300 shrink-0 transition-transform ${showCreateForm ? 'rotate-90' : ''}`} />
              </button>
              {showCreateForm && (
                <form onSubmit={handleCreate} className="pb-3 flex items-center gap-2 animate-fade-in">
                  <input
                    type="text"
                    value={newHhNameInput}
                    onChange={(e) => setNewHhNameInput(e.target.value)}
                    placeholder="T.ex. Sommarstugan"
                    aria-label="Namn på nytt hushåll"
                    className={input}
                  />
                  <button type="submit" disabled={!newHhNameInput.trim()} className={primaryBtn}>Skapa</button>
                </form>
              )}
            </div>

            <div>
              <button
                type="button"
                onClick={() => {
                  setShowJoinForm(!showJoinForm);
                  setShowCreateForm(false);
                }}
                className={rowBtn}
                aria-expanded={showJoinForm}
              >
                <span className="flex-1 text-stone-900">Gå med i ett annat hushåll</span>
                <ChevronRight className={`w-4 h-4 text-stone-300 shrink-0 transition-transform ${showJoinForm ? 'rotate-90' : ''}`} />
              </button>
              {showJoinForm && (
                <form onSubmit={handleJoin} className="pb-3 flex items-center gap-2 animate-fade-in">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Kod, 6 siffror"
                    aria-label="Delningskod"
                    className={`${input} tracking-widest`}
                  />
                  <button type="submit" disabled={joinCodeInput.length < 6} className={primaryBtn}>Gå med</button>
                </form>
              )}
            </div>

            {/* Delete (admin) or leave (member): last, since it cannot be undone */}
            {household && (
              <div>
                <button
                  type="button"
                  onClick={() => setConfirming(confirming?.kind === 'deleteOrLeave' ? null : { kind: 'deleteOrLeave' })}
                  className={rowBtn}
                >
                  <span className="flex-1 text-rose-700">{isHouseholdAdmin ? 'Ta bort hushållet' : 'Lämna hushållet'}</span>
                </button>
                {confirming?.kind === 'deleteOrLeave' && (
                  <ConfirmBox
                    text={
                      isHouseholdAdmin
                        ? `${household.name} tas bort för alla medlemmar, med recept, veckoplan och inköpslista.`
                        : `Du lämnar ${household.name}. Du kan gå med igen med koden.`
                    }
                    label={isHouseholdAdmin ? 'Ta bort' : 'Lämna'}
                    onConfirm={() =>
                      isHouseholdAdmin
                        ? handleDeleteHousehold(household.id, household.name)
                        : handleLeaveHousehold(household.id, household.name)
                    }
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
