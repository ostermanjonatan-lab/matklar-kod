import React, { useState, useMemo } from 'react';
import { estimateDifficulty } from '../../utils/recipeDifficulty';
import { isCommonPantryStaple } from '../../utils/ingredientParser';
import { Toast } from '../layout/Toast';
import { isRecipeLink, readRecipeLink } from '../../utils/recipeLink';
import type { Recipe, Instruction, Ingredient, RecipeCategory, RecipeSourceType, RecipeDifficulty } from '../../types/recipe';
import { useRecipes } from '../../context/RecipeContext';
import {
  X,
  Check,
  Camera,
  Globe,
  Upload,
  ScanText,
  Loader2,
  FileText,
  PenLine,
  ClipboardPaste,
} from 'lucide-react';
import {
  performClientOCR,
  parseRawRecipeText,
  parseIngredientsText
} from '../../utils/ocrService';
import { scrapeRecipeFromUrl } from '../../services/webRecipeScraper';
import { uploadRecipePhoto, persistRecipeDocument } from '../../utils/imageService';
import { cleanLeadingStepNumber, formatIngredientsToText } from '../../utils/formatters';
import { AutoGrowTextarea, RecipeFormFields } from './RecipeFormFields';

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
      setToastMessage('Bilden är tillagd');
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
    // The page or text says how hard it is, or else the app makes a guess that can be changed
    setDifficulty(
      parsed.difficulty ||
        estimateDifficulty({
          title: parsed.title,
          ingredients: parsed.ingredients.map((i) => ({ name: i.name, isPantryStaple: isCommonPantryStaple(i.name) })),
          instructions: parsed.instructions,
          cookingTimeMinutes: parsed.cookingTimeMinutes,
        })
    );
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

    // A recipe someone shared from MatKlar: everything is in the link, nothing to fetch
    if (isRecipeLink(sourceUrl)) {
      setUrlFetchError(null);
      const shared = await readRecipeLink(sourceUrl);
      if (!shared) {
        setUrlFetchError('Länken gick inte att läsa. Den kan ha blivit avklippt.');
        return;
      }
      setTitle(shared.title);
      setCategory(shared.category);
      setSubcategories(shared.subcategories);
      setServings(shared.servings);
      if (shared.difficulty) setDifficulty(shared.difficulty);
      if (shared.cookTimeMinutes) setCookingTimeMinutes(shared.cookTimeMinutes);
      if (shared.coverImageUrl) setCoverImageUrl(shared.coverImageUrl);
      setIngredientsText(formatIngredientsToText(shared.ingredients));
      setInstructionsText(shared.instructions.map((i) => i.text).join('\n'));
      setSourceUrl(shared.sourceUrl || '');
      setSourceType(shared.sourceUrl ? 'url' : 'manual');
      setActiveImportMode('manual');
      setToastMessage('Receptet från länken är ifyllt');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

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
      setUrlFetchStatus('Fyller i receptet');

      if (scraped.title) setTitle(scraped.title);
      if (scraped.coverImageUrl) setCoverImageUrl(scraped.coverImageUrl);
      if (scraped.servings) setServings(scraped.servings);
      setDifficulty(
        scraped.difficulty ||
          estimateDifficulty({
            title: scraped.title,
            ingredients: (scraped.ingredients || []).map((i) => ({ name: i.name, isPantryStaple: isCommonPantryStaple(i.name) })),
            instructions: scraped.instructions,
            cookTimeMinutes: Number(scraped.cookTimeMinutes) || Number(scraped.prepTimeMinutes) || 0,
          })
      );
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

  const footerButton =
    'w-full min-h-[50px] bg-[#284235] hover:bg-black disabled:opacity-40 text-white font-semibold text-sm rounded-2xl touch-manipulation flex items-center justify-center gap-2';
  const clipboardButton =
    'inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl border border-[#EBE7DF] bg-white text-stone-800 font-semibold text-sm touch-manipulation';

  // Reads the clipboard; the phone may ask for permission the first time
  const readClipboard = async (): Promise<string | null> => {
    try {
      return await navigator.clipboard.readText();
    } catch {
      setToastMessage('Telefonen gav inte tillgång till urklipp. Håll in i rutan och välj Klistra in.');
      setTimeout(() => setToastMessage(null), 4000);
      return null;
    }
  };

  const pasteTextFromClipboard = async () => {
    const text = await readClipboard();
    if (text && text.trim()) setPastedRecipeText(text);
  };

  const pasteLinkFromClipboard = async () => {
    const text = await readClipboard();
    if (!text || !text.trim()) return;
    const link = text.match(/https?:\/\/[^\s<>"']+/i)?.[0] || text.trim();
    setSourceUrl(link);
    setUrlFetchError(null);
  };

  // Anything filled in that would be lost on close
  const [showDiscardPrompt, setShowDiscardPrompt] = useState<boolean>(false);
  const snapshot = () =>
    JSON.stringify([title, category, subcategories, servings, difficulty, cookingTimeMinutes, coverImageUrl, notes, ingredientsText, instructionsText, pastedRecipeText.trim(), sourceUrl.trim(), ocrReviewText.trim()]);
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

        {/* How to add the recipe: four equal choices, icon above a short word */}
        <div className="px-4 py-2.5 border-b border-[#EBE7DF] shrink-0">
          <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-[#F3EFE6]" role="tablist" aria-label="Sätt att lägga till">
            {([
              { mode: 'manual', label: 'Skriv', Icon: PenLine },
              { mode: 'url', label: 'Länk', Icon: Globe },
              { mode: 'paste', label: 'Klistra in', Icon: FileText },
              { mode: 'ocr', label: 'Foto', Icon: ScanText },
            ] as const).map(({ mode, label, Icon }) => {
              const selected = activeImportMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveImportMode(mode)}
                  className={`min-h-[52px] rounded-xl flex flex-col items-center justify-center gap-1 text-xs font-semibold whitespace-nowrap transition-colors touch-manipulation ${
                    selected ? 'bg-white text-[#284235] shadow-xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px]" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Toast / Notification */}
        {toastMessage && <Toast message={toastMessage} />}

        {/* Link, paste and photo: each fills the space; the form is shown once something is filled in */}
        {activeImportMode !== 'manual' && (
          <div className="flex-1 overflow-y-auto px-5 pt-4 pb-6 text-sm animate-fade-in">
            {/* LINK */}
            {activeImportMode === 'url' && (
              <form id="url-form" onSubmit={handleFetchUrlRecipe} className="space-y-3">
                <p className="text-stone-600">Adressen till receptet.</p>
                <input
                  type="url"
                  inputMode="url"
                  disabled={isUrlFetching}
                  value={sourceUrl}
                  onChange={(e) => {
                    setSourceUrl(e.target.value);
                    setUrlFetchError(null);
                  }}
                  placeholder="https://"
                  aria-label="Receptets adress"
                  className="w-full h-12 bg-white border border-[#EBE7DF] rounded-2xl px-3.5 text-base sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235] disabled:bg-stone-50 disabled:text-stone-500"
                />
                {!isUrlFetching && (
                  <button type="button" onClick={pasteLinkFromClipboard} className={clipboardButton}>
                    <ClipboardPaste className="w-4 h-4" />
                    Klistra in länk
                  </button>
                )}

                {isUrlFetching && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between gap-2 text-stone-700">
                      <span className="flex items-center gap-2 min-w-0">
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        <span className="truncate">{urlFetchStatus || 'Hämtar receptet'}</span>
                      </span>
                      <span className="tabular-nums text-stone-500 shrink-0">{urlFetchProgress} %</span>
                    </div>
                    <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#284235] h-full rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${Math.max(6, Math.min(100, urlFetchProgress))}%` }}
                      />
                    </div>
                  </div>
                )}

                {urlFetchError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 space-y-1">
                    <p>{urlFetchError}</p>
                    <button type="button" onClick={() => setActiveImportMode('paste')} className="font-semibold underline underline-offset-2 touch-manipulation">
                      Klistra in texten i stället
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* PASTE */}
            {activeImportMode === 'paste' && (
              <div className="space-y-3">
                <p className="text-stone-600">Text från en webbsida, ett mejl eller en anteckning.</p>
                <div className="flex items-center justify-between">
                  <button type="button" onClick={pasteTextFromClipboard} className={clipboardButton}>
                    <ClipboardPaste className="w-4 h-4" />
                    Klistra in från urklipp
                  </button>
                  {pastedRecipeText && (
                    <button type="button" onClick={() => setPastedRecipeText('')} className="text-stone-600 font-semibold min-h-[40px] px-1 touch-manipulation">
                      Rensa
                    </button>
                  )}
                </div>
                <AutoGrowTextarea
                  minRows={10}
                  value={pastedRecipeText}
                  onChange={(e) => setPastedRecipeText(e.target.value)}
                  placeholder="Klistra in receptet här"
                  aria-label="Recepttext"
                  className="w-full bg-white border border-[#EBE7DF] rounded-2xl p-3.5 text-base sm:text-sm text-stone-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#284235]"
                />
              </div>
            )}

            {/* PHOTO: reading */}
            {activeImportMode === 'ocr' && isOcrLoading && (
              <div className="py-6 space-y-3">
                <div className="flex items-center gap-2 text-stone-700">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>{ocrStatusText}</span>
                </div>
                <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#284235] h-full rounded-full transition-all duration-200" style={{ width: `${ocrProgress}%` }} />
                </div>
              </div>
            )}

            {/* PHOTO: choose */}
            {activeImportMode === 'ocr' && !isOcrLoading && !ocrReviewMode && (
              <div className="space-y-3">
                <p className="text-stone-600">Fota sidan rakt uppifrån i bra ljus.</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center justify-center gap-2 min-h-[52px] bg-white hover:bg-stone-50 border border-[#EBE7DF] rounded-2xl cursor-pointer font-semibold text-stone-900 touch-manipulation">
                    <Camera className="w-4 h-4" />
                    Ta foto
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleDocumentFileUpload(e, true)} />
                  </label>
                  <label className="flex items-center justify-center gap-2 min-h-[52px] bg-white hover:bg-stone-50 border border-[#EBE7DF] rounded-2xl cursor-pointer font-semibold text-stone-900 touch-manipulation">
                    <Upload className="w-4 h-4" />
                    Välj bild eller PDF
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleDocumentFileUpload(e, true)} />
                  </label>
                </div>

                {recipeDocumentUrl && (
                  <div className="flex items-center gap-3 pt-2 border-t border-[#EBE7DF]">
                    <img src={recipeDocumentUrl} alt="" className="w-12 h-12 object-cover rounded-xl border border-stone-200 shrink-0" />
                    <span className="flex-1 min-w-0 text-stone-700 truncate">Bilden är sparad</span>
                    <button type="button" onClick={() => runOcrOnCurrentFile()} className="text-[#284235] font-semibold min-h-[40px] px-1 touch-manipulation">
                      Läs av igen
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRecipeDocumentUrl('');
                        setSelectedDocumentFile(null);
                      }}
                      className="text-rose-700 font-semibold min-h-[40px] px-1 touch-manipulation"
                    >
                      Ta bort
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* PHOTO: check the text that was read */}
            {activeImportMode === 'ocr' && !isOcrLoading && ocrReviewMode && (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-stone-600">Rätta det som blev fel i texten.</p>
                  <button
                    type="button"
                    onClick={() => setOcrReviewMode(false)}
                    className="shrink-0 text-[#284235] font-semibold min-h-[36px] touch-manipulation"
                  >
                    Fota om
                  </button>
                </div>
                {ocrReviewText.trim().length < 30 && (
                  <p className="bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2 text-amber-900">
                    Bara lite text kunde läsas. Fota gärna om med bättre ljus och sidan plan.
                  </p>
                )}
                <AutoGrowTextarea
                  minRows={10}
                  value={ocrReviewText}
                  onChange={(e) => setOcrReviewText(e.target.value)}
                  placeholder="Den avlästa texten"
                  aria-label="Avläst text"
                  className="w-full bg-white border border-[#EBE7DF] rounded-2xl p-3.5 text-base sm:text-sm text-stone-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#284235]"
                />
              </div>
            )}
          </div>
        )}

        {/* Form, the same fields as Redigera recept */}
        {activeImportMode === 'manual' && (
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
        )}

        {/* The main button, always in view: Spara, Hämta or Fyll i depending on the choice above */}
        {!(activeImportMode === 'ocr' && (!ocrReviewMode || isOcrLoading)) && (
        <div className="px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-[#EBE7DF] bg-white shrink-0">
          {activeImportMode === 'manual' && (
            <button type="submit" form="add-recipe-form" disabled={!title.trim()} className={footerButton}>
              <Check className="w-4 h-4" />
              Spara recept
            </button>
          )}
          {activeImportMode === 'url' && (
            <button type="submit" form="url-form" disabled={isUrlFetching || !sourceUrl.trim()} className={footerButton}>
              {isUrlFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isUrlFetching ? 'Hämtar receptet' : 'Hämta receptet'}
            </button>
          )}
          {activeImportMode === 'paste' && (
            <button type="button" onClick={handleParsePastedText} disabled={!pastedRecipeText.trim()} className={footerButton}>
              Fyll i receptet
            </button>
          )}
          {activeImportMode === 'ocr' && ocrReviewMode && !isOcrLoading && (
            <button type="button" onClick={handleApplyOcrReviewText} disabled={!ocrReviewText.trim()} className={footerButton}>
              Fyll i receptet
            </button>
          )}
        </div>
        )}

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
