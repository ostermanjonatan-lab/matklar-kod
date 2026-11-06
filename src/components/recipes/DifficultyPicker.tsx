import React from 'react';
import type { RecipeDifficulty } from '../../types/recipe';
import { DIFFICULTY_LABELS, DIFFICULTY_LEVELS } from '../../utils/recipeDifficulty';

interface DifficultyPickerProps {
  value: RecipeDifficulty | undefined;
  onChange: (value: RecipeDifficulty | undefined) => void;
}

/** Lätt, Medel or Svår. Tapping the chosen one again clears it. */
export const DifficultyPicker: React.FC<DifficultyPickerProps> = ({ value, onChange }) => (
  <div>
    <span className="font-bold text-stone-800 block mb-1">Svårighetsgrad</span>
    <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#FCFAF5] border border-[#EBE7DF]" role="group" aria-label="Svårighetsgrad">
      {DIFFICULTY_LEVELS.map((level) => {
        const selected = value === level;
        return (
          <button
            key={level}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? undefined : level)}
            className={`min-h-[36px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors touch-manipulation ${
              selected ? 'bg-[#284235] text-white' : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            <DifficultyDots level={level} light={selected} />
            {DIFFICULTY_LABELS[level]}
          </button>
        );
      })}
    </div>
  </div>
);

/** Three small bars, filled up to the level: one for lätt, three for svår. */
export const DifficultyDots: React.FC<{ level: RecipeDifficulty; light?: boolean }> = ({ level, light }) => (
  <span className="inline-flex items-end gap-[2px]" aria-hidden="true">
    {DIFFICULTY_LEVELS.map((n) => (
      <span
        key={n}
        className={`w-[3px] rounded-full ${n === 1 ? 'h-1.5' : n === 2 ? 'h-2' : 'h-2.5'} ${
          n <= level ? (light ? 'bg-white' : 'bg-current') : light ? 'bg-white/35' : 'bg-current opacity-25'
        }`}
      />
    ))}
  </span>
);

interface DifficultyFilterProps {
  selected: RecipeDifficulty[];
  onChange: (selected: RecipeDifficulty[]) => void;
  className?: string;
}

/**
 * Filter on difficulty: Lätt, Medel and Svår can be turned on one by one.
 * Nothing chosen means all recipes, also those without a difficulty.
 */
export const DifficultyFilter: React.FC<DifficultyFilterProps> = ({ selected, onChange, className = '' }) => (
  <div className={`flex gap-1.5 ${className}`} role="group" aria-label="Svårighetsgrad">
    {DIFFICULTY_LEVELS.map((level) => {
      const on = selected.includes(level);
      return (
        <button
          key={level}
          type="button"
          aria-pressed={on}
          onClick={() => onChange(on ? selected.filter((l) => l !== level) : [...selected, level].sort())}
          className={`px-3 min-h-[36px] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors touch-manipulation ${
            on ? 'bg-[#284235] text-white' : 'bg-[#FCFAF5] border border-stone-200 text-stone-700 hover:bg-stone-100'
          }`}
        >
          <DifficultyDots level={level} light={on} />
          {DIFFICULTY_LABELS[level]}
        </button>
      );
    })}
  </div>
);

/** Whether a recipe passes the difficulty filter. */
export function matchesDifficulty(difficulty: RecipeDifficulty | undefined, selected: RecipeDifficulty[]): boolean {
  return selected.length === 0 || (difficulty !== undefined && selected.includes(difficulty));
}
