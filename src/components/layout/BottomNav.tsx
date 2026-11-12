import React, { useState, useEffect } from 'react';
import { useRecipes } from '../../context/RecipeContext';
import type { TabType } from '../../types/recipe';
import { Utensils, CalendarDays, ShoppingCart, Settings, Plus } from 'lucide-react';

interface BottomNavProps {
  onAddRecipeClick?: () => void;
  onAddShoppingItemClick?: () => void;
}

/** The arc on top of the menu, as a mask: filled below the curve. */
const NAV_ARC_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 14" preserveAspectRatio="none"><path d="M0,14 Q50,-14 100,14 Z" fill="black"/></svg>'
)}")`;

export const BottomNav: React.FC<BottomNavProps> = ({ onAddRecipeClick, onAddShoppingItemClick }) => {
  const { activeTab, setActiveTab, shoppingList, selectedRecipe, isHouseholdAdmin, joinRequests } = useRecipes();
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  // Close on Escape key
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  const uncheckedCount = shoppingList.filter((item) => !item.checked).length;

  const handleTabClick = (tab: TabType) => {
    if (isMenuOpen) setIsMenuOpen(false);
    if (activeTab === tab) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (document.documentElement) document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
      if (document.body) document.body.scrollTo({ top: 0, behavior: 'smooth' });
      const mainEl = document.querySelector('main');
      if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
      // Recept igen: sökfältet får fokus (i klicket, så att tangentbordet öppnas på telefonen)
      if (tab === 'recipes') {
        const search = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-recipe-search]')).find((el) => el.offsetParent !== null);
        search?.focus({ preventScroll: true });
      }
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      const mainEl = document.querySelector('main');
      if (mainEl) mainEl.scrollTop = 0;
      setActiveTab(tab);
    }
  };

  const handleAddButtonClick = () => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
      return;
    }

    if (activeTab === 'recipes') {
      onAddRecipeClick?.();
    } else if (activeTab === 'shopping') {
      onAddShoppingItemClick?.();
    } else {
      setIsMenuOpen(true);
    }
  };

  const addButtonLabel = isMenuOpen
    ? 'Stäng meny'
    : activeTab === 'recipes'
    ? 'Lägg till recept'
    : activeTab === 'shopping'
    ? 'Lägg till inköp'
    : 'Lägg till';

  return (
    <div className="md:hidden">
      {/* Backdrop (z-[35]: dims content behind bottom navigation and sliding menu) */}
      <div
        className={`fixed inset-0 z-[35] bg-stone-900/35 backdrop-blur-[2px] transition-opacity duration-300 ${
          isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Quick Add Menu (z-[38]: slides up from behind the z-40 bottom navigation bar) */}
      <div className="fixed bottom-[calc(3.75rem+max(1.25rem,env(safe-area-inset-bottom,0px)))] left-1/2 -translate-x-1/2 w-full max-w-md pointer-events-none z-[38] flex justify-center px-4">
        <div
          className={`w-[300px] max-w-[calc(100%-1rem)] bg-white rounded-t-2xl rounded-b-none pt-2 px-2 pb-7 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] border-t border-x border-[#EBE7DF] flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isMenuOpen
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
          }`}
          style={{
            transform: isMenuOpen
              ? 'translateY(0)'
              : 'translateY(calc(100% + 5rem))',
          }}
          role="dialog"
          aria-modal={isMenuOpen}
          aria-hidden={!isMenuOpen}
          aria-label="Lägg till meny"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Two plain rows: what each one does, and for recipes the ways to add one */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(false);
              onAddRecipeClick?.();
            }}
            className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-stone-50 active:bg-stone-100 text-left touch-manipulation cursor-pointer"
          >
            <Utensils className="w-5 h-5 text-stone-400 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-stone-900 leading-tight">Lägg till recept</span>
              <span className="block text-sm text-stone-500 leading-tight mt-0.5">Skriv, från länk eller foto</span>
            </span>
          </button>
          <div className="h-px bg-[#EBE7DF] mx-2" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(false);
              onAddShoppingItemClick?.();
            }}
            className="flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-stone-50 active:bg-stone-100 text-left touch-manipulation cursor-pointer"
          >
            <ShoppingCart className="w-5 h-5 text-stone-400 shrink-0" />
            <span className="text-[15px] font-semibold text-stone-900">Lägg till vara</span>
          </button>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 pt-[14px] pb-safe font-sans">
        {/* See-through background with blur, cut to the menu's shape: a low arc on top that
            rises about 14 px towards the middle. It is a layer of its own so the plus button,
            which reaches a little above the arc, is not cut off.
            The inner buttons (Planerare, Inköp) sit about 6 px higher than the outer ones,
            which is how much higher the arc is at their place, so the row follows the curve. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/70 to-[#BFD6C7]/90 backdrop-blur-xl backdrop-saturate-150"
          style={{
            WebkitMaskImage: `${NAV_ARC_MASK}, linear-gradient(#000, #000)`,
            maskImage: `${NAV_ARC_MASK}, linear-gradient(#000, #000)`,
            WebkitMaskSize: '100% 14px, 100% calc(100% - 13px)',
            maskSize: '100% 14px, 100% calc(100% - 13px)',
            WebkitMaskPosition: 'top, bottom',
            maskPosition: 'top, bottom',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
          }}
        />
        <svg
          className="absolute top-0 left-0 w-full h-[14px] pointer-events-none drop-shadow-[0_-3px_6px_rgba(0,0,0,0.06)]"
          viewBox="0 0 100 14"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0,14 Q50,-14 100,14" fill="none" stroke="#E5E0D6" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="relative max-w-md mx-auto flex items-center justify-between px-3 py-1.5">
          {/* Recept */}
          <button
            type="button"
            onClick={() => handleTabClick('recipes')}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-2xl transition-all active:scale-95 touch-manipulation min-h-[52px] ${
              activeTab === 'recipes' && !selectedRecipe
                ? 'text-[#284235] font-bold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
            aria-label="Recept"
          >
            <Utensils
              className={`w-5 h-5 transition-transform ${
                activeTab === 'recipes' && !selectedRecipe ? 'scale-110 stroke-[2.3]' : 'stroke-[1.6]'
              }`}
            />
            <span className="text-[11px] mt-1 font-semibold leading-tight">Recept</span>
          </button>

          {/* Planerare */}
          <button
            type="button"
            onClick={() => handleTabClick('mealplan')}
            className={`-translate-y-1.5 flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-2xl transition-all active:scale-95 touch-manipulation min-h-[52px] ${
              activeTab === 'mealplan' && !selectedRecipe
                ? 'text-[#284235] font-bold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
            aria-label="Planerare"
          >
            <CalendarDays
              className={`w-5 h-5 transition-transform ${
                activeTab === 'mealplan' && !selectedRecipe ? 'scale-110 stroke-[2.3]' : 'stroke-[1.6]'
              }`}
            />
            <span className="text-[11px] mt-1 font-semibold leading-tight">Planerare</span>
          </button>

          {/* Prominent Center Action Button */}
          <div className="flex-1 flex items-center justify-center px-1">
            <button
              type="button"
              onClick={handleAddButtonClick}
              className={`w-12 h-12 -mt-4 -translate-y-3 rounded-full transition-all touch-manipulation flex items-center justify-center shadow-lg relative z-10 cursor-pointer ${
                isMenuOpen
                  ? 'bg-stone-900 text-white active:scale-90 shadow-stone-900/30'
                  : 'bg-[#284235] hover:bg-[#1C3026] active:scale-90 text-white shadow-emerald-950/25'
              }`}
              aria-label={addButtonLabel}
              title={addButtonLabel}
              aria-expanded={isMenuOpen}
            >
              <Plus
                className={`w-6 h-6 stroke-[2.8] transition-transform duration-300 ${
                  isMenuOpen ? 'rotate-45' : 'rotate-0'
                }`}
              />
            </button>
          </div>

          {/* Inköp */}
          <button
            type="button"
            onClick={() => handleTabClick('shopping')}
            className={`-translate-y-1.5 relative flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-2xl transition-all active:scale-95 touch-manipulation min-h-[52px] ${
              activeTab === 'shopping' && !selectedRecipe
                ? 'text-[#284235] font-bold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
            aria-label="Inköp"
          >
            <div className="relative">
              <ShoppingCart
                className={`w-5 h-5 transition-transform ${
                  activeTab === 'shopping' && !selectedRecipe ? 'scale-110 stroke-[2.3]' : 'stroke-[1.6]'
                }`}
              />
              {uncheckedCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-[#284235] text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center ring-2 ring-[#FCFAF5]">
                  {uncheckedCount > 99 ? '99+' : uncheckedCount}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-1 font-semibold leading-tight">Inköp</span>
          </button>

          {/* Inställningar */}
          <button
            type="button"
            onClick={() => handleTabClick('settings')}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-2xl transition-all active:scale-95 touch-manipulation min-h-[52px] ${
              activeTab === 'settings' && !selectedRecipe
                ? 'text-[#284235] font-bold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
            aria-label="Inställningar"
          >
            <div className="relative">
              <Settings
                className={`w-5 h-5 transition-transform ${
                  activeTab === 'settings' && !selectedRecipe ? 'scale-110 stroke-[2.3]' : 'stroke-[1.6]'
                }`}
              />
              {isHouseholdAdmin && joinRequests && joinRequests.length > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-amber-500 text-white text-[10px] font-extrabold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center ring-2 ring-[#FCFAF5] animate-pulse shadow-xs">
                  {joinRequests.length > 99 ? '99+' : joinRequests.length}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-1 font-semibold leading-tight">Inställningar</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
