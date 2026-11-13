import React from 'react';
import { Minus, Plus } from 'lucide-react';

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
  // The same highest number of portions everywhere: here, in the recipe form and for recipes from links
  maxServings = 100,
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

  const isScaled = currentServings !== baseServings;

  return (
    <div className="flex items-center justify-between gap-3 w-full min-w-0">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-stone-900">Portioner</div>
        {isScaled && (
          <div className="text-xs text-stone-500 mt-0.5">Original: {baseServings} port</div>
        )}
      </div>

      <div className="flex items-center gap-1 bg-white border border-stone-200 p-1 rounded-2xl shrink-0">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={currentServings <= minServings}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-stone-700 bg-stone-100 active:bg-stone-200 active:scale-90 disabled:opacity-30 disabled:pointer-events-none transition-all touch-manipulation"
          aria-label="Minska portioner"
        >
          <Minus className="w-4 h-4 stroke-[2.5]" />
        </button>

        <span className="w-8 text-center text-base font-bold text-stone-900 tabular-nums" aria-live="polite">
          {currentServings}
        </span>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={currentServings >= maxServings}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white bg-[#284235] active:scale-90 disabled:opacity-30 disabled:pointer-events-none transition-all touch-manipulation"
          aria-label="Öka portioner"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
