import React from 'react';
import { Beef, Carrot, Croissant, CupSoda, Droplet, Fish, Milk, Snowflake, Wheat, Package } from 'lucide-react';

/** Aisle icons: thin, grey and the same size, so they support the name without taking over */
const AISLE_ICONS: Record<string, typeof Carrot> = {
  'Frukt & Grönt': Carrot,
  'Mejeri': Milk,
  'Kött & Chark': Beef,
  'Fisk & Skaldjur': Fish,
  'Skafferi': Wheat,
  'Kryddor & Olja': Droplet,
  'Bröd & Bageri': Croissant,
  'Fryst': Snowflake,
  'Drycker': CupSoda,
};

export const AisleIcon: React.FC<{ aisle: string; className?: string }> = ({ aisle, className = 'w-4 h-4 text-stone-500' }) => {
  const Icon = AISLE_ICONS[aisle] || Package;
  return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />;
};
