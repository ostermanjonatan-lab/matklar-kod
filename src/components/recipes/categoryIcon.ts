import { Apple, CakeSlice, Droplet, EggFried, GlassWater, Salad, Utensils, UtensilsCrossed, Wheat, type LucideIcon } from 'lucide-react';

/** An icon for a recipe's category, shown before its name on the recipe cards */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  middag: Utensils,
  förrätt: Salad,
  efterrätt: CakeSlice,
  bröd: Wheat,
  såser: Droplet,
  dryck: GlassWater,
  frukost: EggFried,
  mellanmål: Apple,
};

/** Categories the household made itself get a plain plate setting */
export const categoryIcon = (category: string | null | undefined): LucideIcon =>
  CATEGORY_ICONS[(category || '').trim().toLowerCase()] ?? UtensilsCrossed;
