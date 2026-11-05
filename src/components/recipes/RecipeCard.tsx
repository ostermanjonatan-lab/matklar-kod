import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Recipe } from '../../types/recipe';
import { isRecipeNew, getRecipeSubcategories } from '../../types/recipe';
import { useRecipes } from '../../context/RecipeContext';
import { Heart, Clock, Star, Check, ShoppingCart } from 'lucide-react';
import { formatCookingTime } from '../../utils/formatters';

interface RecipeCardProps {
  recipe: Recipe;
  onClick: (recipe: Recipe) => void;
  onToggleFavorite?: (id: string) => void;
  onShareRecipe?: (recipe: Recipe) => void;
  /** Returns false if the recipe wasn't added right away, e.g. while a question is shown. */
  onAddToShoppingList?: (recipe: Recipe) => boolean;
  isInShoppingList?: boolean;
}

let cachedCanvas: HTMLCanvasElement | null = null;

function measureTextWidth(text: string, font = '500 11px system-ui, -apple-system, sans-serif'): number {
  if (typeof document !== 'undefined') {
    try {
      if (!cachedCanvas) {
        cachedCanvas = document.createElement('canvas');
      }
      const ctx = cachedCanvas.getContext('2d');
      if (ctx) {
        ctx.font = font;
        return ctx.measureText(text).width;
      }
    } catch {
      // fallback
    }
  }
  // Fast character-weighted fallback for SSR / non-DOM
  let w = 0;
  for (const ch of text) {
    if (/[iljtI1\.,\s]/.test(ch)) w += 4;
    else if (/[wmMWÖÄÅ&@]/.test(ch)) w += 8.5;
    else if (/[A-Z]/.test(ch)) w += 7.5;
    else w += 6.5;
  }
  return w;
}

function getPillWidth(text: string, isPlus = false): number {
  const font = isPlus
    ? '700 10px system-ui, -apple-system, sans-serif'
    : '500 11px system-ui, -apple-system, sans-serif';
  const pad = isPlus ? 18 : 22; // padding + borders
  return Math.ceil(measureTextWidth(text, font) + pad);
}

function calculateVisibleSubcategories(
  containerWidth: number,
  category: string,
  hasSourceBadge: boolean,
  subcategories: string[]
): { visible: string[]; hiddenCount: number; hidden: string[] } {
  if (!containerWidth || containerWidth <= 0 || subcategories.length === 0) {
    return { visible: [], hiddenCount: 0, hidden: [] };
  }

  const GAP = 6;
  const categoryWidth = getPillWidth(category);
  const sourceWidth = hasSourceBadge ? 42 + GAP : 0;

  // Available width for subcategories after category badge and source badge
  const availableWidth = containerWidth - categoryWidth - sourceWidth - GAP;
  if (availableWidth <= 28) {
    return { visible: [], hiddenCount: subcategories.length, hidden: subcategories };
  }

  // Pre-calculate all subcategory pill widths
  const widths = subcategories.map((s) => getPillWidth(s));

  // Check if ALL subcategories fit
  let totalAllWidth = 0;
  for (let i = 0; i < widths.length; i++) {
    totalAllWidth += widths[i] + (i > 0 ? GAP : 0);
  }

  if (totalAllWidth <= availableWidth) {
    return { visible: subcategories, hiddenCount: 0, hidden: [] };
  }

  // If not all fit, find how many fit together with the +N badge
  const visible: string[] = [];
  let accumulated = 0;

  for (let i = 0; i < subcategories.length; i++) {
    const itemWidth = widths[i];
    const currentGap = visible.length > 0 ? GAP : 0;
    const remainingCount = subcategories.length - (visible.length + 1);
    const plusBadgeWidth = remainingCount > 0 ? GAP + getPillWidth(`+${remainingCount}`, true) : 0;

    if (accumulated + currentGap + itemWidth + plusBadgeWidth <= availableWidth) {
      accumulated += currentGap + itemWidth;
      visible.push(subcategories[i]);
    } else {
      break;
    }
  }

  const hidden = subcategories.slice(visible.length);
  return {
    visible,
    hiddenCount: hidden.length,
    hidden,
  };
}

export const RecipeCard = React.memo<RecipeCardProps>(
  ({ recipe, onClick, onToggleFavorite, onAddToShoppingList, isInShoppingList }) => {
    // Only access context if onToggleFavorite was not provided by parent
    const recipesContext = useRecipes();
    const toggleFav = onToggleFavorite || recipesContext.toggleFavorite;
    const [addedToCart, setAddedToCart] = useState<boolean>(false);

    const handleCardClick = () => {
      onClick(recipe);
    };

    const handleHeartClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleFav(recipe.id);
    };

    const touchStartPosRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length > 0) {
        touchStartPosRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          moved: false,
        };
      }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      if (!touchStartPosRef.current || e.touches.length === 0) return;
      const dx = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);
      // If finger moved more than 8px in any direction, user is scrolling!
      if (dx > 8 || dy > 8) {
        touchStartPosRef.current.moved = true;
      }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
      if (touchStartPosRef.current?.moved) {
        e.stopPropagation();
      }
    };

    const handleShoppingClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      // If finger moved during touch gesture (scrolling), cancel click immediately
      if (touchStartPosRef.current?.moved) {
        touchStartPosRef.current = null;
        return;
      }
      touchStartPosRef.current = null;

      if (onAddToShoppingList) {
        if (!onAddToShoppingList(recipe)) return;
      } else {
        if (recipe.ingredients && recipe.ingredients.length > 0) {
          recipesContext.addIngredientsToShoppingList(
            recipe.ingredients,
            recipe.title,
            true
          );
        }
      }
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    };

    const getSourceBadge = () => {
      if (recipe.sourceType === 'recipe_image' || recipe.recipeDocumentUrl) {
        return (
          <span
            className="bg-black/70 text-stone-100 text-[10px] font-medium px-2.5 py-0.5 rounded-full border border-white/10 shadow-xs shrink-0 pointer-events-auto"
            title="Originalfoto/dokument bifogat"
          >
            Foto
          </span>
        );
      }
      if (recipe.sourceType === 'pdf') {
        return (
          <span
            className="bg-black/70 text-stone-100 text-[10px] font-medium px-2.5 py-0.5 rounded-full border border-white/10 shadow-xs shrink-0 pointer-events-auto"
            title="PDF bifogad"
          >
            PDF
          </span>
        );
      }
      return null;
    };

    // Subcategories & single-line adaptive overflow calculation
    const subcategories = useMemo(() => getRecipeSubcategories(recipe), [recipe]);
    const badgeContainerRef = useRef<HTMLDivElement | null>(null);
    const [containerWidth, setContainerWidth] = useState<number>(0);

    useEffect(() => {
      const el = badgeContainerRef.current;
      if (!el) return;

      setContainerWidth(el.clientWidth);

      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const width = entry.contentRect?.width ?? entry.contentBoxSize?.[0]?.inlineSize;
            if (width && width > 0) {
              setContainerWidth(width);
            }
          }
        });
        observer.observe(el);
        return () => observer.disconnect();
      }
    }, []);

    const hasSource = Boolean(
      recipe.sourceType === 'recipe_image' ||
      recipe.recipeDocumentUrl ||
      recipe.sourceType === 'pdf'
    );

    const { visible: visibleSubcategories, hiddenCount, hidden: hiddenSubcategories } = useMemo(() => {
      return calculateVisibleSubcategories(
        containerWidth || 240,
        recipe.category || '',
        hasSource,
        subcategories
      );
    }, [containerWidth, recipe.category, hasSource, subcategories]);

    return (
      <div
        onClick={handleCardClick}
        style={{ contentVisibility: 'auto', containIntrinsicSize: '300px' }}
        className="group relative aspect-[16/11] md:aspect-[4/5] w-full rounded-3xl border border-[#EBE7DF] shadow-xs hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer active:scale-[0.985] bg-stone-900"
      >
        {/* Cover Image */}
        <img
          src={recipe.coverImageUrl}
          alt={recipe.title}
          loading="lazy"
          onError={(e) => {
            const el = e.currentTarget;
            el.onerror = null;
            el.src = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80';
          }}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />

        {/* Mjuk botten-gradient så att bilden förblir ljus och aptitretande */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/40 via-40% to-transparent pointer-events-none" />

        {/* Top Badges (Category pill + optional Document badge + Subcategories strictly on 1 row) */}
        <div
          ref={badgeContainerRef}
          className="absolute top-3.5 left-3.5 right-15 flex items-center gap-1.5 z-10 overflow-hidden flex-nowrap pointer-events-none"
        >
          {/* Main Category */}
          <span className="bg-white/95 text-stone-900 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs shrink-0 pointer-events-auto">
            {recipe.category}
          </span>

          {/* Optional Source Badge (Foto/PDF) */}
          {getSourceBadge()}

          {/* Subcategories (displayed as many as fit on this single row) */}
          {visibleSubcategories.map((subcat) => (
            <span
              key={subcat}
              className="bg-black/55 backdrop-blur-md text-white text-[11px] font-medium px-2.5 py-1 rounded-full border border-white/15 shadow-xs shrink-0 whitespace-nowrap pointer-events-auto"
            >
              {subcat}
            </span>
          ))}

          {/* +N Badge for Overflow Subcategories */}
          {hiddenCount > 0 && (
            <span
              title={`Fler kategorier: ${hiddenSubcategories.join(', ')}`}
              aria-label={`Fler kategorier: ${hiddenSubcategories.join(', ')}`}
              className="bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-full border border-white/25 shadow-xs shrink-0 whitespace-nowrap pointer-events-auto cursor-default"
            >
              +{hiddenCount}
            </span>
          )}
        </div>

        {/* Favorite Heart Button */}
        <button
          type="button"
          onClick={handleHeartClick}
          className="absolute top-3.5 right-3.5 w-10 h-10 rounded-full bg-white/95 flex items-center justify-center text-stone-700 hover:text-rose-600 transition-all duration-150 active:scale-125 shadow-xs touch-manipulation z-10"
          aria-label={recipe.isFavorite ? 'Ta bort favorit' : 'Lägg till som favorit'}
        >
          <Heart
            className={`w-4 h-4 transition-colors duration-200 ${
              recipe.isFavorite
                ? 'fill-rose-500 text-rose-500 scale-110'
                : 'text-stone-700'
            }`}
          />
        </button>

        {/* Bottom Content: Title, Time & Rating directly over image */}
        <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 pr-15 sm:pr-16 flex flex-col justify-end z-10">
          <h3 className="font-serif text-base sm:text-lg md:text-xl font-bold text-white leading-snug tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] line-clamp-2 group-hover:text-emerald-100 transition-colors">
            {recipe.title}
          </h3>

          <div className="mt-2 flex items-center gap-2 text-white/95 text-xs font-semibold flex-wrap">
            {/* Cooking time */}
            <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full border border-white/20 shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-stone-200" />
              <span>{formatCookingTime(recipe.prepTimeMinutes, recipe.cookTimeMinutes)}</span>
            </div>

            {/* Rating or New badge */}
            {recipe.rating > 0 ? (
              <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full border border-white/20 shadow-2xs">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="text-amber-300 font-bold">{recipe.rating}.0</span>
              </div>
            ) : isRecipeNew(recipe) ? (
              <div className="bg-black/60 px-2.5 py-1 rounded-full border border-white/20 shadow-2xs">
                <span className="text-emerald-300 font-semibold text-xs">Ny</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Add to Shopping List Button (Bottom Right Corner) */}
        <button
          type="button"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleShoppingClick}
          className={`absolute bottom-3.5 right-3.5 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 active:scale-125 shadow-md touch-manipulation z-20 ${
            addedToCart
              ? 'bg-emerald-600 text-white'
              : isInShoppingList
              ? 'bg-white/95 text-emerald-700 hover:text-emerald-800'
              : 'bg-white/95 text-stone-700 hover:text-[#284235] hover:bg-white'
          }`}
          aria-label={
            addedToCart
              ? 'Receptet tillagt i inköpslistan'
              : isInShoppingList
              ? 'Receptet finns i inköpslistan (klicka för att lägga till igen)'
              : 'Lägg till receptet i inköpslistan'
          }
          title={
            isInShoppingList
              ? 'Finns i inköpslistan (klicka för att lägga till igen)'
              : 'Lägg till i inköpslistan'
          }
        >
          {addedToCart ? (
            <Check className="w-4 h-4 text-white stroke-[2.5]" />
          ) : (
            <ShoppingCart
              className={`w-4 h-4 transition-colors ${
                isInShoppingList ? 'text-emerald-600 stroke-[2.2]' : ''
              }`}
            />
          )}
          {isInShoppingList && !addedToCart && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
          )}
        </button>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.recipe.id === nextProps.recipe.id &&
      prevProps.recipe.isFavorite === nextProps.recipe.isFavorite &&
      prevProps.recipe.rating === nextProps.recipe.rating &&
      prevProps.recipe.title === nextProps.recipe.title &&
      prevProps.recipe.coverImageUrl === nextProps.recipe.coverImageUrl &&
      prevProps.recipe.notes === nextProps.recipe.notes &&
      prevProps.recipe.category === nextProps.recipe.category &&
      prevProps.recipe.subcategory === nextProps.recipe.subcategory &&
      prevProps.recipe.subcategories === nextProps.recipe.subcategories &&
      prevProps.recipe.cookTimeMinutes === nextProps.recipe.cookTimeMinutes &&
      prevProps.recipe.updatedAt === nextProps.recipe.updatedAt &&
      prevProps.onClick === nextProps.onClick &&
      prevProps.onToggleFavorite === nextProps.onToggleFavorite &&
      prevProps.onShareRecipe === nextProps.onShareRecipe &&
      prevProps.onAddToShoppingList === nextProps.onAddToShoppingList &&
      prevProps.isInShoppingList === nextProps.isInShoppingList
    );
  }
);
RecipeCard.displayName = 'RecipeCard';
