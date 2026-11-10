import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  NUTRIENTS,
  nutritionForAllBases,
  type NutritionBasis,
  type NutritionValues,
  type RecipeNutrition,
} from '../../utils/nutrition';

const BASES: { key: NutritionBasis; label: string }[] = [
  { key: 'portion', label: 'Per portion' },
  { key: '100g', label: 'Per 100 g' },
  { key: 'total', label: 'Hela rätten' },
];

type Key = keyof NutritionValues;

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

const shortValue = (v: number | undefined) => (v === undefined ? '–' : Math.round(v).toLocaleString('sv-SE'));

export interface NutritionEdit {
  per: NutritionBasis;
  values: Partial<NutritionValues>;
}

interface NutritionEditorProps {
  /** What the recipe shows now: written in, from its web page or worked out */
  current: RecipeNutrition | null;
  servings: number;
  /** The dish's weight from the ingredients, or null when it cannot be weighed */
  grams: number | null;
  /** The values written in here, or null when nothing has been written */
  edit: NutritionEdit | null;
  onEdit: (edit: NutritionEdit | null) => void;
  /** Leave out the values written in, so they are worked out from the ingredients again */
  onUseIngredients: () => void;
  usesIngredients: boolean;
}

/**
 * Nutrition in Redigera recept: a row that opens. The values can be written per portion, per
 * 100 g or for the whole dish, and the other two are worked out from the portions and the weight
 * of the ingredients.
 */
export const NutritionEditor: React.FC<NutritionEditorProps> = ({
  current,
  servings,
  grams,
  edit,
  onEdit,
  onUseIngredients,
  usesIngredients,
}) => {
  const [open, setOpen] = useState(false);
  const [basis, setBasis] = useState<NutritionBasis>(edit?.per ?? 'portion');
  // What is in the fields, as written (so "1," can be typed on the way to "1,5")
  const [texts, setTexts] = useState<Partial<Record<Key, string>>>({});

  // The values in the chosen basis: those written here, else what the recipe has now
  const shown = (() => {
    if (edit) return nutritionForAllBases(edit.values, edit.per, servings, grams);
    return { total: current?.total, perPortion: current?.perPortion, per100g: current?.per100g };
  })();
  const valuesFor = (b: NutritionBasis) => (b === 'portion' ? shown.perPortion : b === '100g' ? shown.per100g : shown.total);
  const inBasis = valuesFor(basis);

  const chooseBasis = (b: NutritionBasis) => {
    setBasis(b);
    setTexts({});
    // Written values follow along into the new basis
    if (edit) {
      const converted = valuesFor(b);
      if (converted) onEdit({ per: b, values: converted });
    }
  };

  const change = (key: Key, text: string) => {
    setTexts((t) => ({ ...t, [key]: text }));
    const start = edit && edit.per === basis ? edit.values : { ...(inBasis || {}) };
    const values: Partial<NutritionValues> = { ...start };
    const n = fromField(text);
    if (n === undefined) delete values[key];
    else values[key] = n;
    onEdit({ per: basis, values });
  };

  const others = BASES.filter((b) => b.key !== basis)
    .map((b) => `${b.label.toLowerCase()} ${shortValue(valuesFor(b.key)?.kcal)} kcal`)
    .join(', ');
  const source = edit || current?.source === 'manual' ? 'Inskrivet' : current?.source === 'page' ? 'Från webbsidan' : 'Uppskattat från ingredienserna';

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
            {BASES.map((b) => {
              const disabled = b.key === '100g' && !grams;
              return (
                <button
                  key={b.key}
                  type="button"
                  role="radio"
                  aria-checked={basis === b.key}
                  disabled={disabled}
                  onClick={() => chooseBasis(b.key)}
                  className={`flex-1 min-h-[36px] rounded-lg text-xs font-semibold touch-manipulation disabled:opacity-40 ${
                    basis === b.key ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                  }`}
                >
                  {b.label}
                </button>
              );
            })}
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

          <p className="text-xs text-stone-500 leading-relaxed">
            {others ? `Blir ${others}.` : ''}
            {!grams && ' Per 100 g går inte att räkna ut, eftersom ingredienserna inte kan vägas.'}
          </p>

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
        </div>
      )}
    </div>
  );
};
