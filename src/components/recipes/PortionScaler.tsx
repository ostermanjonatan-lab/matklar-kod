import React from 'react';
import { Minus, Plus, Users } from 'lucide-react';

interface PortionScalerProps {
  currentServings: number;
  baseServings: number;
  onServingsChange: (newServings: number) => void;
  minServings?: number;
  maxServings?: number;
}

export const PortionScaler: React.FC<PortionScalerProps> = ({
  currentServings,
  baseServings,
  onServingsChange,
  minServings = 1,
  maxServings = 24,
}) => {
  const handleDecrement = () => {
    if (currentServings > minServings) {
      onServingsChange(currentServings - 1);
    }
  };

  const handleIncrement = () => {
    if (currentServings < maxServings) {
      onServingsChange(currentServings + 1);
    }
  };

  const handleReset = () => {
    onServingsChange(baseServings);
  };

  const isScaled = currentServings !== baseServings;

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between shadow-xs w-full max-w-full gap-2 min-w-0">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm sm:text-base font-bold text-stone-900 leading-tight">
              {currentServings} {currentServings === 1 ? 'portion' : 'portioner'}
            </span>
            {isScaled && (
              <button
                type="button"
                onClick={handleReset}
                className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md hover:bg-emerald-200 transition-colors touch-manipulation shrink-0"
                title="Återställ till original"
              >
                Orig: {baseServings}
              </button>
            )}
          </div>
          <p className="text-[11px] text-stone-500 truncate mt-0.5">
            {isScaled ? 'Mängderna har anpassats' : `Originalrecept för ${baseServings} pers`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 bg-white border border-stone-200 p-1 rounded-2xl shadow-xs shrink-0">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={currentServings <= minServings}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-stone-700 bg-stone-100 hover:bg-stone-200 active:scale-90 disabled:opacity-30 disabled:pointer-events-none transition-all touch-manipulation"
          aria-label="Minska portioner"
        >
          <Minus className="w-4 h-4 stroke-[2.5]" />
        </button>

        <span className="w-6 sm:w-7 text-center text-sm sm:text-base font-bold text-stone-900 tabular-nums">
          {currentServings}
        </span>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={currentServings >= maxServings}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white bg-emerald-700 hover:bg-emerald-800 active:scale-90 disabled:opacity-30 disabled:pointer-events-none transition-all touch-manipulation shadow-xs"
          aria-label="Öka portioner"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
