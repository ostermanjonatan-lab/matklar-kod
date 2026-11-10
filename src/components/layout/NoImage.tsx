import React from 'react';
import { CookingPot } from 'lucide-react';

/**
 * Fills a recipe's picture box when no picture was chosen: grey, a pot in the middle and, when
 * there is room, the words Ingen bild vald. Like the empty dinner in Planerare.
 * Put it in a box with a size and position (it covers the box). In a big box the pot sits a bit
 * higher, so it stays clear of a name written across the bottom of the picture.
 */
export const NoImage: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    aria-label="Ingen bild vald"
    role="img"
    className={`@container absolute inset-0 bg-stone-100 ${className}`}
  >
    <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 @[18rem]:pb-[28%]">
    <CookingPot className="w-6 h-6 @[9rem]:w-12 @[9rem]:h-12 @[18rem]:w-14 @[18rem]:h-14 text-stone-300 stroke-[1.5] @[9rem]:stroke-[1.25]" aria-hidden="true" />
    <span className="hidden @[9rem]:block text-sm text-stone-500">Ingen bild vald</span>
    </span>
  </span>
);
