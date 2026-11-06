import React from 'react';

interface ParsedItemPreviewProps {
  name: string;
  /** Amount and unit as text, e.g. "1 kg", or null when no amount was written. */
  amountText: string | null;
  aisle: string;
  aisleIcon: React.ReactNode;
  comment?: string;
}

/** One line under the input that shows how the typed text will be added. */
export const ParsedItemPreview: React.FC<ParsedItemPreviewProps> = ({ name, amountText, aisle, aisleIcon, comment }) => (
  <p className="text-sm text-stone-600 flex items-center gap-x-1.5 gap-y-0.5 flex-wrap">
    <span>Läggs till som</span>
    <span className="font-semibold text-stone-900">
      {amountText ? `${amountText} ` : ''}
      {name}
    </span>
    <span className="text-stone-400">·</span>
    <span className="inline-flex items-center gap-1">
      {aisleIcon}
      {aisle}
    </span>
    {comment && (
      <>
        <span className="text-stone-400">·</span>
        <span>{comment}</span>
      </>
    )}
  </p>
);
