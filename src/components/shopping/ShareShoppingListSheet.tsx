import React, { useEffect, useState } from 'react';
import { createShoppingListImage, shoppingListImageFileName, type ShoppingImageGroup } from '../../utils/shoppingListImage';
import { shareImageFile, saveImageFile } from '../../utils/shareImage';

/** Share the shopping list: as a picture (A4, for printing too) or as text */
export const ShareShoppingListSheet: React.FC<{
  /** The list's name, for the heading of this sheet */
  title: string;
  /** The heading in the picture: "Inköpslista", or "Inköpslista - Stugan" for a saved list */
  imageTitle: string;
  subtitle: string;
  groups: ShoppingImageGroup[];
  onCopyText: () => void;
  onClose: () => void;
  onDone: (message: string) => void;
}> = ({ title, imageTitle, subtitle, groups, onCopyText, onClose, onDone }) => {
  // The picture is made when the sheet opens, so it is ready when a button is tapped
  const [image, setImage] = useState<File | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    createShoppingListImage(imageTitle, subtitle, groups)
      .then((blob) => alive && setImage(new File([blob], shoppingListImageFileName(imageTitle), { type: 'image/png' })))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [imageTitle, subtitle, groups]);

  const handle = async (result: Promise<'shared' | 'saved' | 'cancelled'>) => {
    const done = await result;
    if (done === 'cancelled') return;
    onClose();
    if (done === 'saved') onDone('Bilden är sparad');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center animate-fade-in font-sans"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Dela inköpslistan"
    >
      <div
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-lg font-bold text-stone-900">Dela {title.toLowerCase() === 'inköpslista' ? 'inköpslistan' : title}</h3>
        <div className="space-y-2 pt-1">
          {failed ? (
            <p className="text-sm text-stone-500 py-2">Bilden gick inte att göra.</p>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => image && handle(shareImageFile(image, imageTitle))}
                disabled={!image}
                className="flex-1 min-h-[48px] rounded-xl bg-[#284235] hover:bg-black disabled:opacity-50 text-white text-sm font-semibold touch-manipulation"
              >
                {image ? 'Dela som bild' : 'Gör bilden'}
              </button>
              <button
                type="button"
                onClick={() => image && handle(saveImageFile(image))}
                disabled={!image}
                className="flex-1 min-h-[48px] rounded-xl bg-stone-100 text-stone-800 disabled:text-stone-400 text-sm font-semibold touch-manipulation"
              >
                Spara bild
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              onClose();
              onCopyText();
            }}
            className="w-full min-h-[48px] rounded-xl bg-stone-100 text-stone-800 text-sm font-semibold touch-manipulation"
          >
            Kopiera som text
          </button>
          <button type="button" onClick={onClose} className="w-full min-h-[40px] text-sm text-stone-600 touch-manipulation">
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );
};
