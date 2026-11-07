import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastProps {
  message: React.ReactNode;
  actions?: ToastAction[];
  /** Called when the message is swiped away, so the view can forget it too */
  onDismiss?: () => void;
}

/**
 * A short message that floats at the top of the screen, above everything else, without
 * moving anything. Plain text, and at most a couple of text buttons such as Ångra.
 * Rendered at the end of the page so it floats the same way inside an open recipe.
 * It can be swiped away upwards or to the side.
 */
export const Toast: React.FC<ToastProps> = ({ message, actions, onDismiss }) => {
  const [dismissed, setDismissed] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [leaving, setLeaving] = useState<null | 'up' | 'left' | 'right'>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);

  // A new message shows again even if the previous one was swiped away
  const messageKey = typeof message === 'string' ? message : '';
  useEffect(() => {
    setDismissed(false);
    setLeaving(null);
    setOffset({ x: 0, y: 0 });
  }, [messageKey]);

  if (dismissed) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    // Swiping starts anywhere except on the buttons
    if ((e.target as HTMLElement).closest('button')) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    // Upwards and sideways follow the finger, downwards only a little
    setOffset({ x: dx, y: dy < 0 ? dy : dy / 4 });
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    start.current = null;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const direction = dy < -30 && Math.abs(dy) > Math.abs(dx) ? 'up' : Math.abs(dx) > 70 ? (dx < 0 ? 'left' : 'right') : null;
    if (!direction) {
      setOffset({ x: 0, y: 0 });
      return;
    }
    setLeaving(direction);
    window.setTimeout(() => {
      setDismissed(true);
      onDismiss?.();
    }, 180);
  };

  const dragging = start.current !== null;
  const transform = leaving
    ? leaving === 'up'
      ? 'translateY(-160%)'
      : `translateX(${leaving === 'left' ? '-' : ''}120vw)`
    : `translate(${offset.x}px, ${offset.y}px)`;
  const opacity = leaving ? 0 : Math.max(0.3, 1 - Math.max(Math.abs(offset.x) / 300, -offset.y / 120, 0));

  return createPortal(
    <div
      className="fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top,0px))] z-[80] flex justify-center px-4 pointer-events-none font-sans"
      role="status"
      aria-live="polite"
    >
      {/* The slide-in sits on its own layer: it keeps its end position, which would otherwise
          lock the swipe below in place */}
      <div className="pointer-events-none max-w-sm w-full sm:w-auto animate-slide-down">
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{
          transform,
          opacity,
          transition: dragging ? 'none' : 'transform 180ms ease-out, opacity 180ms ease-out',
          touchAction: 'none',
        }}
        className="pointer-events-auto w-full bg-stone-900/95 text-white rounded-xl shadow-[0_8px_24px_rgba(28,25,23,0.25)] pl-4 pr-2 py-2 flex items-center gap-2 select-none"
      >
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
      </div>
    </div>,
    document.body
  );
};
