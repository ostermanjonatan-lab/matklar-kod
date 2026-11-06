import React, { useState, useRef } from 'react';
import { categoryLabel } from '../../data/categories';
import { DIFFICULTY_LABELS } from '../../utils/recipeDifficulty';
import type { Recipe } from '../../types/recipe';
import { isRecipeNew } from '../../types/recipe';
import { useRecipes } from '../../context/RecipeContext';
import { Heart, Check, ShoppingCart } from 'lucide-react';
import { formatCookingTime, formatRecipeTitle } from '../../utils/formatters';

interface RecipeCardProps {
  recipe: Recipe;
  onClick: (recipe: Recipe) => void;
  onToggleFavorite?: (id: string) => void;
  onShareRecipe?: (recipe: Recipe) => void;
  /** Returns false if the recipe wasn't added right away, e.g. while a question is shown. */
  onAddToShoppingList?: (recipe: Recipe) => boolean;
  isInShoppingList?: boolean;
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

    return (
      <div
        onClick={handleCardClick}
        style={{ contentVisibility: 'auto', containIntrinsicSize: '300px' }}
        className="group relative aspect-[16/11] md:aspect-[4/5] w-full rounded-2xl overflow-hidden cursor-pointer active:scale-[0.985] transition-transform bg-stone-900"
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
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/75 via-black/30 via-45% to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/25 to-transparent pointer-events-none" />

        {/* Favorite: a plain white heart on the photo */}
        <button
          type="button"
          onClick={handleHeartClick}
          className="absolute top-1.5 right-1.5 w-11 h-11 flex items-center justify-center text-white active:scale-110 transition-transform touch-manipulation z-10 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
          aria-label={recipe.isFavorite ? 'Ta bort favorit' : 'Lägg till som favorit'}
        >
          <Heart className={`w-5 h-5 ${recipe.isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>

        {/* Name, and below it one line: category · time · difficulty · source · new */}
        <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 pr-14 sm:pr-16 flex flex-col justify-end z-10">
          <h3 className="font-serif text-lg md:text-xl font-bold text-white leading-snug tracking-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] line-clamp-2">
            {formatRecipeTitle(recipe.title)}
          </h3>
          <p className="mt-1 text-[13px] text-white/85 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] truncate">
            {[
              categoryLabel(recipe.category),
              formatCookingTime(recipe.prepTimeMinutes, recipe.cookTimeMinutes),
              recipe.difficulty ? DIFFICULTY_LABELS[recipe.difficulty] : '',
              recipe.sourceType === 'recipe_image' ? 'Foto' : recipe.sourceType === 'pdf' || recipe.recipeDocumentUrl ? 'PDF' : '',
            ]
              .filter(Boolean)
              .join(' · ')}
            {isRecipeNew(recipe) && <span className="text-emerald-200"> · Ny</span>}
          </p>
        </div>

        {/* Add to the shopping list: a plain white cart, a dot when it is already there */}
        <button
          type="button"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleShoppingClick}
          className="absolute bottom-2 right-2 w-11 h-11 flex items-center justify-center text-white active:scale-110 transition-transform touch-manipulation z-20 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
          aria-label={
            addedToCart
              ? 'Receptet tillagt i inköpslistan'
              : isInShoppingList
              ? 'Receptet finns i inköpslistan, tryck för att lägga till igen'
              : 'Lägg till receptet i inköpslistan'
          }
        >
          {addedToCart ? <Check className="w-5 h-5 stroke-[2.5]" /> : <ShoppingCart className="w-5 h-5" />}
          {isInShoppingList && !addedToCart && (
            <span className="absolute top-2 right-1.5 w-2 h-2 bg-emerald-400 rounded-full" />
          )}
        </button>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.recipe.id === nextProps.recipe.id &&
      prevProps.recipe.isFavorite === nextProps.recipe.isFavorite &&
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
