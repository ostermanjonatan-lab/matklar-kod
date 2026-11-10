import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { searchProducts, type FoodHit } from '../../services/foodSearch';
import { productKey, type ProductLink } from '../../utils/nutrition';
import { formatIngredientName } from '../../utils/formatters';

interface ProductSearchSheetProps {
  /** The recipe's ingredient names, to choose which one to tie to a product */
  ingredients: string[];
  /** Ingredients that are not counted now, shown first */
  notCounted: string[];
  onChoose: (link: ProductLink) => void;
  onClose: () => void;
}

const kcalText = (v?: number) => (v === undefined ? '–' : `${Math.round(v).toLocaleString('sv-SE')} kcal`);

/**
 * Ties an ingredient to a packaged food in Open Food Facts: choose the ingredient, search by name
 * or barcode, choose the product. The text field is not focused when the sheet opens.
 */
export const ProductSearchSheet: React.FC<ProductSearchSheetProps> = ({ ingredients, notCounted, onChoose, onClose }) => {
  const [ingredient, setIngredient] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<FoodHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const unknown = new Set(notCounted.map(productKey));
  const ordered = [...new Set(ingredients)].sort((a, b) => Number(unknown.has(productKey(b))) - Number(unknown.has(productKey(a))));

  const run = async (q: string) => {
    if (!q.trim()) return;
    setBusy(true);
    setError('');
    try {
      setHits(await searchProducts(q));
    } catch {
      setError('Sökningen gick inte att göra just nu. Försök igen om en stund.');
      setHits(null);
    } finally {
      setBusy(false);
    }
  };

  const choose = (hit: FoodHit) => {
    if (!ingredient) return;
    onChoose({
      ingredient: productKey(ingredient),
      name: hit.name,
      brand: hit.brand,
      code: hit.code,
      per100: hit.per100,
      packGrams: hit.packGrams,
    });
  };

  return (
    <div className="absolute inset-0 z-20 bg-black/40 flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[88%] flex flex-col pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[#EBE7DF]">
          <h3 className="font-serif text-lg font-bold text-stone-900">{ingredient ? formatIngredientName(ingredient, null, '') : 'Välj ingrediens'}</h3>
          <button type="button" onClick={onClose} aria-label="Stäng" className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-stone-500 touch-manipulation">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!ingredient ? (
          <div className="overflow-y-auto px-5 py-2 divide-y divide-[#EBE7DF]">
            {ordered.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setIngredient(name);
                  setQuery(formatIngredientName(name, null, '').replace(/[​-‏﻿]/g, '').replace(/:$/, ''));
                }}
                className="w-full flex items-center justify-between gap-3 py-3 text-left text-sm text-stone-800 touch-manipulation"
              >
                <span className="min-w-0 truncate">{formatIngredientName(name, null, '')}</span>
                {unknown.has(productKey(name)) && <span className="shrink-0 text-xs text-amber-800">räknas inte nu</span>}
              </button>
            ))}
          </div>
        ) : (
          <>
            <form
              className="px-5 pt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(query);
              }}
            >
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Varans namn eller streckkod"
                enterKeyHint="search"
                className="flex-1 min-w-0 h-11 px-3 text-sm bg-[#FCFAF5] border border-[#EBE7DF] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]"
              />
              <button
                type="submit"
                disabled={busy || !query.trim()}
                className="shrink-0 h-11 px-4 rounded-xl bg-[#284235] text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40 touch-manipulation"
              >
                <Search className="w-4 h-4" />
                Sök
              </button>
            </form>
            <div className="overflow-y-auto px-5 pt-2 min-h-[120px]">
              {busy && <p className="py-4 text-sm text-stone-500">Söker…</p>}
              {error && <p className="py-4 text-sm text-rose-700">{error}</p>}
              {!busy && hits && hits.length === 0 && (
                <p className="py-4 text-sm text-stone-500">Ingen vara hittades. Prova ett kortare namn eller streckkoden.</p>
              )}
              {!busy && hits && hits.length > 0 && (
                <ul className="divide-y divide-[#EBE7DF]">
                  {hits.map((h) => (
                    <li key={h.code}>
                      <button type="button" onClick={() => choose(h)} className="w-full py-2.5 text-left touch-manipulation">
                        <span className="block text-sm font-semibold text-stone-900">{h.name}</span>
                        <span className="block text-xs text-stone-500">
                          {[h.brand, h.quantity, `${kcalText(h.per100.kcal)} per 100 g`, h.per100.carbs !== undefined ? `${String(h.per100.carbs).replace('.', ',')} g kolhydrater` : '']
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="px-5 pt-2 text-xs text-stone-500">Varor och värden från Open Food Facts, där vem som helst kan lägga in varor. Jämför gärna med förpackningen.</p>
          </>
        )}
      </div>
    </div>
  );
};
