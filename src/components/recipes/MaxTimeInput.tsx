import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface MaxTimeInputProps {
  value: number | null;
  /** Called with the number of minutes, or null for all times */
  onChange: (value: number | null) => void;
  /**
   * When true, the value is only passed on when you leave the field or press Enter,
   * so a change does not start anything while you are typing (used in Slumpa).
   */
  commitOnBlur?: boolean;
  disabled?: boolean;
  id?: string;
}

/** Max cooking time typed in by hand, in minutes. Empty means all times. */
export const MaxTimeInput: React.FC<MaxTimeInputProps> = ({ value, onChange, commitOnBlur = false, disabled, id }) => {
  const [text, setText] = useState<string>(value === null ? '' : String(value));

  // Follow changes from outside, for example Återställ
  useEffect(() => {
    setText(value === null ? '' : String(value));
  }, [value]);

  const parse = (t: string): number | null => {
    const n = parseInt(t, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const commit = (t: string) => {
    const next = parse(t);
    if (next !== value) onChange(next);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-32">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={3}
          value={text}
          disabled={disabled}
          onChange={(e) => {
            const t = e.target.value.replace(/\D/g, '');
            setText(t);
            if (!commitOnBlur) commit(t);
          }}
          onBlur={() => commitOnBlur && commit(text)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(text);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Alla tider"
          aria-label="Max tillagningstid i minuter"
          className="w-full h-10 bg-[#FCFAF5] border border-stone-200 rounded-xl pl-3 pr-11 text-base sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235] disabled:opacity-50"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500 pointer-events-none">min</span>
      </div>
      {value !== null && !disabled && (
        <button
          type="button"
          onClick={() => {
            setText('');
            onChange(null);
          }}
          className="h-10 px-2 flex items-center gap-1 text-xs font-semibold text-[#284235] touch-manipulation"
          aria-label="Visa alla tider"
        >
          <X className="w-4 h-4" />
          Alla tider
        </button>
      )}
    </div>
  );
};
