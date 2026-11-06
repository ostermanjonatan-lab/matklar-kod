import React, { useEffect, useState } from 'react';
import type { Recipe } from '../../types/recipe';
import { createRecipeLink } from '../../utils/recipeLink';
import { copyTextToClipboard, shareRecipeAsText } from '../../utils/recipeShare';

interface ShareRecipeSheetProps {
  recipe: Recipe;
  servings: number;
  onClose: () => void;
  /** Called with a short message to show after something was copied. */
  onDone: (message: string) => void;
}

/** Share a recipe: as a link that opens it in MatKlar, or as plain text. */
export const ShareRecipeSheet: React.FC<ShareRecipeSheetProps> = ({ recipe, servings, onClose, onDone }) => {
  // Made when the sheet opens, so the phone's share menu can open right on the tap
  const [link, setLink] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    createRecipeLink(recipe).then((l) => alive && setLink(l));
    return () => {
      alive = false;
    };
  }, [recipe]);

  const sendLink = async () => {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: recipe.title, text: recipe.title, url: link });
        onClose();
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // The share menu is not available: copy instead
      }
    }
    const copied = await copyTextToClipboard(link);
    onClose();
    onDone(copied ? 'Länken är kopierad' : 'Länken gick inte att kopiera');
  };

  const copyText = async () => {
    const { success } = await shareRecipeAsText(recipe, servings);
    onClose();
    onDone(success ? 'Receptet är kopierat som text' : 'Texten gick inte att kopiera');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center animate-fade-in font-sans"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Dela receptet"
    >
      <div
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-lg font-bold text-stone-900">Dela receptet</h3>
        <p className="text-sm text-stone-600">
          Den som får länken kan spara receptet i sin egen MatKlar, även utan att vara med i ert hushåll.
        </p>
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={sendLink}
            disabled={!link}
            className="w-full min-h-[48px] rounded-xl bg-[#284235] hover:bg-black disabled:opacity-50 text-white text-sm font-semibold touch-manipulation"
          >
            Skicka länk
          </button>
          <button
            type="button"
            onClick={copyText}
            className="w-full min-h-[48px] rounded-xl bg-stone-100 text-stone-800 text-sm font-semibold touch-manipulation"
          >
            Kopiera som text
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[40px] text-sm text-stone-600 touch-manipulation"
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );
};
