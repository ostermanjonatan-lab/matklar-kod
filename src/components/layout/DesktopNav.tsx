import React from 'react';
import { useRecipes } from '../../context/RecipeContext';
import type { TabType } from '../../types/recipe';
import {
  Utensils,
  CalendarDays,
  ShoppingCart,
  Settings,
  Plus,
  Search,
  X,
} from 'lucide-react';

interface DesktopNavProps {
  onAddRecipeClick: () => void;
  onAddShoppingItemClick: () => void;
}

export const DesktopNav: React.FC<DesktopNavProps> = ({
  onAddRecipeClick,
  onAddShoppingItemClick,
}) => {
  const {
    activeTab,
    setActiveTab,
    shoppingList,
    selectedRecipe,
    closeRecipeDetail,
    searchQuery,
    setSearchQuery,
    isHouseholdAdmin,
    joinRequests,
  } = useRecipes();

  const uncheckedCount = shoppingList.filter((item) => !item.checked).length;

  const handleTabClick = (tab: TabType) => {
    if (selectedRecipe) {
      closeRecipeDetail();
    }
    if (activeTab === tab) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (document.documentElement) document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
      if (document.body) document.body.scrollTo({ top: 0, behavior: 'smooth' });
      const mainEl = document.querySelector('main');
      if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      const mainEl = document.querySelector('main');
      if (mainEl) mainEl.scrollTop = 0;
      setActiveTab(tab);
    }
  };

  return (
    <header className="hidden md:flex sticky top-0 z-40 w-full bg-[#FCFAF5]/95 backdrop-blur-md border-b border-[#EBE7DF] transition-all h-[72px]">
      <div className="w-full max-w-7xl mx-auto px-6 h-full flex items-center justify-between gap-4">
        {/* Left: Brand */}
        <div className="flex items-center gap-4 shrink-0">
          <button
            type="button"
            onClick={() => handleTabClick('recipes')}
            className="flex items-center gap-2.5 group cursor-pointer text-left focus:outline-none"
          >
            <div className="w-10 h-10 rounded-2xl bg-[#284235] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Utensils className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <span className="font-serif text-2xl font-bold tracking-tight text-stone-900 group-hover:text-[#284235] transition-colors leading-none">
                MatKlar
              </span>
            </div>
          </button>
        </div>

        {/* Center: Navigation Pill Tabs (Locked fixed width so badge never shifts menu) */}
        <nav className="flex items-center bg-[#F0EDE6] p-1.5 rounded-2xl border border-[#EBE7DF] shadow-2xs shrink-0 w-[478px]">
          {/* Recept */}
          <button
            type="button"
            onClick={() => handleTabClick('recipes')}
            className={`flex items-center justify-center gap-2 w-[98px] py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'recipes' && !selectedRecipe
                ? 'bg-[#284235] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-950 hover:bg-white/60'
            }`}
          >
            <Utensils className="w-4 h-4 stroke-[2] shrink-0" />
            <span>Recept</span>
          </button>

          {/* Veckoplan */}
          <button
            type="button"
            onClick={() => handleTabClick('mealplan')}
            className={`flex items-center justify-center gap-2 w-[114px] py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'mealplan' && !selectedRecipe
                ? 'bg-[#284235] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-950 hover:bg-white/60'
            }`}
          >
            <CalendarDays className="w-4 h-4 stroke-[2] shrink-0" />
            <span>Veckoplan</span>
          </button>

          {/* Inköp */}
          <button
            type="button"
            onClick={() => handleTabClick('shopping')}
            className={`relative flex items-center justify-center gap-1.5 w-[118px] py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'shopping' && !selectedRecipe
                ? 'bg-[#284235] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-950 hover:bg-white/60'
            }`}
          >
            <ShoppingCart className="w-4 h-4 stroke-[2] shrink-0" />
            <span>Inköp</span>
            {uncheckedCount > 0 && (
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 leading-none ${
                  activeTab === 'shopping' && !selectedRecipe
                    ? 'bg-white text-[#284235]'
                    : 'bg-[#284235] text-white'
                }`}
              >
                {uncheckedCount > 99 ? '99+' : uncheckedCount}
              </span>
            )}
          </button>

          {/* Inställningar */}
          <button
            type="button"
            onClick={() => handleTabClick('settings')}
            className={`flex items-center justify-center gap-2 w-[134px] py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'settings' && !selectedRecipe
                ? 'bg-[#284235] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-950 hover:bg-white/60'
            }`}
          >
            <Settings className="w-4 h-4 stroke-[2] shrink-0" />
            <span>Inställningar</span>
            {isHouseholdAdmin && joinRequests && joinRequests.length > 0 && (
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 leading-none shadow-xs animate-pulse ${
                  activeTab === 'settings' && !selectedRecipe
                    ? 'bg-amber-400 text-amber-950'
                    : 'bg-amber-500 text-white'
                }`}
              >
                {joinRequests.length > 99 ? '99+' : joinRequests.length}
              </span>
            )}
          </button>
        </nav>

        {/* Right: Search & Actions */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Topbar Search Input */}
          <div className="relative w-48 lg:w-72 flex items-center">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 pointer-events-none stroke-[2]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (activeTab !== 'recipes') {
                  handleTabClick('recipes');
                }
              }}
              placeholder="Sök recept eller råvara"
              className="w-full h-11 bg-white text-stone-900 placeholder-stone-400 text-xs rounded-xl pl-9 pr-8 border border-[#EBE7DF] focus:outline-none focus:ring-2 focus:ring-[#284235] shadow-2xs transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 w-6 h-6 flex items-center justify-center text-stone-400 hover:text-stone-700 cursor-pointer"
                aria-label="Rensa sökning"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Add Recipe Button */}
          <button
            type="button"
            onClick={() => onAddRecipeClick()}
            className="h-11 px-4 rounded-xl bg-[#284235] hover:bg-black text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.8]" />
            <span>Nytt recept</span>
          </button>

          {/* Add Shopping Item Button */}
          <button
            type="button"
            onClick={() => onAddShoppingItemClick()}
            className="h-11 px-3.5 rounded-xl bg-white hover:bg-stone-50 border border-[#EBE7DF] text-stone-700 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0"
            title="Lägg till vara i inköpslistan"
          >
            <ShoppingCart className="w-3.5 h-3.5 stroke-[2.2] text-amber-700" />
            <span className="hidden xl:inline">Ny vara</span>
          </button>
        </div>
      </div>
    </header>
  );
};
