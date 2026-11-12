import React, { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';

/**
 * A row that can be swiped to the left to remove it. While swiping, a red area with a bin shows
 * behind the row. Let go past about a third of the width and the row slides out and onRemove is
 * called; a shorter swipe slides back. Up and down still scrolls the page as usual, and a tap
 * after a swipe does not count as a tap on the row.
 */
export const SwipeToDelete: React.FC<{
  onRemove: () => void;
  children: React.ReactNode;
}> = ({ onRemove, children }) => {
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; id: number; horizontal: boolean | null } | null>(null);
  const swiped = useRef(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, horizontal: null };
    swiped.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const moveX = e.clientX - s.x;
    const moveY = e.clientY - s.y;
    if (s.horizontal === null) {
      if (Math.abs(moveX) < 8 && Math.abs(moveY) < 8) return;
      // Decided once per touch: mostly sideways swipes the row, otherwise the page scrolls
      s.horizontal = Math.abs(moveX) > Math.abs(moveY);
      if (s.horizontal) {
        setDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }
    }
    if (!s.horizontal) return;
    swiped.current = true;
    // Only to the left; to the right it gives a little and stops
    setDx(moveX < 0 ? moveX : moveX / 6);
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    start.current = null;
    setDragging(false);
    if (!s.horizontal) return;
    // The phone took the touch over (to scroll, or the app went to the background): never a
    // removal, the row slides back
    if (e.type === 'pointercancel') {
      setDx(0);
      return;
    }
    const width = rowRef.current?.offsetWidth || 360;
    if (dx < -width / 3) {
      setLeaving(true);
      setDx(-width - 20);
      if (navigator.vibrate) navigator.vibrate(10);
      window.setTimeout(onRemove, 200);
    } else {
      setDx(0);
    }
  };

  const shown = Math.min(1, -dx / 80);

  return (
    <div
      ref={rowRef}
      className="relative overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClickCapture={(e) => {
        // The tap that ends a swipe is not a tap on the row
        if (swiped.current) {
          e.stopPropagation();
          e.preventDefault();
          swiped.current = false;
        }
      }}
      style={{ touchAction: 'pan-y' }}
    >
      <div
        className="absolute inset-0 flex items-center justify-end pr-4 bg-rose-600 text-white text-sm font-semibold"
        style={{ opacity: dx < 0 ? 1 : 0 }}
        aria-hidden="true"
      >
        <span style={{ opacity: shown }} className="flex items-center gap-2 whitespace-nowrap">
          <Trash2 className="w-4 h-4" />
          Ta bort
        </span>
      </div>
      <div
        className="relative bg-[#FCFAF5]"
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? 'none' : 'transform 200ms ease-out',
          opacity: leaving ? 0.6 : 1,
        }}
      >
        {children}
      </div>
    </div>
  );
};
