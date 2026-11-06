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
