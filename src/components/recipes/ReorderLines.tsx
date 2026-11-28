import React, { useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';

interface ReorderLinesProps {
  /** The text, one item per line */
  value: string;
  onChange: (value: string) => void;
}

/**
 * The lines of a text as a list whose order is changed by dragging a line by its handle. The text
 * changes as the line is moved. Empty lines are left out.
 */
export const ReorderLines: React.FC<ReorderLinesProps> = ({ value, onChange }) => {
  const lines = value.split('\n').filter((l) => l.trim());
  const [dragging, setDragging] = useState<number | null>(null);
  const draggingRef = useRef<number | null>(null);
  const rows = useRef<(HTMLLIElement | null)[]>([]);
  // The list keeps hold of the finger: a line's own element is moved in the page as it changes place
  const list = useRef<HTMLOListElement | null>(null);
  const linesRef = useRef(lines);
  linesRef.current = lines;

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= linesRef.current.length) return false;
    const next = [...linesRef.current];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    linesRef.current = next;
    onChange(next.join('\n'));
    return true;
  };

  // The box the form scrolls in, so a line can be dragged past the edge of the screen
  const scroller = (el: HTMLElement | null): HTMLElement | null => {
    for (let e = el?.parentElement; e; e = e.parentElement) {
      const o = getComputedStyle(e).overflowY;
      if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight) return e;
    }
    return document.scrollingElement as HTMLElement | null;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const from = draggingRef.current;
    if (from === null) return;
    // The line under the finger takes the dragged line's place
    const over = rows.current.findIndex((row) => {
      if (!row) return false;
      const r = row.getBoundingClientRect();
      return e.clientY >= r.top && e.clientY < r.bottom;
    });
    if (over >= 0 && over !== from && move(from, over)) {
      draggingRef.current = over;
      setDragging(over);
    }
    // Near the top or bottom of the screen the form scrolls along
    const box = scroller(list.current);
    if (box) {
      const edge = 70;
      if (e.clientY < edge) box.scrollBy(0, -12);
      else if (e.clientY > window.innerHeight - edge) box.scrollBy(0, 12);
    }
  };

  const stop = () => {
    draggingRef.current = null;
    setDragging(null);
  };

  return (
    <ol
      ref={list}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      className="border-y border-[#EBE7DF] divide-y divide-[#EBE7DF] select-none"
    >
      {lines.map((line, i) => (
        <li
          // The same line keeps its key when it moves (the second "1 tsk salt" is "1 tsk salt#1")
          key={`${line}#${lines.slice(0, i).filter((l) => l === line).length}`}
          ref={(el) => {
            rows.current[i] = el;
          }}
          className={`flex items-center gap-2 min-h-[44px] text-sm transition-colors ${
            dragging === i ? 'bg-[#FCFAF5] text-stone-900 shadow-sm relative z-10' : 'text-stone-800'
          }`}
        >
          <button
            type="button"
            aria-label={`Flytta ${line}. Pil upp och ner flyttar.`}
            className="w-10 h-11 -ml-1 shrink-0 flex items-center justify-center text-stone-400 cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={(e) => {
              e.preventDefault();
              list.current?.setPointerCapture(e.pointerId);
              draggingRef.current = i;
              setDragging(i);
            }}
            onKeyDown={(e) => {
              const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : null;
              if (to === null) return;
              e.preventDefault();
              if (move(i, to)) requestAnimationFrame(() => rows.current[to]?.querySelector('button')?.focus());
            }}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <span className={`flex-1 min-w-0 py-2 pr-2 break-words ${/:$/.test(line.trim()) ? 'font-semibold' : ''}`}>{line}</span>
        </li>
      ))}
    </ol>
  );
};
