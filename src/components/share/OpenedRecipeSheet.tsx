import React, { useEffect, useState } from 'react';
import type { Recipe } from '../../types/recipe';
import { useRecipes } from '../../context/RecipeContext';
import { isRecipeLink, openedRecipeLink, readRecipeLink, type RecipeFromLink } from '../../utils/recipeLink';
import { copyTextToClipboard } from '../../utils/recipeShare';
import { detectAisle, isCommonPantryStaple } from '../../utils/ingredientParser';
import { formatRecipeTitle } from '../../utils/formatters';

/** A full recipe for this household from a shared link. */
export function recipeFromLink(shared: RecipeFromLink): Recipe {
  return {
    id: `custom-rec-${Date.now()}`,
    title: shared.title,
    description: '',
    coverImageUrl:
      shared.coverImageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: shared.sourceUrl,
    sourceType: shared.sourceUrl ? 'url' : 'manual',
    servings: shared.servings,
    category: shared.category,
    subcategory: shared.subcategories.join(', ') || 'Hemlagat',
    subcategories: shared.subcategories.length > 0 ? shared.subcategories : ['Hemlagat'],
    rating: 5,
    isFavorite: false,
    notes: '',
    ingredients: shared.ingredients.map((i) => ({
      ...i,
      aisle: detectAisle(i.name),
      isPantryStaple: isCommonPantryStaple(i.name),
    })),
    instructions: shared.instructions,
    householdId: '',
    prepTimeMinutes: 0,
    cookTimeMinutes: shared.cookTimeMinutes ?? 0,
    difficulty: shared.difficulty,
  };
}

const isIPhone = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const isHomeScreenApp = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

/** Shown when MatKlar is opened from a shared recipe link. */
export const OpenedRecipeSheet: React.FC = () => {
  const { recipes, addRecipe, openRecipeDetail, setActiveTab } = useRecipes();
  const [shared, setShared] = useState<RecipeFromLink | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [closed, setClosed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState<string | null>(openedRecipeLink);

  // A link opened while the app is already open in the same tab only changes the address
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash;
      if (!isRecipeLink(hash)) return;
      window.history.replaceState(window.history.state, '', window.location.pathname);
      setShared(null);
      setUnreadable(false);
      setClosed(false);
      setCopied(false);
      setLink(hash);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (!link) return;
    let alive = true;
    readRecipeLink(link).then((r) => {
      if (!alive) return;
      if (r) setShared(r);
      else setUnreadable(true);
    });
    return () => {
      alive = false;
    };
  }, [link]);

  if (closed || (!shared && !unreadable)) return null;

  const close = () => setClosed(true);
  const exists = shared && recipes.some((r) => r.title.trim().toLowerCase() === shared.title.trim().toLowerCase());

  const save = () => {
    if (!shared) return;
    const recipe = recipeFromLink(shared);
    addRecipe(recipe);
    setActiveTab('recipes');
    setClosed(true);
    openRecipeDetail(recipe);
  };

  const copyLink = async () => {
    if (await copyTextToClipboard(`${window.location.origin}/${link}`)) setCopied(true);
  };

  const counts = shared
    ? [`${shared.ingredients.length} ingredienser`, `${shared.instructions.length} steg`, `${shared.servings} portioner`].join(' · ')
    : '';

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center animate-fade-in font-sans"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Recept som har delats med dig"
    >
      <div
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        {unreadable || !shared ? (
          <>
            <h3 className="font-serif text-lg font-bold text-stone-900">Receptet gick inte att läsa</h3>
            <p className="text-sm text-stone-600">Länken kan ha blivit avklippt. Be om att få den igen.</p>
            <button type="button" onClick={close} className="w-full min-h-[46px] rounded-xl bg-stone-100 text-stone-700 text-sm font-semibold touch-manipulation">
              Stäng
            </button>
          </>
        ) : (
          <>
            <div className="flex gap-3 items-start">
              {shared.coverImageUrl && (
                <img src={shared.coverImageUrl} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0 bg-stone-100" />
              )}
              <div className="min-w-0">
                <p className="text-xs text-stone-500">Delat recept</p>
                <h3 className="font-serif text-lg font-bold text-stone-900 leading-snug">{formatRecipeTitle(shared.title)}</h3>
                <p className="text-sm text-stone-600 mt-0.5">{counts}</p>
              </div>
            </div>

            {exists && <p className="text-sm text-stone-600">Du har redan ett recept som heter så.</p>}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={close} className="flex-1 min-h-[46px] rounded-xl bg-stone-100 text-stone-700 text-sm font-semibold touch-manipulation">
                Stäng
              </button>
              <button type="button" onClick={save} className="flex-1 min-h-[46px] rounded-xl bg-[#284235] text-white text-sm font-semibold touch-manipulation">
                {exists ? 'Spara ändå' : 'Spara i mina recept'}
              </button>
            </div>

            {isIPhone() && !isHomeScreenApp() && (
              <div className="pt-2 border-t border-[#EBE7DF] space-y-1">
                <p className="text-sm text-stone-600">
                  Har du MatKlar på hemskärmen? Kopiera länken och klistra in den i appen under Lägg till recept, Länk.
                </p>
                <button type="button" onClick={copyLink} className="min-h-[40px] text-sm font-semibold text-[#284235] touch-manipulation">
                  {copied ? 'Länken är kopierad' : 'Kopiera länken'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
