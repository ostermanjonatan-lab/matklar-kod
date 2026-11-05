import React, { useState, useEffect, useMemo } from 'react';
import type { Recipe } from '../../types/recipe';
import { getRecipeSubcategories } from '../../types/recipe';
import { STANDARD_CATEGORIES } from '../../data/categories';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import { ArrowLeft, X, Layers } from 'lucide-react';

interface ChooseMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: Recipe[];
  onSelectCategory: (category: string, subcategory?: string) => void;
}

interface SlideshowButtonProps {
  images: string[];
  title: string;
  subtitle?: string;
  badgeText: string;
  onClick: () => void;
  className?: string;
}

/**
 * Renders a card with an independent, asynchronous background slideshow of recipe photos.
 * Uses smooth CSS opacity crossfade and randomized timers so cards transition organically in desync.
 */
const SlideshowButton: React.FC<SlideshowButtonProps> = ({
  images,
  title,
  subtitle,
  badgeText,
  onClick,
  className = 'h-28',
}) => {
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const validImages = useMemo(
    () => images.filter((img) => typeof img === 'string' && img.trim().length > 0),
    [images]
  );

  useEffect(() => {
    if (validImages.length <= 1) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = () => {
      // Randomized duration between 2.2s and 4.5s per button
      const duration = 2200 + Math.random() * 2300;
      timeoutId = setTimeout(() => {
        setActiveIdx((prev) => (prev + 1) % validImages.length);
        scheduleNext();
      }, duration);
    };

    // Staggered initial offset between 0ms and 1500ms
    const initialStagger = Math.random() * 1500;
    timeoutId = setTimeout(scheduleNext, initialStagger);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [validImages]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full rounded-2xl overflow-hidden border border-black/10 text-left shadow-2xs group active:scale-[0.98] transition-all touch-manipulation cursor-pointer ${className}`}
    >
      {/* Background Images */}
      <div className="absolute inset-0 bg-stone-900">
        {validImages.length > 0 ? (
          validImages.map((img, idx) => (
            <img
              key={`${img}-${idx}`}
              src={img}
              alt=""
              loading="lazy"
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
                idx === activeIdx ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            />
          ))
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#284235] to-[#12241B]" />
        )}
      </div>

      {/* Dark Vignette Overlay for High Contrast Text */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/25 group-hover:from-black/80 transition-colors" />

      {/* Foreground Content */}
      <div className="relative z-10 h-full p-3.5 flex flex-col justify-between text-white">
        <div className="flex items-center justify-end">
          <span className="text-[10px] font-bold bg-white/20 backdrop-blur-xs px-2.5 py-0.5 rounded-full border border-white/20">
            {badgeText}
          </span>
        </div>

        <div>
          <h4 className="font-serif text-lg font-bold text-white leading-tight">
            {title}
          </h4>
          {subtitle && (
            <p className="text-xs text-white/80 line-clamp-1 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </button>
  );
};

export const ChooseMealModal: React.FC<ChooseMealModalProps> = ({
  isOpen,
  onClose,
  recipes,
  onSelectCategory,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('Middag');

  // Handle Android back button:
  // Step 1: back closes modal
  useModalBackHandler(isOpen, onClose, 'choose-meal-modal');
  // Step 2: back returns to Step 1
  useModalBackHandler(isOpen && step === 2, () => setStep(1), 'choose-meal-step-2');

  // Reset to Step 1 when modal is opened
  useEffect(() => {
    if (isOpen) {
      setStep(1);
    }
  }, [isOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Keyboard navigation (Escape key)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (step === 2) {
          setStep(1);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step, onClose]);

  // Aggregate main categories with recipe counts and images
  const mainCategoriesData = useMemo(() => {
    // Collect all unique categories from STANDARD_CATEGORIES and any custom user categories
    const catSet = new Set<string>();
    STANDARD_CATEGORIES.forEach((c) => catSet.add(c));
    recipes.forEach((r) => {
      if (r.category) catSet.add(r.category);
    });

    return Array.from(catSet)
      .map((catName) => {
        const catRecipes = recipes.filter(
          (r) => (r.category || '').toLowerCase() === catName.toLowerCase()
        );
        const images = catRecipes
          .map((r) => r.coverImageUrl)
          .filter((url): url is string => Boolean(url && url.trim().length > 0));

        // Create teaser of prominent subcategories or top recipe names
        const subcatNames = new Set<string>();
        catRecipes.forEach((r) => {
          getRecipeSubcategories(r).forEach((s) => subcatNames.add(s));
        });
        const subcatTeaser =
          subcatNames.size > 0
            ? Array.from(subcatNames).slice(0, 4).join(', ')
            : 'Se alla recept';

        return {
          name: catName,
          count: catRecipes.length,
          images,
          subtitle: subcatTeaser,
        };
      })
      .filter((cat) => cat.count > 0); // Only show categories with available recipes
  }, [recipes]);

  // Aggregate subcategories for the selected main category
  const subcategoriesData = useMemo(() => {
    const matchingRecipes = recipes.filter(
      (r) => (r.category || '').toLowerCase() === selectedMainCategory.toLowerCase()
    );

    const subcatMap = new Map<string, { count: number; images: string[] }>();

    matchingRecipes.forEach((recipe) => {
      const subcats = getRecipeSubcategories(recipe);
      subcats.forEach((subcat) => {
        const current = subcatMap.get(subcat) || { count: 0, images: [] };
        current.count += 1;
        if (recipe.coverImageUrl && recipe.coverImageUrl.trim().length > 0) {
          current.images.push(recipe.coverImageUrl);
        }
        subcatMap.set(subcat, current);
      });
    });

    return Array.from(subcatMap.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        images: data.images,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'sv'));
  }, [recipes, selectedMainCategory]);

  if (!isOpen) return null;

  const totalRecipesInSelectedMain = recipes.filter(
    (r) => (r.category || '').toLowerCase() === selectedMainCategory.toLowerCase()
  ).length;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in font-sans"
    >
      <div className="bg-[#FCFAF5] w-full max-w-md sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#E8E4DC] overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] transition-all">
        {/* Header */}
        <div className="bg-white px-5 py-4 border-b border-[#EBE7DF] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 transition-colors touch-manipulation cursor-pointer"
                aria-label="Tillbaka till huvudkategorier"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
            <div>
              <span className="text-xs font-semibold text-stone-400">
                {step === 1 ? 'Steg 1 av 2' : 'Steg 2 av 2'}
              </span>
              <h2 className="font-serif text-lg font-bold text-stone-900 leading-tight">
                {step === 1 ? 'Välj måltid' : selectedMainCategory}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 hover:text-stone-800 transition-colors touch-manipulation cursor-pointer"
            aria-label="Stäng"
          >
            <X className="w-4 h-4 stroke-[2]" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto no-scrollbar space-y-4 flex-1">
          {/* STEP 1: Main Category Selection */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs text-stone-500 font-medium">
                Vilken typ av måltid vill du laga?
              </p>

              {mainCategoriesData.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {mainCategoriesData.map((cat) => (
                    <SlideshowButton
                      key={cat.name}
                      title={cat.name}
                      subtitle={cat.subtitle}
                      badgeText={`${cat.count} recept`}
                      images={cat.images}
                      className="h-28"
                      onClick={() => {
                        setSelectedMainCategory(cat.name);
                        setStep(2);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-8 border border-[#E8E4DC] text-center space-y-2">
                  <p className="text-stone-800 font-semibold text-sm">
                    Inga kategoriserade recept hittades
                  </p>
                  <p className="text-xs text-stone-500">
                    Lägg till recept eller tilldela kategorier för att välja måltid här.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Subcategory Selection */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-white border border-[#E8E4DC] rounded-2xl p-3 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-stone-500 font-medium">Valt:</span>
                  <strong className="text-stone-900 text-sm font-bold">
                    {selectedMainCategory}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-[#284235] hover:underline font-bold flex items-center gap-1 touch-manipulation cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Byt måltid</span>
                </button>
              </div>

              <p className="text-xs text-stone-500 font-medium">
                Vad är ni sugna på?
              </p>

              {/* Subcategories 2-column Grid */}
              {subcategoriesData.length > 0 ? (
                <div className="grid grid-cols-2 gap-2.5">
                  {subcategoriesData.map((subcat) => (
                    <SlideshowButton
                      key={subcat.name}
                      title={subcat.name}
                      badgeText={`${subcat.count} st`}
                      images={subcat.images}
                      className="h-32"
                      onClick={() => {
                        onSelectCategory(selectedMainCategory, subcat.name);
                        onClose();
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-6 border border-[#E8E4DC] text-center">
                  <p className="text-xs text-stone-500">
                    Inga underkategorier hittades för denna kategori.
                  </p>
                </div>
              )}

              {/* Action: View all recipes within this main category */}
              <div className="pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => {
                    onSelectCategory(selectedMainCategory);
                    onClose();
                  }}
                  className="w-full py-3 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors touch-manipulation cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-stone-500" />
                  <span>
                    Se alla {totalRecipesInSelectedMain} recept inom {selectedMainCategory}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
