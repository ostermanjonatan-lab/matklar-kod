import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { NUTRIENTS, nutritionForAllBases, type NutritionValues, type ProductLink, type RecipeNutrition } from '../../utils/nutrition';

type Basis = 'portion' | 'total' | '100g';
type Key = keyof NutritionValues;

const BASES: { key: Basis; label: string }[] = [
  { key: 'portion', label: 'Per portion' },
  { key: 'total', label: 'Hela rätten' },
  { key: '100g', label: 'Per 100 g' },
];

/** A value as it is written in the field: whole kcal, grams with a decimal comma under 10 */
const toField = (value: number | undefined, key: Key) => {
  if (value === undefined || !isFinite(value)) return '';
  const rounded = key === 'kcal' || value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return String(rounded).replace('.', ',');
};

const fromField = (text: string): number | undefined => {
  const n = parseFloat(text.replace(/\s/g, '').replace(',', '.'));
  return isFinite(n) && n >= 0 ? n : undefined;
};

const kcalText = (v: number | undefined) => (v === undefined ? '–' : `${Math.round(v).toLocaleString('sv-SE')} kcal`);

/**
 * What has been written in here. A portion and the whole dish go together (one is worked out from
 * the other with the number of portions); 100 g is written on its own and changes neither.
 */
export interface NutritionEdit {
  linked?: { per: 'portion' | 'total'; values: Partial<NutritionValues> };
  per100g?: Partial<NutritionValues>;
}

interface NutritionEditorProps {
  /** What the recipe shows now: written in, from its web page or worked out */
  current: RecipeNutrition | null;
  servings: number;
  edit: NutritionEdit;
  onEdit: (edit: NutritionEdit) => void;
  /** Leave out the values written in, so they are worked out from the ingredients again */
  onUseIngredients: () => void;
  usesIngredients: boolean;
  /** Ingredients tied to packaged foods, and how they are changed */
  products: ProductLink[];
  /** Ingredients counted in pieces ("20 st"), which can take a weight per piece */
  pieceIngredients: string[];
  onProductsChange: (products: ProductLink[]) => void;
  onFindProduct: () => void;
}

/**
 * Nutrition in Redigera recept: a row that opens, with the values per portion, for the whole dish
 * or per 100 g.
 */
export const NutritionEditor: React.FC<NutritionEditorProps> = ({
  current,
  servings,
  edit,
  onEdit,
  onUseIngredients,
  usesIngredients,
  products,
  pieceIngredients,
  onProductsChange,
  onFindProduct,
}) => {
  const [open, setOpen] = useState(false);
  const [basis, setBasis] = useState<Basis>('portion');
  // What is in the fields, as written (so "1," can be typed on the way to "1,5")
  const [texts, setTexts] = useState<Partial<Record<Key, string>>>({});

  // A portion and the whole dish: those written here, else what the recipe has now
  const linked = edit.linked
    ? nutritionForAllBases(edit.linked.values, edit.linked.per, servings, null)
    : { perPortion: current?.perPortion, total: current?.total };
  const valuesFor = (b: Basis) => (b === 'portion' ? linked.perPortion : b === 'total' ? linked.total : edit.per100g ?? current?.per100g);
  const inBasis = valuesFor(basis);

  const change = (key: Key, text: string) => {
    setTexts((t) => ({ ...t, [key]: text }));
    const values: Partial<NutritionValues> = { ...(inBasis || {}) };
    const n = fromField(text);
    if (n === undefined) delete values[key];
    else values[key] = n;
    if (basis === '100g') onEdit({ ...edit, per100g: values });
    else onEdit({ ...edit, linked: { per: basis, values } });
  };

  const hint =
    basis === 'portion'
      ? `Hela rätten blir ${kcalText(linked.total?.kcal)} för ${servings} ${servings === 1 ? 'portion' : 'portioner'}.`
      : basis === 'total'
        ? `Per portion blir det ${kcalText(linked.perPortion?.kcal)}, med ${servings} ${servings === 1 ? 'portion' : 'portioner'}.`
        : 'Fylls i för sig och ändrar inte portion eller hela rätten.';
  const written = Boolean(edit.linked || edit.per100g) || current?.source === 'manual';
  const source = written ? 'Inskrivet' : current?.source === 'page' ? 'Från webbsidan' : 'Uppskattat från ingredienserna';

  return (
    <div className="border-t border-[#EBE7DF]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 min-h-[48px] text-left touch-manipulation"
      >
        <span className="text-sm font-semibold text-stone-900 flex-1">Näringsvärde</span>
        {!open && <span className="text-xs text-stone-500">{source}</span>}
        <ChevronDown className={`w-5 h-5 text-stone-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="pb-4 space-y-3">
          <div className="flex rounded-xl bg-stone-100 p-1" role="radiogroup" aria-label="Värdena gäller">
            {BASES.map((b) => (
              <button
                key={b.key}
                type="button"
                role="radio"
                aria-checked={basis === b.key}
                onClick={() => {
                  setBasis(b.key);
                  setTexts({});
                }}
                className={`flex-1 min-h-[36px] rounded-lg text-xs font-semibold touch-manipulation ${
                  basis === b.key ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          <div className="divide-y divide-[#EBE7DF]">
            {NUTRIENTS.map((n) => (
              <label key={n.key} className="flex items-center gap-3 py-1.5">
                <span className="flex-1 text-sm text-stone-700">{n.label}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={texts[n.key] ?? toField(inBasis?.[n.key], n.key)}
                  onChange={(e) => change(n.key, e.target.value)}
                  placeholder="–"
                  className="w-24 h-10 px-3 text-right text-sm tabular-nums bg-[#FCFAF5] border border-[#EBE7DF] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]"
                />
                <span className="w-8 text-xs text-stone-500">{n.unit}</span>
              </label>
            ))}
          </div>

          <p className="text-xs text-stone-500 leading-relaxed">{hint}</p>

          {!usesIngredients && (
            <button
              type="button"
              onClick={() => {
                setTexts({});
                onUseIngredients();
              }}
              className="text-sm text-[#284235] font-semibold min-h-[40px] touch-manipulation"
            >
              Räkna från ingredienserna
            </button>
          )}

          {/* Packaged foods: an ingredient counted with the values on its package */}
          <div className="pt-2 border-t border-[#EBE7DF] space-y-2">
            <p className="text-sm font-semibold text-stone-900">Färdiga produkter</p>
            {products.length === 0 && (
              <p className="text-xs text-stone-500">Koppla en ingrediens till en vara, så används förpackningens näringsvärden för den.</p>
            )}
            {products.map((p) => (
              <div key={p.ingredient} className="text-sm">
                <div className="flex items-start gap-2">
                  <p className="flex-1 min-w-0 text-stone-800">
                    <span>{p.ingredient.charAt(0).toUpperCase() + p.ingredient.slice(1)}</span>
                    <span className="block text-xs text-stone-500">
                      {[p.name, p.brand, p.per100.kcal !== undefined ? `${Math.round(p.per100.kcal)} kcal per 100 g` : '', p.packGrams ? `förpackning ${p.packGrams} g` : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => onProductsChange(products.filter((x) => x !== p))}
                    className="shrink-0 text-xs font-semibold text-rose-700 min-h-[36px] px-1 touch-manipulation"
                  >
                    Ta bort
                  </button>
                </div>
                {pieceIngredients.includes(p.ingredient) && (
                  <label className="mt-1 flex items-center gap-2 text-xs text-stone-600">
                    Vikt per styck
                    <input
                      type="text"
                      inputMode="decimal"
                      value={p.pieceGrams !== undefined ? String(p.pieceGrams).replace('.', ',') : ''}
                      placeholder="–"
                      onChange={(e) => {
                        const n = parseFloat(e.target.value.replace(',', '.'));
                        onProductsChange(products.map((x) => (x === p ? { ...x, pieceGrams: isFinite(n) && n > 0 ? n : undefined } : x)));
                      }}
                      className="w-20 h-9 px-2 text-right tabular-nums bg-[#FCFAF5] border border-[#EBE7DF] rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]"
                    />
                    g
                  </label>
                )}
              </div>
            ))}
            <button type="button" onClick={onFindProduct} className="text-sm text-[#284235] font-semibold min-h-[40px] touch-manipulation">
              Koppla ingrediens till produkt
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
