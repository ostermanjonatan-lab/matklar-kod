import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Recipe } from '../../types/recipe';
import { NUTRIENTS, recipeNutrition, scaleNutrition, type NutritionValues } from '../../utils/nutrition';
import { formatAmount, formatIngredientName, formatUnit } from '../../utils/formatters';

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
  // Ingredients that could not be counted make what is worked out too low. Values from the web
  // page, or all written in, do not depend on them.
  const worksOut = nutrition?.source === 'calculated' || (nutrition?.source === 'manual' && !(nutrition.manual?.portion && nutrition.manual?.per100g));
  const incomplete = Boolean(nutrition && worksOut && nutrition.missingItems.length > 0);
  const missingText = (nutrition?.missingItems || [])
    .map((m) => {
      const amount = typeof m.amount === 'number' ? `${formatAmount(m.amount)}\u00a0${formatUnit(m.unit, m.amount)}`.trim() : '';
      return `${formatIngredientName(m.name, null, '').toLowerCase()}${amount ? ` (${amount})` : ''}`;
    })
    .join(', ');
  const share = nutrition?.missingShare ?? 0;
  // Everything left out of the calculation, grouped by why
  const groups: [string, string][] = worksOut
    ? (
        [
          ['ingen mängd', 'Utan mängd'],
          ['okänt livsmedel', 'Okänt för appen'],
          ['vikt per styck okänd', 'Vikt per styck saknas'],
        ] as const
      )
        .map(([reason, label]): [string, string] => [
          label,
          [...new Set((nutrition?.notCounted || []).filter((n) => n.reason === reason).map((n) => formatIngredientName(n.name, null, '').toLowerCase()))].join(', '),
        ])
        .filter(([, names]) => names.length > 0)
    : [];
  const summary = incomplete
    ? 'Ofullständigt'
    : nutrition?.perPortion?.kcal !== undefined
      ? `${formatValue(nutrition.perPortion.kcal, 'kcal')} per portion`
      : '';

  return (
    <div className="w-full border-t border-[#EBE7DF]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 min-h-[52px] text-left touch-manipulation"
      >
        <h2 className="font-serif text-lg font-bold text-stone-900 flex-1">Näringsvärde</h2>
        {!open && summary && <span className={`text-sm tabular-nums ${incomplete ? 'text-amber-800' : 'text-stone-500'}`}>{summary}</span>}
        <ChevronDown className={`w-5 h-5 text-stone-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="pb-3 animate-fade-in">
          {nutrition ? (
            <>
              {incomplete && (
                <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 leading-relaxed">
                  Räknas inte med: {missingText}. Värdena är därför för låga
                  {share >= 0.1 ? `, ungefär ${Math.round(share * 100)} % av rättens vikt saknas` : ''}.
                </p>
              )}
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
                    ? nutrition.manual?.portion && nutrition.manual?.per100g
                      ? 'Inskrivet i receptet.'
                      : nutrition.manual?.portion
                        ? 'Portion och hela rätten är inskrivna, 100 g är uppskattat från ingredienserna.'
                        : '100 g är inskrivet, portion och hela rätten är uppskattade från ingredienserna.'
                    : 'Uppskattat från ingredienserna med Livsmedelsverkets livsmedelsdatabas.'}
                {` Hela rätten gäller ${servings} ${servings === 1 ? 'portion' : 'portioner'}.`}
              </p>
              {groups.length > 0 && (
                <div className="mt-2 text-xs text-stone-500 leading-relaxed">
                  <p className="font-semibold text-stone-600">Inte med i uträkningen</p>
                  {groups.map(([label, names]) => (
                    <p key={label}>
                      {label}: {names}.
                    </p>
                  ))}
                </div>
              )}
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
