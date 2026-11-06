import React, { useState, useMemo } from 'react';
import type { Recipe, Instruction, Ingredient, RecipeCategory, RecipeDifficulty } from '../../types/recipe';
import { DifficultyPicker } from './DifficultyPicker';
import { getRecipeSubcategories } from '../../types/recipe';
import { useRecipes } from '../../context/RecipeContext';
import {
  X,
  Trash2,
  Camera,
  ImagePlus,
  Loader2,
  AlertTriangle,
  Check,
  Lightbulb
} from 'lucide-react';
import { parseIngredientsText } from '../../utils/ingredientParser';
import { uploadRecipePhoto } from '../../utils/imageService';
import { cleanLeadingStepNumber, formatIngredientsToText } from '../../utils/formatters';
import { SubcategorySelector } from './SubcategorySelector';
import { STANDARD_CATEGORIES } from '../../data/categories';

interface EditRecipeModalProps {
  recipe: Recipe;
  onClose: () => void;
  onDeleted?: () => void;
}

export const EditRecipeModal: React.FC<EditRecipeModalProps> = ({
  recipe,
  onClose,
  onDeleted,
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

  const [instructionsText, setInstructionsText] = useState<string>(() =>
    recipe.instructions && recipe.instructions.length > 0
      ? recipe.instructions.map((inst) => inst.text).join('\n')
      : ''
  );

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
      setToastMessage('Foto inlagt från telefonen!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Image upload failed:', err);
      setToastMessage('Kunde inte ladda upp bilden.');
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

  // Submit Form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in font-sans overflow-x-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white w-full max-w-md sm:max-w-xl md:max-w-2xl rounded-t-3xl rounded-b-none sm:rounded-3xl shadow-2xl flex flex-col h-[calc(100dvh-0.75rem)] sm:h-auto sm:max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#FCFAF5] border-b border-[#EBE7DF] flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-serif text-lg font-bold text-stone-900 leading-tight">Redigera recept</h2>
            <p className="text-xs text-stone-500">Ändra ingredienser, tider eller foto</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border border-[#EBE7DF] flex items-center justify-center text-stone-600 hover:text-black touch-manipulation shadow-xs"
            aria-label="Stäng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toast / Notification */}
        {toastMessage && (
          <div className="bg-emerald-900 text-white px-4 py-3 text-xs font-semibold flex items-center gap-2 animate-fade-in border-b border-emerald-800 shrink-0">
            <Check className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Delete Confirmation Alert Modal */}
        {showDeleteConfirm && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 space-y-3 animate-fade-in text-xs shrink-0">
            <div className="flex items-center gap-2 text-rose-900 font-bold">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>Vill du radera "{recipe.title}"?</span>
            </div>
            <p className="text-rose-700 leading-relaxed">
              Receptet tas bort permanent från hela hushållet.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 px-3 bg-white border border-rose-200 text-stone-700 font-semibold rounded-2xl touch-manipulation min-h-[44px]"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl active:scale-95 touch-manipulation min-h-[44px]"
              >
                Ja, ta bort
              </button>
            </div>
          </div>
        )}

        {/* MAIN EDITABLE FORM BODY */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto overflow-x-hidden flex-1 text-xs min-w-0">
          {/* Title */}
          <div>
            <label className="font-bold text-stone-800 block mb-1">
              Receptnamn <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="T.ex. Krämig Laxpasta"
              className="w-full h-11 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl px-3.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]"
            />
          </div>

          {/* Maträttsbild */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-stone-800 block">
                Maträttsbild
              </label>
            </div>

            <div className="space-y-2">
              {coverImageUrl ? (
                <div className="relative aspect-16/9 rounded-3xl overflow-hidden bg-stone-900 border border-[#EBE7DF] shadow-xs">
                  <img
                    src={coverImageUrl}
                    alt="Förhandsvisning"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end justify-between p-3">
                    <label className="px-3.5 py-2 bg-white/95 hover:bg-white text-stone-900 rounded-2xl font-bold text-xs cursor-pointer shadow-xs active:scale-95 transition-all flex items-center gap-1.5 touch-manipulation min-h-[38px]">
                      <Camera className="w-4 h-4 text-[#284235]" />
                      <span>Byt foto från mobil</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleCoverImageUpload}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setCoverImageUrl('')}
                      className="w-9 h-9 rounded-2xl bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center transition-all touch-manipulation"
                      title="Ta bort bild"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {isImageUploading && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                      <span className="text-xs font-semibold">Optimerar bild...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col items-center justify-center p-4 bg-[#FCFAF5] hover:bg-stone-100 border border-[#EBE7DF] rounded-3xl cursor-pointer text-center active:scale-95 transition-all shadow-xs touch-manipulation min-h-[86px]">
                    <Camera className="w-5 h-5 text-[#284235] mb-1" />
                    <span className="font-bold text-stone-900 text-xs">Fota med kamera</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleCoverImageUpload}
                    />
                  </label>

                  <label className="flex flex-col items-center justify-center p-4 bg-[#FCFAF5] hover:bg-stone-100 border border-[#EBE7DF] rounded-3xl cursor-pointer text-center active:scale-95 transition-all shadow-xs touch-manipulation min-h-[86px]">
                    <ImagePlus className="w-5 h-5 text-stone-700 mb-1" />
                    <span className="font-bold text-stone-900 text-xs">Välj från galleri</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleCoverImageUpload}
                    />
                  </label>
                </div>
              )}

              <input
                type="text"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://... bildlänk"
                className="w-full h-10 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl px-3 text-xs text-stone-900"
              />
            </div>
          </div>

          {/* Category & Subcategory */}
          <div className="space-y-2.5">
            <div>
              <label className="font-bold text-stone-800 block mb-1 text-xs">Huvudkategori</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as RecipeCategory)}
                className="w-full h-11 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl px-3 text-xs text-stone-900"
              >
                {STANDARD_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <SubcategorySelector
              category={category}
              values={subcategories}
              onChange={setSubcategories}
            />
          </div>

          {/* Servings & Cooking Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-stone-800 block mb-1">Portioner</label>
              <input
                type="number"
                min={1}
                max={24}
                value={servings}
                onChange={(e) => setServings(e.target.value === '' ? '' : parseInt(e.target.value, 10) || '')}
                onBlur={() => {
                  if (servings === '' || Number(servings) < 1) {
                    setServings(recipe.servings || 4);
                  }
                }}
                className="w-full h-11 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl px-3 text-xs text-stone-900 text-center"
              />
            </div>

            <div>
              <label className="font-bold text-stone-800 block mb-1">Tillagningstid (min)</label>
              <input
                type="number"
                min={0}
                value={cookingTimeMinutes}
                onChange={(e) => setCookingTimeMinutes(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
                onBlur={() => {
                  if (cookingTimeMinutes === '') {
                    setCookingTimeMinutes(0);
                  }
                }}
                className="w-full h-11 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl px-3 text-xs text-stone-900 text-center"
              />
            </div>
          </div>

          <DifficultyPicker value={difficulty} onChange={setDifficulty} />

          {/* INGREDIENTS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-serif font-bold text-stone-900 text-sm">
                Ingredienser {parsedIngredients.length > 0 ? `(${parsedIngredients.length} st)` : ''}
              </label>
              <span className="text-[11px] text-stone-500 font-medium">
                En ingrediens per rad
              </span>
            </div>

            <textarea
              rows={6}
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.target.value)}
              placeholder="400 g spaghetti&#10;200 g guanciale eller pancetta&#10;4 färska äggulor&#10;80 g pecorino romano&#10;Svartpeppar efter smak"
              className="w-full bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl p-3.5 text-xs text-stone-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#284235] font-sans resize-y min-h-[140px]"
            />
            <p className="text-[11px] text-stone-400 mt-1 flex items-start gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span>Gör en radbrytning (Enter) för varje ny ingrediens. Appen tolkar mängd, enhet och varugrupp automatiskt.</span>
            </p>
          </div>

          {/* INSTRUCTIONS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-serif font-bold text-stone-900 text-sm">
                Tillagningssteg {parsedInstructions.length > 0 ? `(${parsedInstructions.length} steg)` : ''}
              </label>
              <span className="text-[11px] text-stone-500 font-medium">
                Ett steg per rad
              </span>
            </div>

            <textarea
              rows={6}
              value={instructionsText}
              onChange={(e) => setInstructionsText(e.target.value)}
              placeholder="1. Koka pastan i rikligt med saltat vatten&#10;2. Stek guanciale knaprig på medelvärme&#10;3. Vispa äggulor med pecorino i en skål..."
              className="w-full bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl p-3.5 text-xs text-stone-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#284235] font-sans resize-y min-h-[140px]"
            />
            <p className="text-[11px] text-stone-400 mt-1 flex items-start gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span>Gör en radbrytning (Enter) för varje nytt steg. Appen numrerar stegen automatiskt.</span>
            </p>
          </div>

          {/* Household Notes */}
          <div>
            <label className="font-bold text-stone-800 block mb-1">
              Hushållsanteckningar (tips & moddar)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="T.ex. 'Dubbla vitlöken och koka på svag värme'"
              className="w-full h-11 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl px-3.5 text-xs text-stone-900"
            />
          </div>

          {/* Action Buttons: Save & Delete */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              className="w-full py-4 bg-[#284235] hover:bg-black active:scale-95 text-white font-bold text-sm rounded-2xl shadow-md transition-all touch-manipulation flex items-center justify-center gap-2"
              style={{ minHeight: '54px' }}
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Spara ändringar</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3 bg-[#FCFAF5] hover:bg-rose-50 text-rose-700 font-semibold text-xs rounded-2xl active:scale-95 transition-all touch-manipulation flex items-center justify-center gap-1.5 border border-[#EBE7DF]"
              style={{ minHeight: '46px' }}
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Ta bort recept</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
