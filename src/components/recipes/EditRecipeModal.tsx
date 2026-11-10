import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Toast } from '../layout/Toast';
import type { Recipe, Instruction, Ingredient, RecipeCategory, RecipeDifficulty } from '../../types/recipe';
import { getRecipeSubcategories } from '../../types/recipe';
import { useRecipes } from '../../context/RecipeContext';
import { X, Check } from 'lucide-react';
import { parseIngredientsText } from '../../utils/ingredientParser';
import { uploadRecipePhoto } from '../../utils/imageService';
import { cleanLeadingStepNumber, formatIngredientsToText } from '../../utils/formatters';
import { RecipeFormFields } from './RecipeFormFields';
import { NutritionEditor, type NutritionEdit } from './NutritionEditor';
import { productKey, recipeNutrition, type PageNutrition, type ProductLink } from '../../utils/nutrition';
import { ProductSearchSheet } from './ProductSearchSheet';

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

  const initialIngredientsRef = useRef(ingredientsText);

  // One step per line in a single text box
  const [instructionsText, setInstructionsText] = useState<string>(() =>
    recipe.instructions && recipe.instructions.length > 0 ? recipe.instructions.map((inst) => inst.text).join('\n') : ''
  );

  const [showDiscardPrompt, setShowDiscardPrompt] = useState<boolean>(false);

  // Nutrition written in here, and whether the values given before are to be left out
  const [nutritionEdit, setNutritionEdit] = useState<NutritionEdit>({});
  const [nutritionCleared, setNutritionCleared] = useState(false);
  // Ingredients tied to packaged foods in Open Food Facts
  const [productLinks, setProductLinks] = useState<ProductLink[]>(recipe.productLinks || []);
  const [showProductSearch, setShowProductSearch] = useState(false);

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

  // The values the recipe had: kept unless they were cleared, or came from the web page and the
  // ingredients have been changed since (then they no longer fit and are worked out instead)
  const givenNutrition: PageNutrition | undefined =
    nutritionCleared ||
    (recipe.pageNutrition?.source !== 'manual' && ingredientsText !== initialIngredientsRef.current)
      ? undefined
      : recipe.pageNutrition;
  const nutritionServings = Number(servings) || 4;
  const currentNutrition = useMemo(
    () => recipeNutrition({ ingredients: parsedIngredients, servings: nutritionServings, pageNutrition: givenNutrition, productLinks }),
    [parsedIngredients, nutritionServings, givenNutrition, productLinks]
  );

  // What to save: values written here, together with values written in before that were not changed
  const nutritionToSave = (): PageNutrition | undefined => {
    const before = givenNutrition?.source === 'manual' ? givenNutrition : undefined;
    const beforeLinked = before && before.per !== '100g' && Object.keys(before.values).length ? { per: before.per as 'portion' | 'total', values: before.values } : undefined;
    const before100 = before ? before.per100g ?? (before.per === '100g' ? before.values : undefined) : undefined;
    const linked = nutritionEdit.linked && Object.keys(nutritionEdit.linked.values).length ? nutritionEdit.linked : nutritionEdit.linked ? undefined : beforeLinked;
    const per100g = nutritionEdit.per100g && Object.keys(nutritionEdit.per100g).length ? nutritionEdit.per100g : nutritionEdit.per100g ? undefined : before100;
    if (!nutritionEdit.linked && !nutritionEdit.per100g) return givenNutrition;
    if (linked) return { per: linked.per, values: linked.values, source: 'manual', ...(per100g ? { per100g } : {}) };
    if (per100g) return { per: '100g', values: per100g, source: 'manual' };
    return undefined;
  };

  // Unsaved changes: compare with how the form looked when it opened
  const snapshot = () =>
    JSON.stringify([title, category, subcategories, servings, difficulty, cookingTimeMinutes, coverImageUrl, notes, ingredientsText, instructionsText, nutritionEdit, nutritionCleared, productLinks]);
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
      coverImageUrl: coverImageUrl.trim(),
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
      // Values written in here win; otherwise the ones the recipe had, see givenNutrition
      pageNutrition: nutritionToSave(),
      // Only for ingredients the recipe still has
      productLinks: productLinks.filter((p) => parsedIngredients.some((i) => productKey(i.name) === p.ingredient)),
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

        {toastMessage && <Toast message={toastMessage} />}

        {/* Form */}
        <form id="edit-recipe-form" onSubmit={handleSubmit} className="px-5 pt-4 pb-6 space-y-5 overflow-y-auto overflow-x-hidden flex-1 text-xs min-w-0">
          <RecipeFormFields
            values={{ title, category, subcategories, servings, cookingTimeMinutes, difficulty, coverImageUrl, notes, ingredientsText, instructionsText }}
            setTitle={setTitle}
            setCategory={setCategory}
            setSubcategories={setSubcategories}
            setServings={setServings}
            setCookingTimeMinutes={setCookingTimeMinutes}
            setDifficulty={setDifficulty}
            setCoverImageUrl={setCoverImageUrl}
            setNotes={setNotes}
            setIngredientsText={setIngredientsText}
            setInstructionsText={setInstructionsText}
            handleCoverImageUpload={handleCoverImageUpload}
            isImageUploading={isImageUploading}
            ingredientCount={parsedIngredients.length}
            stepCount={parsedInstructions.length}
            idPrefix="edit"
            defaultServings={recipe.servings || 4}
          />

          <NutritionEditor
            current={currentNutrition}
            servings={nutritionServings}
            edit={nutritionEdit}
            onEdit={(e) => {
              setNutritionEdit(e);
              setNutritionCleared(false);
            }}
            onUseIngredients={() => {
              setNutritionEdit({});
              setNutritionCleared(true);
            }}
            usesIngredients={!nutritionEdit.linked && !nutritionEdit.per100g && !givenNutrition}
            products={productLinks}
            pieceIngredients={parsedIngredients.filter((i) => ['', 'st'].includes((i.unit || '').toLowerCase()) && i.amount != null).map((i) => productKey(i.name))}
            onProductsChange={setProductLinks}
            onFindProduct={() => setShowProductSearch(true)}
          />

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

        {showProductSearch && (
          <ProductSearchSheet
            ingredients={parsedIngredients.map((i) => i.name)}
            notCounted={(currentNutrition?.notCounted || []).filter((n) => n.reason !== 'ingen mängd').map((n) => n.name)}
            onChoose={(link) => {
              setProductLinks([...productLinks.filter((p) => p.ingredient !== link.ingredient), link]);
              setShowProductSearch(false);
            }}
            onClose={() => setShowProductSearch(false)}
          />
        )}

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
