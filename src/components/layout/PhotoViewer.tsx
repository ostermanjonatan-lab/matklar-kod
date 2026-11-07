import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * A photo in full screen on black. On a phone: pinch or double tap to zoom in, drag to move around
 * when zoomed in. A tap (a click with a mouse), the cross, Esc or the phone's back button closes it.
 */
export const PhotoViewer: React.FC<{ src: string; alt: string; onClose: () => void }> = ({ src, alt, onClose }) => {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const gesture = useRef<{
    startDist: number;
    startScale: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const lastTap = useRef(0);
  // With a mouse there are no touches: a click closes straight away
  const touched = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const distance = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = (e: React.TouchEvent) => {
    touched.current = true;
    const v = viewRef.current;
    gesture.current = {
      startDist: e.touches.length === 2 ? distance(e.touches) : 0,
      startScale: v.scale,
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      originX: v.x,
      originY: v.y,
      moved: false,
    };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const g = gesture.current;
    if (!g) return;
    if (e.touches.length === 2) {
      if (!g.startDist) {
        g.startDist = distance(e.touches);
        g.startScale = viewRef.current.scale;
      }
      const scale = Math.min(4, Math.max(1, (g.startScale * distance(e.touches)) / g.startDist));
      g.moved = true;
      setView((v) => (scale === 1 ? { scale: 1, x: 0, y: 0 } : { ...v, scale }));
    } else if (e.touches.length === 1 && viewRef.current.scale > 1) {
      const dx = e.touches[0].clientX - g.startX;
      const dy = e.touches[0].clientY - g.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) g.moved = true;
      setView((v) => ({ ...v, x: g.originX + dx, y: g.originY + dy }));
    } else if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - g.startX;
      const dy = e.touches[0].clientY - g.startY;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) g.moved = true;
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length > 0) return;
    const moved = gesture.current?.moved;
    gesture.current = null;
    if (moved) {
      e.preventDefault();
      return;
    }
    // Double tap: zoom in, or back out
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      e.preventDefault();
      setView((v) => (v.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2.5, x: 0, y: 0 }));
    } else {
      lastTap.current = now;
    }
  };

  // A single tap closes, but only when it was not the first half of a double tap
  const closeTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  const onClick = () => {
    if (!touched.current) {
      onClose();
      return;
    }
    window.clearTimeout(closeTimer.current);
    if (viewRef.current.scale > 1) return;
    closeTimer.current = window.setTimeout(() => {
      if (lastTap.current !== 0 && viewRef.current.scale === 1) onClose();
    }, 320);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[90] bg-black flex items-center justify-center animate-fade-in touch-none select-none"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="max-w-full max-h-full object-contain transition-transform duration-75"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 w-11 h-11 rounded-full bg-black/50 text-white flex items-center justify-center touch-manipulation"
        aria-label="Stäng bilden"
      >
        <X className="w-6 h-6" />
      </button>
    </div>,
    document.body
  );
};
