import React, { useLayoutEffect, useRef, useState } from 'react';
import type { RecipeCategory, RecipeDifficulty } from '../../types/recipe';
import { Camera, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { DifficultyPicker } from './DifficultyPicker';
import { SubcategorySelector } from './SubcategorySelector';
import { STANDARD_CATEGORIES } from '../../data/categories';

/** A text box that grows with its text, so there is no scrolling inside the scrolling form. */
export const AutoGrowTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }
>(({ minRows = 2, className = '', value, ...rest }, forwardedRef) => {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      {...rest}
      value={value}
      rows={minRows}
      ref={(el) => {
        innerRef.current = el;
        if (typeof forwardedRef === 'function') forwardedRef(el);
        else if (forwardedRef) forwardedRef.current = el;
      }}
      className={`resize-none overflow-hidden ${className}`}
    />
  );
});
AutoGrowTextarea.displayName = 'AutoGrowTextarea';

export interface RecipeFormValues {
  title: string;
  category: RecipeCategory;
  subcategories: string[];
  servings: number | string;
  cookingTimeMinutes: number | string;
  difficulty: RecipeDifficulty | undefined;
  coverImageUrl: string;
  notes: string;
  ingredientsText: string;
  instructionsText: string;
}

interface RecipeFormFieldsProps {
  values: RecipeFormValues;
  setTitle: (v: string) => void;
  setCategory: (v: RecipeCategory) => void;
  setSubcategories: (v: string[]) => void;
  setServings: (v: number | string) => void;
  setCookingTimeMinutes: (v: number | string) => void;
  setDifficulty: (v: RecipeDifficulty | undefined) => void;
  setCoverImageUrl: (v: string) => void;
  setNotes: (v: string) => void;
  setIngredientsText: (v: string) => void;
  setInstructionsText: (v: string) => void;
  handleCoverImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isImageUploading: boolean;
  ingredientCount: number;
  stepCount: number;
  /** Prefix for the field ids, so the add and edit forms do not share ids */
  idPrefix: string;
  /** Portions to fall back to when the field is left empty */
  defaultServings: number;
}

/**
 * The fields of a recipe: name, picture, category, subcategories, portions, time,
 * difficulty, ingredients, steps and notes. Used by both Lägg till recept and Redigera recept.
 */
export const RecipeFormFields: React.FC<RecipeFormFieldsProps> = ({
  values,
  setTitle,
  setCategory,
  setSubcategories,
  setServings,
  setCookingTimeMinutes,
  setDifficulty,
  setCoverImageUrl,
  setNotes,
  setIngredientsText,
  setInstructionsText,
  handleCoverImageUpload,
  isImageUploading,
  ingredientCount,
  stepCount,
  idPrefix,
  defaultServings,
}) => {
  const { title, category, subcategories, servings, cookingTimeMinutes, difficulty, coverImageUrl, notes, ingredientsText, instructionsText } = values;
  const [showImageUrl, setShowImageUrl] = useState<boolean>(false);
  const field = 'w-full bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl px-3.5 text-base sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]';
  const label = 'font-bold text-stone-800 block mb-1 text-xs';
  const parsedIngredients = { length: ingredientCount };
  const parsedInstructions = { length: stepCount };

  return (
    <>
          <div>
            <label className={label} htmlFor={`${idPrefix}-title`}>Receptnamn</label>
            <input
              id={`${idPrefix}-title`}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="T.ex. Krämig laxpasta"
              className={`${field} h-11`}
            />
          </div>

          {/* Picture */}
          <div>
            <span className={label}>Bild</span>
            {coverImageUrl ? (
              <div className="relative aspect-16/9 rounded-2xl overflow-hidden bg-stone-900">
                <img src={coverImageUrl} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end justify-between p-3">
                  <label className="px-3.5 min-h-[40px] bg-white/95 hover:bg-white text-stone-900 rounded-xl font-semibold text-xs cursor-pointer flex items-center gap-1.5 touch-manipulation">
                    <Camera className="w-4 h-4" />
                    Byt bild
                    <input type="file" accept="image/*" className="hidden" onChange={handleCoverImageUpload} />
                  </label>
                  <button
                    type="button"
                    onClick={() => setCoverImageUrl('')}
                    className="w-10 h-10 rounded-xl bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center touch-manipulation"
                    aria-label="Ta bort bild"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {isImageUploading && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white gap-2">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-xs font-semibold">Laddar upp bilden</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center justify-center gap-2 min-h-[48px] bg-[#FCFAF5] hover:bg-stone-100 border border-[#EBE7DF] rounded-2xl cursor-pointer font-semibold text-stone-900 touch-manipulation">
                  <Camera className="w-4 h-4" />
                  Ta foto
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCoverImageUpload} />
                </label>
                <label className="flex items-center justify-center gap-2 min-h-[48px] bg-[#FCFAF5] hover:bg-stone-100 border border-[#EBE7DF] rounded-2xl cursor-pointer font-semibold text-stone-900 touch-manipulation">
                  <ImagePlus className="w-4 h-4" />
                  Välj bild
                  <input type="file" accept="image/*" className="hidden" onChange={handleCoverImageUpload} />
                </label>
              </div>
            )}
            {showImageUrl ? (
              <input
                type="url"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://"
                aria-label="Bildens webbadress"
                className={`${field} h-10 mt-2 text-xs`}
              />
            ) : (
              <button type="button" onClick={() => setShowImageUrl(true)} className="mt-1 text-xs font-semibold text-[#284235] min-h-[36px] touch-manipulation">
                Använd bild från webben
              </button>
            )}
          </div>

          {/* Category */}
          <div>
            <span className={label}>Kategori</span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Kategori">
              {STANDARD_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={category === cat}
                  onClick={() => setCategory(cat as RecipeCategory)}
                  className={`px-3 min-h-[36px] rounded-xl text-xs font-semibold touch-manipulation ${
                    category === cat ? 'bg-[#284235] text-white' : 'bg-white border border-[#EBE7DF] text-stone-700 hover:bg-[#FCFAF5]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <SubcategorySelector category={category} values={subcategories} onChange={setSubcategories} />

          {/* Servings & time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor={`${idPrefix}-servings`}>Portioner</label>
              <input
                id={`${idPrefix}-servings`}
                type="number"
                inputMode="numeric"
                min={1}
                max={24}
                value={servings}
                onChange={(e) => setServings(e.target.value === '' ? '' : parseInt(e.target.value, 10) || '')}
                onBlur={() => {
                  if (servings === '' || Number(servings) < 1) setServings(defaultServings);
                }}
                className={`${field} h-11 text-center`}
              />
            </div>
            <div>
              <label className={label} htmlFor={`${idPrefix}-time`}>Tillagningstid, min</label>
              <input
                id={`${idPrefix}-time`}
                type="number"
                inputMode="numeric"
                min={0}
                value={cookingTimeMinutes}
                onChange={(e) => setCookingTimeMinutes(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
                onBlur={() => {
                  if (cookingTimeMinutes === '') setCookingTimeMinutes(0);
                }}
                className={`${field} h-11 text-center`}
              />
            </div>
          </div>

          <DifficultyPicker value={difficulty} onChange={setDifficulty} />

          {/* Ingredients */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="font-serif font-bold text-stone-900 text-sm" htmlFor={`${idPrefix}-ingredients`}>
                Ingredienser {parsedIngredients.length > 0 ? `(${parsedIngredients.length})` : ''}
              </label>
              <span className="text-xs text-stone-500">En per rad</span>
            </div>
            <AutoGrowTextarea
              id={`${idPrefix}-ingredients`}
              minRows={4}
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.target.value)}
              placeholder={'400 g spaghetti\n200 g guanciale\n4 äggulor'}
              className={`${field} py-3 leading-relaxed`}
            />
          </div>

          {/* Steps: one per line */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="font-serif font-bold text-stone-900 text-sm" htmlFor={`${idPrefix}-steps`}>
                Steg {parsedInstructions.length > 0 ? `(${parsedInstructions.length})` : ''}
              </label>
              <span className="text-xs text-stone-500">Ett per rad</span>
            </div>
            <AutoGrowTextarea
              id={`${idPrefix}-steps`}
              minRows={4}
              value={instructionsText}
              onChange={(e) => setInstructionsText(e.target.value)}
              placeholder={'Koka pastan i saltat vatten\nStek fläsket knaprigt\nVispa äggulor och ost'}
              className={`${field} py-3 leading-relaxed`}
            />
          </div>

          {/* Notes */}
          <div>
            <label className={label} htmlFor={`${idPrefix}-notes`}>Anteckningar</label>
            <AutoGrowTextarea
              id={`${idPrefix}-notes`}
              minRows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="T.ex. dubbla vitlöken"
              className={`${field} py-2.5 leading-relaxed`}
            />
          </div>

    </>
  );
};
