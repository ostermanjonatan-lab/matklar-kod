import React from 'react';
import { createPortal } from 'react-dom';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastProps {
  message: React.ReactNode;
  actions?: ToastAction[];
}

/**
 * A short message that floats at the top of the screen, above everything else, without
 * moving anything. Plain text, and at most a couple of text buttons such as Ångra.
 * Rendered at the end of the page so it floats the same way inside an open recipe.
 */
export const Toast: React.FC<ToastProps> = ({ message, actions }) =>
  createPortal(
    <div
      className="fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top,0px))] z-[80] flex justify-center px-4 pointer-events-none font-sans"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto max-w-sm w-full sm:w-auto bg-stone-900/95 text-white rounded-xl shadow-[0_8px_24px_rgba(28,25,23,0.25)] pl-4 pr-2 py-2 flex items-center gap-2 animate-slide-down">
        <p className="flex-1 min-w-0 text-sm leading-snug py-1.5">{message}</p>
        {actions?.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={a.onClick}
            className="shrink-0 min-h-[36px] px-2.5 text-sm font-semibold text-emerald-200 hover:text-white touch-manipulation"
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
