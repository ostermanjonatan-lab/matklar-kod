import React from 'react';

interface ConfirmSheetProps {
  title: string;
  /** One short sentence, only when the title is not enough. */
  text?: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Asks before something is removed. A sheet from the bottom on the phone, a small box on a
 * wide screen. The same look as "Spara ändringarna?" in Redigera recept.
 */
export const ConfirmSheet: React.FC<ConfirmSheetProps> = ({ title, text, confirmLabel, onConfirm, onCancel }) => (
  <div
    className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center animate-fade-in font-sans"
    onClick={onCancel}
    role="dialog"
    aria-modal="true"
    aria-label={title}
  >
    <div
      className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="font-serif text-lg font-bold text-stone-900">{title}</h3>
      {text && <p className="text-sm text-stone-600">{text}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 min-h-[46px] rounded-xl bg-stone-100 text-stone-700 text-sm font-semibold touch-manipulation"
        >
          Avbryt
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 min-h-[46px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold touch-manipulation"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);
