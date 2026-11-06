import React, { useState, useMemo } from 'react';
import type { Recipe, Instruction, Ingredient, RecipeCategory, RecipeSourceType, RecipeDifficulty } from '../../types/recipe';
import { useRecipes } from '../../context/RecipeContext';
import {
  X,
  Check,
  Camera,
  Globe,
  Upload,
  ScanText,
  CheckCircle2,
  Loader2,
  RefreshCw,
  FileText,
} from 'lucide-react';
import {
  performClientOCR,
  parseRawRecipeText,
  parseIngredientsText
} from '../../utils/ocrService';
import { scrapeRecipeFromUrl } from '../../services/webRecipeScraper';
import { uploadRecipePhoto, persistRecipeDocument } from '../../utils/imageService';
import { cleanLeadingStepNumber, formatIngredientsToText } from '../../utils/formatters';
import { RecipeFormFields } from './RecipeFormFields';

interface AddRecipeModalProps {
  onClose: () => void;
  /**
   * Set by the modal: call it when the view wants to close (for example the phone's back
   * button). It returns true when the modal stays open to ask about unsaved input.
   */
  closeGuardRef?: React.MutableRefObject<(() => boolean) | null>;
}

export const AddRecipeModal: React.FC<AddRecipeModalProps> = ({ onClose, closeGuardRef }) => {
  const { addRecipe, openRecipeDetail, household } = useRecipes();

  // Mode: 'manual' | 'ocr' | 'url' | 'paste'
  const [activeImportMode, setActiveImportMode] = useState<'manual' | 'ocr' | 'url' | 'paste'>('manual');
  const [pastedRecipeText, setPastedRecipeText] = useState('');


  // Form Fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<RecipeCategory>('Middag');
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [servings, setServings] = useState<number | string>(4);
  const [difficulty, setDifficulty] = useState<RecipeDifficulty | undefined>(undefined);
  const [cookingTimeMinutes, setCookingTimeMinutes] = useState<number | string>(30);
  const [coverImageUrl, setCoverImageUrl] = useState(
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80'
  );
  const [recipeDocumentUrl, setRecipeDocumentUrl] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceType, setSourceType] = useState<RecipeSourceType>('manual');
  const [notes, setNotes] = useState('');

  const [ingredientsText, setIngredientsText] = useState<string>('');
  const [instructionsText, setInstructionsText] = useState<string>('');

  // Image Upload State
  const [isImageUploading, setIsImageUploading] = useState(false);

  // Document & OCR state
  const [selectedDocumentFile, setSelectedDocumentFile] = useState<File | null>(null);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrStatusText, setOcrStatusText] = useState('');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // After OCR: show raw text for user review/editing BEFORE parsing
  const [ocrReviewMode, setOcrReviewMode] = useState(false);
  const [ocrReviewText, setOcrReviewText] = useState('');


  // URL Scraping state
  const [isUrlFetching, setIsUrlFetching] = useState(false);
  const [urlFetchProgress, setUrlFetchProgress] = useState(0);
  const [urlFetchStatus, setUrlFetchStatus] = useState('');
  const [urlFetchError, setUrlFetchError] = useState<string | null>(null);

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

  // Shared helper: apply a parsed recipe result into all form fields
  const applyParsedResult = (parsed: ReturnType<typeof parseRawRecipeText>) => {
    if (parsed.title) setTitle(parsed.title);
    if (parsed.description && !notes) setNotes(parsed.description);
    if (parsed.category) setCategory(parsed.category);
    if ((parsed as any).subcategories && (parsed as any).subcategories.length > 0) {
      setSubcategories((parsed as any).subcategories);
    } else if (parsed.subcategory) {
      setSubcategories(parsed.subcategory.split(',').map((s: string) => s.trim()).filter(Boolean));
    }
    if (parsed.servings) setServings(parsed.servings);
    if (parsed.difficulty) setDifficulty(parsed.difficulty);
    if (parsed.cookingTimeMinutes && parsed.cookingTimeMinutes > 0) {
      setCookingTimeMinutes(parsed.cookingTimeMinutes);
    }
    if (parsed.ingredients.length > 0) {
      setIngredientsText(formatIngredientsToText(parsed.ingredients));
    }
    if (parsed.instructions.length > 0) {
      setInstructionsText(parsed.instructions.map((i) => i.text).join('\n'));
    }
  };

  // Run OCR on a specific file, then enter review mode so the user can
  // inspect and correct the raw text before parsing it into the form.
  const runOcrOnCurrentFile = async (fileToScan?: File | null) => {
    const file = fileToScan || selectedDocumentFile;
    if (!file) return;

    setIsOcrLoading(true);
    setOcrReviewMode(false);
    setOcrStatusText('Optimerar bildkontrast och skärpa...');
    setOcrProgress(10);

    try {
      const result = await performClientOCR(file, (progress, status) => {
        setOcrProgress(progress);
        setOcrStatusText(status);
      });

      const rawText = result?.rawText?.trim() ?? '';

      if (rawText.length > 15) {
        // Show review screen – user can edit before parsing
        setOcrReviewText(rawText);
        setOcrReviewMode(true);
      } else {
        // Very little text extracted – tell user and still show review
        setOcrReviewText(rawText);
        setOcrReviewMode(true);
        setToastMessage('Lite text avlästes – se över och rätta texten nedan, klicka sedan Tolka.');
        setTimeout(() => setToastMessage(null), 5000);
      }
    } catch (err) {
      console.error('OCR error:', err);
      setToastMessage('OCR misslyckades. Bilden sparades ändå som dokument.');
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setIsOcrLoading(false);
    }
  };

  // Commit: parse the (possibly user-edited) OCR review text into the form
  const handleApplyOcrReviewText = () => {
    if (!ocrReviewText.trim()) return;
    const parsed = parseRawRecipeText(ocrReviewText, { fromOcr: true });
    applyParsedResult(parsed);
    setOcrReviewMode(false);
    setActiveImportMode('manual');
    setToastMessage(
      `${parsed.ingredients.length} ingredienser och ${parsed.instructions.length} steg hittades`
    );
    setTimeout(() => setToastMessage(null), 4000);
  };



  // Parse directly pasted recipe text
  const handleParsePastedText = () => {
    if (!pastedRecipeText.trim()) return;
    const parsed = parseRawRecipeText(pastedRecipeText);
    applyParsedResult(parsed);
    setActiveImportMode('manual');
    setToastMessage(
      parsed.ingredients.length === 0 && parsed.instructions.length === 0
        ? 'Hittade inga ingredienser eller steg. Kontrollera texten.'
        : `${parsed.ingredients.length} ingredienser och ${parsed.instructions.length} steg hittades`
    );
    setTimeout(() => setToastMessage(null), 4000);
  };


  // OCR & Document File Upload: Persists permanently to eliminate broken blob: URLs
  const handleDocumentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, runOcrNow: boolean = true) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedDocumentFile(file);
    setSourceType(file.type.includes('pdf') ? 'pdf' : 'recipe_image');

    // 1. Immediately persist document so it stays permanent across refreshes & devices
    setIsOcrLoading(true);
    setOcrStatusText('Sparar och optimerar bild permanent...');
    setOcrProgress(10);

    try {
      const persistentUrl = await persistRecipeDocument(file);
      setRecipeDocumentUrl(persistentUrl);

      // If user still has default Unsplash cover, set this document as the cover photo
      if (coverImageUrl.includes('unsplash.com')) {
        setCoverImageUrl(persistentUrl);
      }
    } catch (saveErr) {
      console.warn('Document persistence error:', saveErr);
    }

    if (runOcrNow) {
      await runOcrOnCurrentFile(file);
    } else {
      setIsOcrLoading(false);
    }
  };

  // Full Automatic URL Recipe Scraper
  const handleFetchUrlRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceUrl.trim()) return;

    setIsUrlFetching(true);
    setUrlFetchProgress(15);
    setUrlFetchStatus('Ansluter till receptsidan...');
    setUrlFetchError(null);
    setSourceType('url');

    // Smooth incremental progress timer while network pipeline executes
    const progressTimer = setInterval(() => {
      setUrlFetchProgress((prev) => {
        if (prev < 35) {
          setUrlFetchStatus('Hämtar innehåll från webbplatsen...');
          return prev + 10;
        }
        if (prev < 65) {
          setUrlFetchStatus('Läser av ingredienser och tillagning...');
          return prev + 8;
        }
        if (prev < 88) {
          setUrlFetchStatus('Hämtar bild och sätter kategori...');
          return prev + 5;
        }
        if (prev < 96) {
          return prev + 1;
        }
        return prev;
      });
    }, 280);

    try {
      const scraped = await scrapeRecipeFromUrl(sourceUrl, (percent, status) => {
        setUrlFetchProgress(percent);
        setUrlFetchStatus(status);
      });

      clearInterval(progressTimer);
      setUrlFetchProgress(100);
      setUrlFetchStatus('Klart! Fyller i recept...');

      if (scraped.title) setTitle(scraped.title);
      if (scraped.coverImageUrl) setCoverImageUrl(scraped.coverImageUrl);
      if (scraped.servings) setServings(scraped.servings);
      if (scraped.difficulty) setDifficulty(scraped.difficulty);
      if (scraped.category) setCategory(scraped.category);
      if ((scraped as any).subcategories && (scraped as any).subcategories.length > 0) {
        setSubcategories((scraped as any).subcategories);
      } else if (scraped.subcategory) {
        setSubcategories(scraped.subcategory.split(',').map((s: string) => s.trim()).filter(Boolean));
      }
      const scrapedTime = Number(scraped.cookTimeMinutes) > 0 ? Number(scraped.cookTimeMinutes) : (Number(scraped.prepTimeMinutes) || 0);
      if (scrapedTime > 0) setCookingTimeMinutes(scrapedTime);
      if (scraped.ingredients.length > 0) {
        setIngredientsText(formatIngredientsToText(scraped.ingredients));
      }
      if (scraped.instructions.length > 0) {
        setInstructionsText(scraped.instructions.map((i) => i.text).join('\n'));
      }

      // Small delay to let user see 100% bar before modal form opens
      setTimeout(() => {
        setActiveImportMode('manual');
        setToastMessage(
          scraped.ingredients.length === 0 || scraped.instructions.length === 0
            ? `${scraped.ingredients.length} ingredienser och ${scraped.instructions.length} steg hittades. Fyll i resten själv.`
            : `${scraped.ingredients.length} ingredienser och ${scraped.instructions.length} steg hittades`
        );
        setTimeout(() => setToastMessage(null), 4500);
      }, 300);
    } catch (err: any) {
      clearInterval(progressTimer);
      setUrlFetchProgress(0);
      console.warn('URL scraping error:', err);
      setUrlFetchError(
        'Kunde inte läsa in receptet från länken. Kontrollera adressen och försök igen.'
      );
    } finally {
      clearInterval(progressTimer);
      setIsUrlFetching(false);
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

  // Anything filled in that would be lost on close
  const [showDiscardPrompt, setShowDiscardPrompt] = useState<boolean>(false);
  const snapshot = () =>
    JSON.stringify([title, category, subcategories, servings, difficulty, cookingTimeMinutes, coverImageUrl, notes, ingredientsText, instructionsText]);
  const initialSnapshotRef = React.useRef<string | null>(null);
  if (initialSnapshotRef.current === null) initialSnapshotRef.current = snapshot();
  const isDirty = snapshot() !== initialSnapshotRef.current;

  const requestClose = (): boolean => {
    if (isDirty) {
      setShowDiscardPrompt(true);
      return true;
    }
    onClose();
    return false;
  };
  React.useEffect(() => {
    if (closeGuardRef) closeGuardRef.current = requestClose;
  });

  // Submit Form
  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) return;

    const newRecipe: Recipe = {
      id: `custom-rec-${Date.now()}`,
      title: title.trim(),
      description: '',
      coverImageUrl:
        coverImageUrl.trim() ||
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80',
      recipeDocumentUrl: recipeDocumentUrl.trim() || undefined,
      sourceUrl: sourceUrl.trim() || undefined,
      sourceType,
      servings: Number(servings) || 4,
      category,
      subcategory: subcategories.join(', '),
      subcategories: subcategories,
      rating: 0,
      isFavorite: false,
      notes: notes.trim(),
      ingredients: parsedIngredients,
      instructions: parsedInstructions,
      householdId: household?.id || 'hh-local',
      prepTimeMinutes: 0,
      cookTimeMinutes: Number(cookingTimeMinutes) || 0,
      difficulty,
      createdAt: new Date().toISOString(),
    };

    addRecipe(newRecipe);
    openRecipeDetail(newRecipe);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in font-sans overflow-x-hidden"
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
          <h2 className="font-serif text-lg font-bold text-stone-900 leading-tight">Lägg till recept</h2>
          <button
            type="button"
            onClick={() => requestClose()}
            className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-100 touch-manipulation"
            aria-label="Stäng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Import Mode Tabs */}
        <div className="bg-[#FCFAF5] p-2 grid grid-cols-4 gap-1 border-b border-[#EBE7DF] shrink-0">
          <button
            type="button"
            onClick={() => setActiveImportMode('manual')}
            className={`py-2 px-1 rounded-2xl text-[11px] font-semibold transition-all touch-manipulation min-h-[40px] text-center ${
              activeImportMode === 'manual'
                ? 'bg-white text-stone-900 shadow-xs border border-[#EBE7DF] font-bold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Formulär
          </button>

          <button
            type="button"
            onClick={() => setActiveImportMode('url')}
            className={`py-2 px-1 rounded-2xl text-[11px] font-semibold transition-all flex items-center justify-center gap-1 touch-manipulation min-h-[40px] text-center ${
              activeImportMode === 'url'
                ? 'bg-[#284235] text-white shadow-xs font-bold'
                : 'text-stone-600 hover:bg-stone-200/50'
            }`}
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span>Webblänk</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveImportMode('paste')}
            className={`py-2 px-1 rounded-2xl text-[11px] font-semibold transition-all flex items-center justify-center gap-1 touch-manipulation min-h-[40px] text-center ${
              activeImportMode === 'paste'
                ? 'bg-[#284235] text-white shadow-xs font-bold'
                : 'text-stone-600 hover:bg-stone-200/50'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>Klistra in</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveImportMode('ocr')}
            className={`py-2 px-1 rounded-2xl text-[11px] font-semibold transition-all flex items-center justify-center gap-1 touch-manipulation min-h-[40px] text-center ${
              activeImportMode === 'ocr'
                ? 'bg-[#284235] text-white shadow-xs font-bold'
                : 'text-stone-600 hover:bg-stone-200/50'
            }`}
          >
            <ScanText className="w-3.5 h-3.5 shrink-0" />
            <span>Fota / OCR</span>
          </button>
        </div>

        {/* Toast / Notification */}
        {toastMessage && (
          <div className="bg-emerald-900 text-white px-4 py-3 text-xs font-semibold flex items-center gap-2 animate-fade-in border-b border-emerald-800 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* OCR LOADING OVERLAY */}
        {isOcrLoading && (
          <div className="p-6 bg-[#FCFAF5] border-b border-[#EBE7DF] text-center space-y-3 animate-fade-in shrink-0">
            <Loader2 className="w-7 h-7 text-[#284235] animate-spin mx-auto" />
            <div>
              <h4 className="font-serif font-bold text-sm text-stone-900">
                {ocrStatusText}
              </h4>
            </div>
            <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#284235] h-full rounded-full transition-all duration-200"
                style={{ width: `${ocrProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* TAB 1: WEB LINK IMPORT */}
        {activeImportMode === 'url' && (
          <div className="p-5 bg-[#FCFAF5] border-b border-[#EBE7DF] space-y-3.5 animate-fade-in text-xs shrink-0">
            <div>
              <h4 className="font-serif font-bold text-base text-stone-900">
                Klistra in receptlänk
              </h4>
            </div>

            <form onSubmit={handleFetchUrlRecipe} className="space-y-3">
              <input
                type="url"
                required
                disabled={isUrlFetching}
                value={sourceUrl}
                onChange={(e) => {
                  setSourceUrl(e.target.value);
                  setUrlFetchError(null);
                }}
                placeholder="https://www.ica.se/recept/..."
                className="w-full h-12 bg-white border border-[#EBE7DF] rounded-2xl px-3.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235] shadow-xs disabled:bg-stone-50 disabled:text-stone-500"
              />

              {/* Progress bar during URL recipe fetching */}
              {isUrlFetching && (
                <div className="p-3.5 bg-white rounded-2xl border border-[#EBE7DF] space-y-2.5 animate-fade-in shadow-xs">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Loader2 className="w-3.5 h-3.5 text-[#284235] animate-spin shrink-0" />
                      <span className="font-bold text-stone-900 text-xs truncate">
                        {urlFetchStatus || 'Läser in recept...'}
                      </span>
                    </div>
                    <span className="font-bold text-[#284235] text-xs font-mono shrink-0 ml-2">
                      {urlFetchProgress}%
                    </span>
                  </div>

                  {/* Progress Bar Track */}
                  <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden p-0.5 border border-stone-200">
                    <div
                      className="bg-[#284235] h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.max(6, Math.min(100, urlFetchProgress))}%` }}
                    />
                  </div>

                  <p className="text-[10px] text-stone-500">
                    Läser in ingredienser, instruktioner och bilder från sidan...
                  </p>
                </div>
              )}

              {urlFetchError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs space-y-2">
                  <p>{urlFetchError}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveImportMode('paste')}
                      className="px-3 py-1.5 bg-stone-900 text-white rounded-xl font-bold flex items-center gap-1.5 active:scale-95 shadow-xs"
                    >
                      <FileText className="w-3.5 h-3.5 text-stone-300" />
                      <span>Klistra in recepttexten istället</span>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={isUrlFetching || !sourceUrl.trim()}
                  className="w-full py-3.5 bg-[#284235] hover:bg-black text-white font-bold text-sm rounded-2xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs touch-manipulation min-h-[48px]"
                >
                  {isUrlFetching ? (
                    <>
                      <Loader2 className="w-4 h-4 text-emerald-300 animate-spin" />
                      <span>Läser in ({urlFetchProgress}%)...</span>
                    </>
                  ) : (
                    <span>Hämta recept</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: PASTE RAW TEXT IMPORT */}
        {activeImportMode === 'paste' && (
          <div className="p-4 bg-[#FCFAF5] border-b border-[#EBE7DF] space-y-3 animate-fade-in text-xs shrink-0">
            <div className="flex items-center justify-between">
              <h4 className="font-serif font-bold text-base text-stone-900">
                Klistra in recepttext
              </h4>
              <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-medium">
                Automatisk tolkning
              </span>
            </div>

            <p className="text-[11px] text-stone-500">
              Kopiera text från valfri webbsida, app eller anteckning och klistra in här. Ingredienser, mått och tillagningssteg tolkas automatiskt.
            </p>

            <textarea
              rows={6}
              value={pastedRecipeText}
              onChange={(e) => setPastedRecipeText(e.target.value)}
              placeholder="Klistra in hela recepttexten här...&#10;&#10;T.ex:&#10;Krämig Kycklingpasta&#10;&#10;Ingredienser:&#10;400 g tagliatelle&#10;500 g kycklingfilé&#10;2 dl vispgrädde&#10;1 klyfta vitlök&#10;Salt och peppar&#10;&#10;Gör så här:&#10;1. Koka pastan al dente.&#10;2. Stek kycklingen gyllenbrun..."
              className="w-full bg-white border border-[#EBE7DF] rounded-2xl p-3.5 text-xs text-stone-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#284235] font-sans resize-y"
            />

            <div className="flex gap-2">
              <button
                type="button"
                disabled={!pastedRecipeText.trim()}
                onClick={handleParsePastedText}
                className="flex-1 py-3 bg-[#284235] hover:bg-black text-white font-bold text-xs rounded-2xl active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-xs touch-manipulation min-h-[44px]"
              >
                <span>Tolka och fyll i recept</span>
              </button>

              {pastedRecipeText && (
                <button
                  type="button"
                  onClick={() => setPastedRecipeText('')}
                  className="px-3.5 py-3 bg-white border border-[#EBE7DF] text-stone-600 hover:text-stone-900 font-semibold text-xs rounded-2xl active:scale-95 touch-manipulation min-h-[44px]"
                >
                  Rensa
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: OCR & DOCUMENT SCAN — photo selection */}
        {activeImportMode === 'ocr' && !isOcrLoading && !ocrReviewMode && (
          <div className="p-4 bg-[#FCFAF5] border-b border-[#EBE7DF] space-y-3 animate-fade-in text-xs shrink-0">
            <div>
              <h4 className="font-serif font-bold text-base text-stone-900">
                Skanna receptfoto eller kokbok
              </h4>
              <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                Tips: bra ljus, sida platt, fota lodrätt uppifrån
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <label className="flex flex-col items-center justify-center p-4 bg-white border border-[#EBE7DF] hover:border-[#284235] rounded-3xl cursor-pointer text-center active:scale-95 transition-all shadow-xs touch-manipulation min-h-[86px]">
                <Camera className="w-5 h-5 text-[#284235] mb-1" />
                <span className="font-bold text-stone-900 text-xs">Fota med kamera</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleDocumentFileUpload(e, true)}
                />
              </label>

              <label className="flex flex-col items-center justify-center p-4 bg-white border border-[#EBE7DF] hover:border-[#284235] rounded-3xl cursor-pointer text-center active:scale-95 transition-all shadow-xs touch-manipulation min-h-[86px]">
                <Upload className="w-5 h-5 text-stone-700 mb-1" />
                <span className="font-bold text-stone-900 text-xs">Välj fil / PDF</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => handleDocumentFileUpload(e, true)}
                />
              </label>
            </div>

            {recipeDocumentUrl && (
              <div className="bg-white p-3 rounded-2xl border border-[#EBE7DF] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <img
                      src={recipeDocumentUrl}
                      alt="Receptdokument"
                      className="w-10 h-10 object-cover rounded-xl border border-stone-200 shrink-0"
                    />
                    <div className="truncate">
                      <span className="font-bold text-stone-900 text-xs block truncate">
                        Receptbild sparad
                      </span>
                      <span className="text-[10px] text-stone-500">
                        Optimerad för OCR & bildvisare
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setRecipeDocumentUrl('');
                      setSelectedDocumentFile(null);
                    }}
                    className="text-rose-600 hover:text-rose-700 font-semibold text-xs px-2 py-1"
                  >
                    Ta bort
                  </button>
                </div>

                <div className="pt-1 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => runOcrOnCurrentFile()}
                    className="w-full py-2.5 px-3 bg-[#284235] hover:bg-black text-white font-bold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 text-xs shadow-xs touch-manipulation min-h-[44px]"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Läs av med OCR igen</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: OCR REVIEW — editable raw text before parsing */}
        {activeImportMode === 'ocr' && !isOcrLoading && ocrReviewMode && (
          <div className="p-4 bg-[#FCFAF5] border-b border-[#EBE7DF] space-y-3 animate-fade-in text-xs shrink-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-serif font-bold text-base text-stone-900">
                  Kontrollera avläst text
                </h4>
                <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                  Rätta fel, flytta om rader vid behov – klicka sedan <strong>Tolka</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOcrReviewMode(false)}
                className="shrink-0 text-[11px] text-stone-500 hover:text-stone-900 font-semibold underline"
              >
                ← Fota om
              </button>
            </div>

            {ocrReviewText.trim().length < 30 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2 text-[11px] text-amber-900 leading-snug">
                ⚠️ Lite text avlästes ({ocrReviewText.trim().length} tecken). Kontrollera ljus och att boksidan är plan. Du kan ändå redigera och tolka texten, eller fota om.
              </div>
            )}

            <textarea
              rows={10}
              value={ocrReviewText}
              onChange={(e) => setOcrReviewText(e.target.value)}
              className="w-full bg-white border border-[#EBE7DF] rounded-2xl p-3 text-[11px] text-stone-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#284235] font-mono resize-y"
              placeholder="Den avlästa texten visas här..."
            />

            <div className="flex gap-2">
              <button
                type="button"
                disabled={!ocrReviewText.trim()}
                onClick={handleApplyOcrReviewText}
                className="flex-1 py-3 bg-[#284235] hover:bg-black text-white font-bold text-xs rounded-2xl active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-xs touch-manipulation min-h-[44px]"
              >
                <ScanText className="w-3.5 h-3.5 text-emerald-300" />
                <span>Tolka och fyll i recept</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOcrReviewText('');
                  setOcrReviewMode(false);
                }}
                className="px-3.5 py-3 bg-white border border-[#EBE7DF] text-stone-600 hover:text-stone-900 font-semibold text-xs rounded-2xl active:scale-95 touch-manipulation min-h-[44px]"
              >
                Rensa
              </button>
            </div>
          </div>
        )}

        {/* Form, the same fields as Redigera recept */}
        <form id="add-recipe-form" onSubmit={handleSubmit} className="px-5 pt-4 pb-6 space-y-5 overflow-y-auto overflow-x-hidden flex-1 text-xs min-w-0">
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
            idPrefix="add"
            defaultServings={4}
          />
        </form>

        {/* Spara, always in view */}
        <div className="px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-[#EBE7DF] bg-white shrink-0">
          <button
            type="submit"
            form="add-recipe-form"
            disabled={!title.trim()}
            className="w-full min-h-[50px] bg-[#284235] hover:bg-black disabled:opacity-40 text-white font-semibold text-sm rounded-2xl touch-manipulation flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Spara recept
          </button>
        </div>

        {/* Unsaved input */}
        {showDiscardPrompt && (
          <div className="absolute inset-0 z-10 bg-black/40 flex items-end sm:items-center justify-center animate-fade-in" onClick={() => setShowDiscardPrompt(false)}>
            <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-3" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-serif text-lg font-bold text-stone-900">Spara receptet?</h3>
              <p className="text-sm text-stone-600">Du har fyllt i receptet men inte sparat det.</p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscardPrompt(false);
                    onClose();
                  }}
                  className="flex-1 min-h-[46px] rounded-xl bg-stone-100 text-rose-700 text-sm font-semibold touch-manipulation"
                >
                  Släng receptet
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
              {!title.trim() && <p className="text-xs text-stone-500">Receptet behöver ett namn för att kunna sparas.</p>}
              <button type="button" onClick={() => setShowDiscardPrompt(false)} className="w-full min-h-[40px] text-sm text-stone-600 touch-manipulation">
                Fortsätt fylla i
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
