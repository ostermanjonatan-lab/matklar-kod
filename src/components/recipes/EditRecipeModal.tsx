import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import type { Recipe, Instruction, Ingredient, RecipeCategory, RecipeDifficulty } from '../../types/recipe';
import { DifficultyPicker } from './DifficultyPicker';
import { getRecipeSubcategories } from '../../types/recipe';
import { useRecipes } from '../../context/RecipeContext';
import { X, Trash2, Camera, ImagePlus, Loader2, Check } from 'lucide-react';
import { parseIngredientsText } from '../../utils/ingredientParser';
import { uploadRecipePhoto } from '../../utils/imageService';
import { cleanLeadingStepNumber, formatIngredientsToText } from '../../utils/formatters';
import { SubcategorySelector } from './SubcategorySelector';
import { STANDARD_CATEGORIES } from '../../data/categories';

interface EditRecipeModalProps {
  recipe: Recipe;
  onClose: () => void;
  onDeleted?: () => void;
  /**
   * Set by the modal: call it when the view wants to close (for example the phone's back
   * button). It returns true when the modal stays open to ask about unsaved changes.
   */
  closeGuardRef?: React.MutableRefObject<(() => boolean) | null>;
}

/** A text box that grows with its text, so there is no scrolling inside the scrolling form. */
const AutoGrowTextarea = React.forwardRef<
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

export const EditRecipeModal: React.FC<EditRecipeModalProps> = ({
  recipe,
  onClose,
  onDeleted,
  closeGuardRef,
}) => {
  const { updateRecipe, deleteRecipe } = useRecipes();

  // Form Fields initialized from recipe
  const [title, setTitle] = useState(recipe.title);
  const [category, setCategory] = useState<RecipeCategory>(recipe.category || 'Middag');
  const [subcategories, setSubcategories] = useState<string[]>(() => getRecipeSubcategories(recipe));
  const [servings, setServings] = useState<number | string>(recipe.servings || 4);
  const [difficulty, setDifficulty] = useState<RecipeDifficulty | undefined>(recipe.difficulty);
  const [cookingTimeMinutes, setCookingTimeMinutes] = useState<number | string>(() =>
    Number(recipe.cookTimeMinutes) > 0
      ? Number(recipe.cookTimeMinutes)
      : (Number(recipe.prepTimeMinutes) || 30)
  );
  const [coverImageUrl, setCoverImageUrl] = useState(recipe.coverImageUrl || '');
  const [notes, setNotes] = useState(recipe.notes || '');

  const [ingredientsText, setIngredientsText] = useState<string>(() =>
    recipe.ingredients && recipe.ingredients.length > 0
      ? formatIngredientsToText(recipe.ingredients)
      : ''
  );

  // One step per line in a single text box
  const [instructionsText, setInstructionsText] = useState<string>(() =>
    recipe.instructions && recipe.instructions.length > 0 ? recipe.instructions.map((inst) => inst.text).join('\n') : ''
  );

  const [showImageUrl, setShowImageUrl] = useState<boolean>(false);
  const [showDiscardPrompt, setShowDiscardPrompt] = useState<boolean>(false);

  // Image Upload State
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Delete Confirmation Dialog State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Phone Photo Upload Handler
  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImageUploading(true);
    try {
      const uploadedUrl = await uploadRecipePhoto(file);
      setCoverImageUrl(uploadedUrl);
      setToastMessage('Bilden är bytt');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Image upload failed:', err);
      setToastMessage('Bilden gick inte att ladda upp');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsImageUploading(false);
    }
  };

  // Parse newline-separated ingredients into structured Ingredient objects
  const parsedIngredients: Ingredient[] = useMemo(() => {
    return parseIngredientsText(ingredientsText);
  }, [ingredientsText]);

  // Parse newline-separated instructions into Instruction objects
  const parsedInstructions: Instruction[] = useMemo(() => {
    return instructionsText
      .split('\n')
      .map((line) => cleanLeadingStepNumber(line))
      .filter((line) => line.length > 0)
      .map((text, idx) => ({
        stepNumber: idx + 1,
        text,
      }));
  }, [instructionsText]);

  // Unsaved changes: compare with how the form looked when it opened
  const snapshot = () =>
    JSON.stringify([title, category, subcategories, servings, difficulty, cookingTimeMinutes, coverImageUrl, notes, ingredientsText, instructionsText]);
  const initialSnapshotRef = useRef<string | null>(null);
  if (initialSnapshotRef.current === null) initialSnapshotRef.current = snapshot();
  const isDirty = snapshot() !== initialSnapshotRef.current;

  // Close, but ask first when something has changed. Returns true when it stays open.
  const requestClose = (): boolean => {
    if (isDirty) {
      setShowDiscardPrompt(true);
      return true;
    }
    onClose();
    return false;
  };
  useEffect(() => {
    if (closeGuardRef) closeGuardRef.current = requestClose;
  });

  // Submit Form
  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) return;

    const updatedRecipe: Recipe = {
      ...recipe,
      title: title.trim(),
      description: '',
      coverImageUrl:
        coverImageUrl.trim() ||
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80',
      recipeDocumentUrl: recipe.recipeDocumentUrl,
      servings: Number(servings) || 4,
      category,
      subcategory: subcategories.join(', ') || 'Hemlagat',
      subcategories: subcategories.length > 0 ? subcategories : ['Hemlagat'],
      notes: notes.trim(),
      ingredients: parsedIngredients,
      instructions: parsedInstructions,
      prepTimeMinutes: 0,
      cookTimeMinutes: Number(cookingTimeMinutes) >= 0 ? Number(cookingTimeMinutes) : 0,
      difficulty,
    };

    updateRecipe(updatedRecipe);
    onClose();
  };

  const handleDelete = () => {
    deleteRecipe(recipe.id);
    setShowDeleteConfirm(false);
    onClose();
    onDeleted?.();
  };

  const field = 'w-full bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl px-3.5 text-base sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]';
  const label = 'font-bold text-stone-800 block mb-1 text-xs';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in font-sans overflow-x-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        className="relative bg-white w-full max-w-md sm:max-w-xl md:max-w-2xl rounded-t-3xl rounded-b-none sm:rounded-3xl shadow-2xl flex flex-col h-[calc(100dvh-0.75rem)] sm:h-auto sm:max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-[#EBE7DF] flex items-center justify-between shrink-0">
          <h2 className="font-serif text-lg font-bold text-stone-900 leading-tight">Redigera recept</h2>
          <button
            type="button"
            onClick={() => requestClose()}
            className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-100 touch-manipulation"
            aria-label="Stäng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {toastMessage && (
          <div className="bg-stone-900 text-white px-5 py-2.5 text-sm flex items-center gap-2 animate-fade-in shrink-0">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Form */}
        <form id="edit-recipe-form" onSubmit={handleSubmit} className="px-5 pt-4 pb-6 space-y-5 overflow-y-auto overflow-x-hidden flex-1 text-xs min-w-0">
          <div>
            <label className={label} htmlFor="edit-title">Receptnamn</label>
            <input
              id="edit-title"
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
              <label className={label} htmlFor="edit-servings">Portioner</label>
              <input
                id="edit-servings"
                type="number"
                inputMode="numeric"
                min={1}
                max={24}
                value={servings}
                onChange={(e) => setServings(e.target.value === '' ? '' : parseInt(e.target.value, 10) || '')}
                onBlur={() => {
                  if (servings === '' || Number(servings) < 1) setServings(recipe.servings || 4);
                }}
                className={`${field} h-11 text-center`}
              />
            </div>
            <div>
              <label className={label} htmlFor="edit-time">Tillagningstid, min</label>
              <input
                id="edit-time"
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
              <label className="font-serif font-bold text-stone-900 text-sm" htmlFor="edit-ingredients">
                Ingredienser {parsedIngredients.length > 0 ? `(${parsedIngredients.length})` : ''}
              </label>
              <span className="text-xs text-stone-500">En per rad</span>
            </div>
            <AutoGrowTextarea
              id="edit-ingredients"
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
              <label className="font-serif font-bold text-stone-900 text-sm" htmlFor="edit-steps">
                Steg {parsedInstructions.length > 0 ? `(${parsedInstructions.length})` : ''}
              </label>
              <span className="text-xs text-stone-500">Ett per rad</span>
            </div>
            <AutoGrowTextarea
              id="edit-steps"
              minRows={4}
              value={instructionsText}
              onChange={(e) => setInstructionsText(e.target.value)}
              placeholder={'Koka pastan i saltat vatten\nStek fläsket knaprigt\nVispa äggulor och ost'}
              className={`${field} py-3 leading-relaxed`}
            />
          </div>

          {/* Notes */}
          <div>
            <label className={label} htmlFor="edit-notes">Anteckningar</label>
            <AutoGrowTextarea
              id="edit-notes"
              minRows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="T.ex. dubbla vitlöken"
              className={`${field} py-2.5 leading-relaxed`}
            />
          </div>

          {/* Delete, away from Spara */}
          <div className="pt-4 border-t border-[#EBE7DF]">
            {showDeleteConfirm ? (
              <div className="space-y-2.5">
                <p className="text-sm text-stone-700">Receptet tas bort för hela hushållet. Det går inte att ångra.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowDeleteConfirm(false)} className="flex-1 min-h-[44px] rounded-xl bg-stone-100 text-stone-700 text-sm font-semibold touch-manipulation">
                    Avbryt
                  </button>
                  <button type="button" onClick={handleDelete} className="flex-1 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold touch-manipulation">
                    Ta bort receptet
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setShowDeleteConfirm(true)} className="text-sm text-rose-700 font-semibold min-h-[44px] touch-manipulation">
                Ta bort recept
              </button>
            )}
          </div>
        </form>

        {/* Spara, always in view */}
        <div className="px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-[#EBE7DF] bg-white shrink-0">
          <button
            type="submit"
            form="edit-recipe-form"
            disabled={!title.trim()}
            className="w-full min-h-[50px] bg-[#284235] hover:bg-black disabled:opacity-40 text-white font-semibold text-sm rounded-2xl touch-manipulation flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Spara ändringar
          </button>
        </div>

        {/* Unsaved changes */}
        {showDiscardPrompt && (
          <div className="absolute inset-0 z-10 bg-black/40 flex items-end sm:items-center justify-center animate-fade-in" onClick={() => setShowDiscardPrompt(false)}>
            <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-3" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-serif text-lg font-bold text-stone-900">Spara ändringarna?</h3>
              <p className="text-sm text-stone-600">Du har ändrat receptet men inte sparat.</p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscardPrompt(false);
                    onClose();
                  }}
                  className="flex-1 min-h-[46px] rounded-xl bg-stone-100 text-rose-700 text-sm font-semibold touch-manipulation"
                >
                  Släng ändringar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscardPrompt(false);
                    handleSubmit();
                  }}
                  disabled={!title.trim()}
                  className="flex-1 min-h-[46px] rounded-xl bg-[#284235] text-white text-sm font-semibold disabled:opacity-40 touch-manipulation"
                >
                  Spara
                </button>
              </div>
              <button type="button" onClick={() => setShowDiscardPrompt(false)} className="w-full min-h-[40px] text-sm text-stone-600 touch-manipulation">
                Fortsätt ändra
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
