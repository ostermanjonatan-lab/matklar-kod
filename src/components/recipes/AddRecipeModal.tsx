import React, { useState, useMemo } from 'react';
import type { Recipe, Instruction, Ingredient, RecipeCategory, RecipeSourceType } from '../../types/recipe';
import { useRecipes } from '../../context/RecipeContext';
import {
  X,
  Trash2,
  Camera,
  Globe,
  Upload,
  ScanText,
  CheckCircle2,
  Loader2,
  ImagePlus,
  RefreshCw,
  FileText,
  Lightbulb
} from 'lucide-react';
import {
  performClientOCR,
  parseRawRecipeText,
  parseIngredientsText
} from '../../utils/ocrService';
import { scrapeRecipeFromUrl } from '../../services/webRecipeScraper';
import { uploadRecipePhoto, persistRecipeDocument } from '../../utils/imageService';
import { cleanLeadingStepNumber, formatIngredientsToText } from '../../utils/formatters';
import { SubcategorySelector } from './SubcategorySelector';
import { STANDARD_CATEGORIES } from '../../data/categories';

interface AddRecipeModalProps {
  onClose: () => void;
}

export const AddRecipeModal: React.FC<AddRecipeModalProps> = ({ onClose }) => {
  const { addRecipe, openRecipeDetail, household } = useRecipes();

  // Mode: 'manual' | 'ocr' | 'url' | 'paste'
  const [activeImportMode, setActiveImportMode] = useState<'manual' | 'ocr' | 'url' | 'paste'>('manual');
  const [pastedRecipeText, setPastedRecipeText] = useState('');


  // Form Fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<RecipeCategory>('Middag');
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [servings, setServings] = useState<number | string>(4);
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
    const parsed = parseRawRecipeText(ocrReviewText);
    applyParsedResult(parsed);
    setOcrReviewMode(false);
    setActiveImportMode('manual');
    setToastMessage(
      `Recept inlagt! ${parsed.ingredients.length} ingredienser, ${parsed.instructions.length} steg.`
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
      `Text tolkad! ${parsed.ingredients.length} ingredienser och ${parsed.instructions.length} steg identifierades.`
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
          `Recept inläst! ${scraped.ingredients.length} ingredienser och ${scraped.instructions.length} steg hittades.`
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

  // Submit Form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
            <h2 className="font-serif text-lg font-bold text-stone-900 leading-tight">Lägg till recept</h2>
            <p className="text-xs text-stone-500">Skapa eget eller hämta från webben</p>
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

          {/* Cover Photo */}
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
                    setServings(4);
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
              placeholder="1. Koka pastan i rikligt med saltat vatten&#10;2. Stek guanciale knaprig på medelvärme&#10;3. Blanda äggulor och pecorino i en skål..."
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
              placeholder="T.ex. 'Dubbla vitlöken'"
              className="w-full h-11 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl px-3.5 text-xs text-stone-900"
            />
          </div>

          {/* Footer Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-4 bg-[#284235] hover:bg-black active:scale-95 text-white font-bold text-sm rounded-2xl shadow-md transition-all touch-manipulation"
              style={{ minHeight: '54px' }}
            >
              Spara recept
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
