import React from 'react';
import {
  Coffee,
  EggFried,
  Fish,
  Flame,
  Drumstick,
  Hamburger,
  House,
  Pizza,
  Salad,
  Sandwich,
  ShoppingBag,
  Soup,
  Utensils,
  UtensilsCrossed,
} from 'lucide-react';
import { LunchboxIcon } from '../icons/LunchboxIcon';

type IconComponent = React.FC<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;

// First match wins, so the more specific words come first
const MEAL_ICONS: [RegExp, IconComponent][] = [
  [/rester|matlåd/i, LunchboxIcon],
  [/äta ute|restaurang|krog|lunchställe/i, UtensilsCrossed],
  [/hämtmat|take ?away|beställ|leverans|foodora|wolt|sushi|thai|kebab/i, ShoppingBag],
  [/bortbjud|hos (mormor|farmor|morfar|farfar|mamma|pappa|vänner|\p{Lu})|middag hos|kalas/iu, House],
  [/pizza/i, Pizza],
  [/burgare|hamburg/i, Hamburger],
  [/soppa/i, Soup],
  [/sallad/i, Salad],
  [/grill/i, Flame],
  [/fisk|lax|torsk|sill|räk/i, Fish],
  [/kyckling/i, Drumstick],
  [/macka|mackor|smörgås|toast/i, Sandwich],
  [/pannkak|plättar|våffl|omelett|ägg/i, EggFried],
  [/\bte\b|kaffe|fika/i, Coffee],
];

/** An icon that fits a meal written in words, such as Rester or Hämtmat. */
export const customMealIcon = (name: string): IconComponent =>
  MEAL_ICONS.find(([re]) => re.test(name))?.[1] ?? Utensils;

/**
 * The picture for a meal that is not a recipe: grey, an icon that fits the meal and, when
 * there is room, its name. Put it in a box with a size and position (it covers the box).
 */
export const CustomMealImage: React.FC<{ name: string }> = ({ name }) => {
  const Icon = customMealIcon(name);
  return (
    <span role="img" aria-label={name} title={name} className="@container absolute inset-0 bg-stone-100">
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
        <Icon className="w-5 h-5 @[9rem]:w-12 @[9rem]:h-12 @[18rem]:w-14 @[18rem]:h-14 text-stone-400 @[9rem]:text-stone-300 stroke-[1.75] @[9rem]:stroke-[1.25]" aria-hidden="true" />
        <span className="hidden @[9rem]:block max-w-full truncate font-serif font-bold text-xl text-stone-800">{name}</span>
      </span>
    </span>
  );
};
