import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, FileText, ExternalLink } from 'lucide-react';

interface DocumentViewerProps {
  documentUrl: string;
  recipeTitle: string;
  sourceType: 'manual' | 'url' | 'pdf' | 'recipe_image';
  onClose: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentUrl,
  recipeTitle,
  sourceType,
  onClose,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.3, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.3, 0.7));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col justify-between backdrop-blur-sm animate-fade-in">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-stone-900/80 border-b border-stone-800 text-white z-10">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="truncate">
            <h3 className="text-sm font-semibold text-white truncate">{recipeTitle}</h3>
            <p className="text-[11px] text-stone-400">
              {sourceType === 'pdf' ? 'Originaldokument (PDF / Skanning)' : 'Foto på recept / kokbokssida'}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-stone-800 text-stone-300 hover:text-white flex items-center justify-center active:scale-90 transition-all shrink-0 ml-2"
          aria-label="Stäng visare"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Image Container */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 touch-pan-x touch-pan-y">
        <div
          className="transition-transform duration-150 ease-out origin-center cursor-grab active:cursor-grabbing max-w-full"
          style={{
            transform: `scale(${zoomLevel})`,
          }}
        >
          <img
            src={documentUrl}
            alt={`Originaldokument för ${recipeTitle}`}
            className="max-h-[75vh] w-auto max-w-full rounded-lg shadow-2xl object-contain border border-stone-700 select-none pointer-events-none"
            draggable={false}
          />
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className="px-4 py-3 bg-stone-900/90 border-t border-stone-800 flex items-center justify-between gap-3 text-white pb-safe">
        <div className="text-xs text-stone-400 font-medium">
          Zoom: {Math.round(zoomLevel * 100)}%
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoomLevel <= 0.75}
            className="w-11 h-11 rounded-xl bg-stone-800 hover:bg-stone-700 active:scale-95 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-stone-200 transition-all"
            aria-label="Zooma ut"
          >
            <ZoomOut className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={handleResetZoom}
            className="px-3 h-11 rounded-xl bg-stone-800 hover:bg-stone-700 active:scale-95 flex items-center justify-center text-xs font-semibold text-stone-300 gap-1.5 transition-all"
            aria-label="Återställ zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            100%
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoomLevel >= 3}
            className="w-11 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-white transition-all shadow-md"
            aria-label="Zooma in"
          >
            <ZoomIn className="w-5 h-5" />
          </button>

          <a
            href={documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-11 h-11 rounded-xl bg-stone-800 hover:bg-stone-700 active:scale-95 flex items-center justify-center text-stone-300 transition-all ml-1"
            title="Öppna originalfil i ny flik"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>
      </div>
    </div>
  );
};
