import React, { useRef, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import type { CoverFocus } from '../../types/recipe';
import { MAX_ZOOM, MIN_ZOOM, coverFocusStyle, isDefaultFocus, normalizeCoverFocus } from '../../utils/coverFocus';

interface CoverFocusEditorProps {
  src: string;
  value: CoverFocus | undefined;
  onSave: (focus: CoverFocus | undefined) => void;
  onClose: () => void;
}

const CENTER: CoverFocus = { x: 50, y: 50, zoom: 1 };
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Moves and zooms a recipe's picture in its boxes. The picture is dragged with a finger or the
 * mouse, and zoomed with two fingers, the wheel or the slider. The box has the shape of the
 * cards on the phone, and a small square shows the thumbnails and the cards on wide screens.
 */
export const CoverFocusEditor: React.FC<CoverFocusEditorProps> = ({ src, value, onSave, onClose }) => {
  const [focus, setFocus] = useState<CoverFocus>(value || CENTER);
  const box = useRef<HTMLDivElement>(null);
  const natural = useRef<{ w: number; h: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  const setZoom = (zoom: number) => setFocus((f) => ({ ...f, zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) }));

  // How far the focus moves for a pixel of dragging, so that the picture follows the finger
  const percentPerPixel = (f: CoverFocus) => {
    const el = box.current;
    const n = natural.current;
    if (!el || !n) return { x: 0, y: 0 };
    const { width: W, height: H } = el.getBoundingClientRect();
    const s = Math.max(W / n.w, H / n.h);
    const overX = n.w * s * f.zoom - W;
    const overY = n.h * s * f.zoom - H;
    return { x: overX > 1 ? 100 / overX : 0, y: overY > 1 ? 100 / overY : 0 };
  };

  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) pinch.current = { dist: distance(), zoom: focus.zoom };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const last = pointers.current.get(e.pointerId);
    if (!last) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) {
      if (pinch.current) {
        const d = distance();
        const start = pinch.current;
        setZoom(start.zoom * (d / Math.max(1, start.dist)));
      }
      return;
    }
    setFocus((f) => {
      const k = percentPerPixel(f);
      return { ...f, x: clamp(f.x - dx * k.x, 0, 100), y: clamp(f.y - dy * k.y, 0, 100) };
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const style = coverFocusStyle(focus);
  const zoomPercent = Math.round(focus.zoom * 100);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-fade-in font-sans"
      role="dialog"
      aria-modal="true"
      aria-label="Justera bild"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl animate-scale-up">
        <div className="flex items-center justify-between">
          <h3 className="font-serif font-bold text-lg text-stone-900">Justera bild</h3>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 w-11 h-11 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 touch-manipulation"
            aria-label="Avbryt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-stone-500">Dra i bilden för att flytta den. Nyp eller använd reglaget för att zooma.</p>

        <div
          ref={box}
          className="mt-3 relative aspect-16/9 rounded-2xl overflow-hidden bg-stone-900 cursor-grab active:cursor-grabbing select-none touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(e) => setZoom(focus.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => {
              natural.current = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight };
            }}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={style}
          />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-stone-900 shrink-0" aria-hidden="true">
            <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" style={style} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setZoom(focus.zoom - 0.1)}
                disabled={focus.zoom <= MIN_ZOOM}
                className="w-9 h-9 rounded-full flex items-center justify-center text-stone-700 hover:bg-stone-100 disabled:opacity-30 touch-manipulation"
                aria-label="Zooma ut"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={focus.zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-label="Zoom"
                className="flex-1 min-w-0 accent-[#284235]"
              />
              <button
                type="button"
                onClick={() => setZoom(focus.zoom + 0.1)}
                disabled={focus.zoom >= MAX_ZOOM}
                className="w-9 h-9 rounded-full flex items-center justify-center text-stone-700 hover:bg-stone-100 disabled:opacity-30 touch-manipulation"
                aria-label="Zooma in"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-stone-500 pl-2 tabular-nums">{zoomPercent} %</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFocus(CENTER)}
            disabled={isDefaultFocus(normalizeCoverFocus(focus))}
            className="px-4 min-h-[44px] rounded-xl text-sm font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-40 touch-manipulation"
          >
            Återställ
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(normalizeCoverFocus(focus));
              onClose();
            }}
            className="ml-auto px-5 min-h-[44px] rounded-xl bg-[#284235] hover:bg-[#1C3026] text-white text-sm font-semibold touch-manipulation"
          >
            Använd
          </button>
        </div>
      </div>
    </div>
  );
};
