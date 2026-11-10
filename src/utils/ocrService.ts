import { preprocessImageForOcr } from './imagePreprocessing';
import { parseRawRecipeText, type ParsedRecipeData } from './ingredientParser';
import { layoutBlocks, linesFromWords, recipeTextFromBlocks, wordsFromTsv, type ReadBlock } from './ocrLayout';

// Re-export all parsing functions and types so backwards-compatibility is 100% preserved
export * from './ingredientParser';

interface TsvWord {
  left: number;
  top: number;
  width: number;
  height: number;
  text: string;
}

function parseTsvData(tsv?: string | null): { words: TsvWord[]; pageWidth: number; pageHeight: number } {
  if (!tsv) return { words: [], pageWidth: 1000, pageHeight: 1000 };
  const lines = tsv.split('\n');
  const words: TsvWord[] = [];
  let pageWidth = 1000;
  let pageHeight = 1000;

  for (const l of lines) {
    const p = l.split('\t');
    if (p[0] === '1') {
      pageWidth = parseInt(p[8], 10) || 1000;
      pageHeight = parseInt(p[9], 10) || 1000;
    } else if (p[0] === '5' && p[11]?.trim()) {
      words.push({
        left: parseInt(p[6], 10) || 0,
        top: parseInt(p[7], 10) || 0,
        width: parseInt(p[8], 10) || 0,
        height: parseInt(p[9], 10) || 0,
        text: p[11].trim()
      });
    }
  }

  return { words, pageWidth, pageHeight };
}

/**
 * Checks if word layout indicates a multi-column page (e.g. ingredients left, instructions right).
 * Returns the X coordinate of the column divider gutter if found, otherwise null.
 */
function findTwoColumnGutter(words: TsvWord[], pageWidth: number): number | null {
  if (words.length < 20) return null;

  const minX = Math.round(pageWidth * 0.25);
  const maxX = Math.round(pageWidth * 0.75);

  let bestSplitX = -1;
  let minOverlap = Infinity;

  for (let x = minX; x <= maxX; x += 4) {
    const overlapping = words.filter(w => w.left < x && (w.left + w.width) > x).length;
    const leftCount = words.filter(w => w.left + w.width <= x).length;
    const rightCount = words.filter(w => w.left >= x).length;

    // Both columns must contain at least 15% of the page's words
    if (leftCount >= words.length * 0.15 && rightCount >= words.length * 0.15) {
      if (overlapping < minOverlap) {
        minOverlap = overlapping;
        bestSplitX = x;
      }
    }
  }

  // A two-column split is valid if overlapping words across the gutter is very low (< 7% of words)
  const isTwoColumn = bestSplitX > 0 && minOverlap <= Math.max(4, Math.round(words.length * 0.07));
  return isTwoColumn ? bestSplitX : null;
}

/**
 * Finds where the two-column section begins by checking where full-width header/intro text ends
 */
function findColumnTop(words: TsvWord[], gutterX: number, pageHeight: number): number {
  const crossingWords = words.filter(w =>
    w.top < pageHeight * 0.45 &&
    w.left < gutterX + 10 &&
    (w.left + w.width) > gutterX - 10 &&
    w.width > 20 &&
    !/^[-—–.]$/.test(w.text)
  );

  if (crossingWords.length === 0) return 0;
  const maxTop = Math.max(...crossingWords.map(w => w.top + w.height));
  return maxTop + 15;
}

/**
 * Execute client-side OCR on an image file or Data URL using tesseract.js.
 * Enhanced with:
 * 1. Automatic Canvas preprocessing (resizing, sharpening, contrast boost, adaptive binarization).
 * 2. Intelligent Two-Column Detection: Identifies multi-column cookbook layouts and scans
 *    each column individually to completely eliminate horizontal text mixing.
 * 3. Fallback binarization passes if initial scan yields low contrast text.
 */
export async function performClientOCR(
  imageSource: string | File | Blob,
  onProgress?: (progress: number, statusText: string) => void
): Promise<{ rawText: string; parsed: ParsedRecipeData; preprocessedDataUrl: string }> {

  if (onProgress) onProgress(10, 'Optimerar bildkontrast och skärpa...');

  let bestDataUrl = '';
  let bestRawText = '';
  // Set when the page was read by its layout: the text then has one ingredient or step per line
  let readByLayout = false;

  try {
    const prep1 = await preprocessImageForOcr(imageSource, {
      maxDimension: 2400,
      binarize: false,
      contrastBoost: 1.25,
      sharpen: true,
    });
    bestDataUrl = prep1.dataUrl;

    if (onProgress) onProgress(30, 'Initierar svensk OCR-modell...');

    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker(['swe', 'eng'], 1, {
      langPath: 'https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0_fast',
      logger: (m) => {
        if (onProgress && m.status) {
          if (m.status.includes('loading')) {
            onProgress(45, 'Laddar OCR-ordbok...');
          } else if (m.status.includes('recognizing')) {
            const p = Math.round(45 + (m.progress || 0) * 35);
            onProgress(p, `Läser text (${Math.round((m.progress || 0) * 100)}%)...`);
          }
        }
      },
    });

    try {
      // ── Pass 1: Scan with TSV to analyze layout and detect columns ─────────
      // Automatic page layout (Tesseract's own default here is one single block), so words in
      // different columns are not run together into one line
      await worker.setParameters({ tessedit_pageseg_mode: '3' as never });
      let ret1 = await worker.recognize(prep1.dataUrl, {}, { tsv: true });
      bestRawText = ret1.data.text || '';

      // ── Fallback Pass 2: Binarized (if pass 1 gave very little text) ───────
      if (bestRawText.trim().length < 80) {
        if (onProgress) onProgress(75, 'Applicerar binarisering för svag text...');
        try {
          const prep2 = await preprocessImageForOcr(imageSource, {
            maxDimension: 2400,
            binarize: true,
            contrastBoost: 1.3,
            sharpen: true,
          });
          const ret2 = await worker.recognize(prep2.dataUrl, {}, { tsv: true });
          if ((ret2.data.text || '').trim().length > bestRawText.trim().length) {
            ret1 = ret2;
            bestRawText = ret2.data.text;
            bestDataUrl = prep2.dataUrl;
          }
        } catch {}
      }

      // ── Reading by layout ───────────────────────────────────────────────
      // The page is cut into blocks along the empty space between them (columns, boxes), each
      // block is read on its own, and the blocks are put together as a recipe. See ocrLayout.ts.
      try {
        const layout = wordsFromTsv(ret1.data.tsv);
        const rects = layoutBlocks(layout.words, layout.pageWidth);
        if (rects.length >= 2) {
          if (onProgress) onProgress(82, 'Läser sidan del för del');
          // Each block as one even block of text
          await worker.setParameters({ tessedit_pageseg_mode: '6' as never });
          const blocks: ReadBlock[] = [];
          for (const rect of rects) {
            const r = await worker.recognize(bestDataUrl, { rectangle: rect }, { tsv: true });
            blocks.push({ rect, lines: linesFromWords(wordsFromTsv(r.data.tsv).words) });
          }
          const text = recipeTextFromBlocks(blocks, layout.pageHeight);
          if (text) {
            const check = parseRawRecipeText(text, { fromOcr: true, linesDone: true });
            if (check.ingredients.length >= 2 || check.instructions.length >= 2) {
              bestRawText = text;
              readByLayout = true;
            }
          }
        }
      } catch (layoutErr) {
        console.warn('Reading by layout failed, falling back to columns:', layoutErr);
      }

      // ── Multi-Column Detection & Separate Column Scanning ─────────────────
      // If cookbook page has 2 columns (e.g. ingredients left, instructions right),
      // scan each column independently to eliminate horizontal line stitching.
      const { words, pageWidth, pageHeight } = parseTsvData(ret1.data.tsv);
      const gutterX = readByLayout ? null : findTwoColumnGutter(words, pageWidth);

      if (gutterX && gutterX > 50 && gutterX < pageWidth - 50) {
        if (onProgress) onProgress(85, 'Två spalter upptäckta – läser kolumner var för sig...');
        try {
          const colTop = findColumnTop(words, gutterX, pageHeight);
          const colHeight = Math.round(pageHeight * 0.94) - colTop;

          // Extract header lines above colTop from the initial TSV pass
          const headerLines: string[] = [];
          if (colTop > 40) {
            const topWords = words.filter(w => w.top + w.height < colTop);
            const sorted = [...topWords].sort((a, b) => a.top - b.top || a.left - b.left);
            let curLine: TsvWord[] = [];
            let curY = -100;
            for (const w of sorted) {
              if (Math.abs(w.top - curY) > 10) {
                if (curLine.length > 0) {
                  curLine.sort((a, b) => a.left - b.left);
                  headerLines.push(curLine.map(x => x.text).join(' '));
                }
                curLine = [w];
                curY = w.top;
              } else {
                curLine.push(w);
              }
            }
            if (curLine.length > 0) {
              curLine.sort((a, b) => a.left - b.left);
              headerLines.push(curLine.map(x => x.text).join(' '));
            }
          }

          // Scan Left Column
          const leftRes = await worker.recognize(bestDataUrl, {
            rectangle: { left: 0, top: colTop, width: Math.min(pageWidth, gutterX + 5), height: colHeight }
          });
          const leftText = leftRes.data.text.trim();

          // Scan Right Column
          const rightLeft = Math.max(0, gutterX - 5);
          const rightRes = await worker.recognize(bestDataUrl, {
            rectangle: { left: rightLeft, top: colTop, width: pageWidth - rightLeft, height: colHeight }
          });
          const rightText = rightRes.data.text.trim();

          // Smart classification of which column is ingredients and which is instructions
          const stepRegex = /^(\d+[\.\)\-:,]|\b(steg\s*\d+[:\.\-])\s*)/i;
          const ingRegex = /^(\d+|[½¼¾⅓⅔⅛])\s*(g|kg|dl|ml|cl|liter|l|msk|tsk|krm|st|burk|pkt|påse|kruka|klyfta|skiva|bit|näve|kvist|blad|port)\b/i;
          const verbRegex = /^(?:skala|salta|peppra|rulla|skär|skiva|värm|fräs|lyft|lägg|ha i|häll|koka|blanda|sätt|låt|strö|vispa|stek|mät|pressa|servera|dela|rensa|hacka)\b/i;

          const leftLines = leftText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          const rightLines = rightText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

          let leftInstScore = 0;
          let leftIngScore = 0;
          for (const l of leftLines) {
            if (stepRegex.test(l)) leftInstScore += 3;
            if (verbRegex.test(l)) leftInstScore += 2;
            if (ingRegex.test(l)) leftIngScore += 2;
          }

          let rightInstScore = 0;
          let rightIngScore = 0;
          for (const l of rightLines) {
            if (stepRegex.test(l)) rightInstScore += 3;
            if (verbRegex.test(l)) rightInstScore += 2;
            if (ingRegex.test(l)) rightIngScore += 2;
          }

          // Determine if left is instructions or right is instructions
          const leftIsInstructions = (leftInstScore > rightInstScore) || (rightIngScore > leftIngScore);

          // Assemble structured multi-column text
          const parts: string[] = [];
          if (headerLines.length > 0) parts.push(headerLines.join('\n'));

          if (leftIsInstructions) {
            parts.push('INGREDIENSER:\n' + rightText);
            parts.push('GÖR SÅ HÄR:\n' + leftText);
          } else {
            parts.push('INGREDIENSER:\n' + leftText);
            parts.push('GÖR SÅ HÄR:\n' + rightText);
          }

          const twoColResult = parts.join('\n\n').trim();
          if (twoColResult.length > bestRawText.length * 0.5) {
            bestRawText = twoColResult;
          }
        } catch (colErr) {
          console.warn('Two-column scanning failed, falling back to full-page text:', colErr);
        }
      }
    } finally {

      await worker.terminate();
    }
  } catch (err) {
    console.error('OCR preprocessing/worker error:', err);
  }

  if (onProgress) onProgress(100, 'Strukturerar ingredienser och steg...');

  const parsed = parseRawRecipeText(bestRawText, { fromOcr: true, linesDone: readByLayout });
  return { rawText: bestRawText, parsed, preprocessedDataUrl: bestDataUrl };
}
