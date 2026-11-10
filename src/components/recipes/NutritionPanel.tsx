import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Recipe } from '../../types/recipe';
import { NUTRIENTS, recipeNutrition, scaleNutrition, type NutritionValues } from '../../utils/nutrition';
import { formatIngredientName } from '../../utils/formatters';

const formatValue = (value: number | undefined, unit: string) => {
  if (value === undefined || !isFinite(value)) return '–';
  const rounded = unit === 'kcal' || value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded.toLocaleString('sv-SE')} ${unit}`;
};

/**
 * Nutrition under the notes in a recipe: a row that opens a table with the whole dish, a portion
 * and 100 g. Closed each time a recipe opens, so the buttons below stay close.
 */
export const NutritionPanel: React.FC<{ recipe: Recipe; servings: number }> = ({ recipe, servings }) => {
  const [open, setOpen] = useState(false);
  const nutrition = useMemo(() => recipeNutrition(recipe), [recipe]);

  // The whole dish follows the portions chosen above the ingredients
  const whole: Partial<NutritionValues> | undefined = nutrition?.perPortion
    ? scaleNutrition(nutrition.perPortion, servings)
    : nutrition?.total
      ? scaleNutrition(nutrition.total, servings / (recipe.servings || 4))
      : undefined;
  const columns: { label: string; values?: Partial<NutritionValues> }[] = [
    { label: 'Portion', values: nutrition?.perPortion },
    { label: '100 g', values: nutrition?.per100g },
    { label: 'Hela rätten', values: whole },
  ];
  const summary = nutrition?.perPortion?.kcal !== undefined ? `${formatValue(nutrition.perPortion.kcal, 'kcal')} per portion` : '';

  return (
    <div className="w-full border-t border-[#EBE7DF]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 min-h-[52px] text-left touch-manipulation"
      >
        <h2 className="font-serif text-lg font-bold text-stone-900 flex-1">Näringsvärde</h2>
        {!open && summary && <span className="text-sm text-stone-500 tabular-nums">{summary}</span>}
        <ChevronDown className={`w-5 h-5 text-stone-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="pb-3 animate-fade-in">
          {nutrition ? (
            <>
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-xs text-stone-500">
                    <th className="text-left font-normal pb-1.5" />
                    {columns.map((c) => (
                      <th key={c.label} className="text-right font-normal pb-1.5 pl-2">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {NUTRIENTS.map((n) => (
                    <tr key={n.key} className="border-t border-[#EBE7DF]">
                      <td className={`py-1.5 pr-2 ${n.key === 'kcal' ? 'font-semibold text-stone-900' : 'text-stone-700'}`}>{n.label}</td>
                      {columns.map((c) => (
                        <td
                          key={c.label}
                          className={`py-1.5 pl-2 text-right whitespace-nowrap ${n.key === 'kcal' ? 'font-semibold text-stone-900' : 'text-stone-700'}`}
                        >
                          {formatValue(c.values?.[n.key], n.unit)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-stone-500 leading-relaxed">
                {nutrition.source === 'page'
                  ? 'Från receptets webbsida.'
                  : nutrition.source === 'manual'
                    ? 'Inskrivet i receptet.'
                    : 'Uppskattat från ingredienserna.'}
                {` Hela rätten gäller ${servings} ${servings === 1 ? 'portion' : 'portioner'}.`}
                {nutrition.missing.length > 0 && nutrition.source === 'calculated' && (
                  <> Inte med: {nutrition.missing.map((m) => formatIngredientName(m, null, '').toLowerCase()).join(', ')}.</>
                )}
              </p>
            </>
          ) : (
            <p className="text-sm text-stone-500">
              Går inte att räkna ut. För få av ingredienserna har en mängd som appen känner igen.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
