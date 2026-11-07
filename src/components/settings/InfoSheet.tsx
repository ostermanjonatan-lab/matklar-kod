import React from 'react';
import { X } from 'lucide-react';

/** A sheet with a title and text to read, such as Personuppgifter or Nyheter. */
export const InfoSheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  onClose,
  children,
}) => (
  <div
    className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center animate-fade-in font-sans"
    onClick={onClose}
    role="dialog"
    aria-modal="true"
    aria-label={title}
  >
    <div
      className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[90dvh] overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-5 pt-4 pb-3 border-b border-[#EBE7DF] flex items-center justify-between shrink-0">
        <h2 className="font-serif font-bold text-lg text-stone-900">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-100 touch-manipulation"
          aria-label="Stäng"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
    </div>
  </div>
);

/** Shared text styles for the sheets */
export const sheetHeading = 'font-semibold text-stone-900 pt-4';
export const sheetText = 'text-sm text-stone-700 leading-relaxed mt-1';
