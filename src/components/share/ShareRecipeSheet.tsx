import React, { useEffect, useState } from 'react';
import type { Recipe } from '../../types/recipe';
import { createRecipeLink } from '../../utils/recipeLink';
import { copyTextToClipboard, shareRecipeAsText } from '../../utils/recipeShare';
import { createRecipeImage, recipeImageFileName } from '../../utils/recipeImage';

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

  // The picture is made in the background too, so it is ready when the button is tapped
  const [image, setImage] = useState<File | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    createRecipeImage(recipe, servings)
      .then((blob) => alive && setImage(new File([blob], recipeImageFileName(recipe), { type: 'image/png' })))
      .catch(() => alive && setImageFailed(true));
    return () => {
      alive = false;
    };
  }, [recipe, servings]);

  const shareImage = async () => {
    if (!image) return;
    if (navigator.canShare?.({ files: [image] })) {
      try {
        await navigator.share({ files: [image], title: recipe.title });
        onClose();
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    // No share menu with files (a computer): save the picture instead
    saveImage();
  };

  // On iPhone the share menu is the way to save to Bilder, so it opens there. Elsewhere the
  // picture is downloaded and ends up among the phone's downloads and in the photo gallery.
  const saveImage = async () => {
    if (!image) return;
    if (/iPhone|iPad|iPod/.test(navigator.userAgent) && navigator.canShare?.({ files: [image] })) {
      try {
        await navigator.share({ files: [image] });
        onClose();
      } catch {
        // Cancelled
      }
      return;
    }
    const url = URL.createObjectURL(image);
    const a = document.createElement('a');
    a.href = url;
    a.download = image.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onClose();
    onDone('Bilden är sparad');
  };

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
          {imageFailed ? (
            <p className="text-sm text-stone-500 py-2">Bilden gick inte att göra.</p>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={shareImage}
                disabled={!image}
                className="flex-1 min-h-[48px] rounded-xl bg-stone-100 text-stone-800 disabled:text-stone-400 text-sm font-semibold touch-manipulation"
              >
                {image ? 'Dela som bild' : 'Gör bilden'}
              </button>
              <button
                type="button"
                onClick={saveImage}
                disabled={!image}
                className="flex-1 min-h-[48px] rounded-xl bg-stone-100 text-stone-800 disabled:text-stone-400 text-sm font-semibold touch-manipulation"
              >
                Spara bild
              </button>
            </div>
          )}
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
