import type { Recipe } from '../types/recipe';
import {
  formatCookingTime,
  scaleIngredientAmount,
  formatAmount,
  cleanLeadingStepNumber,
  formatUnit,
  formatIngredientName,
} from './formatters';

/**
 * Formats a recipe into a clean, human-readable plain text format
 * suitable for sharing via WhatsApp, SMS, Messenger, Notes, email, etc.
 * Supports portion scaling so the shared text reflects the user's chosen servings.
 */
export function formatRecipeToShareText(recipe: Recipe, targetServings?: number): string {
  const portions = targetServings || recipe.servings || 4;
  const timeStr = formatCookingTime(recipe.prepTimeMinutes, recipe.cookTimeMinutes);

  const lines: string[] = [];

  // Title
  lines.push(recipe.title.trim());

  // Meta row (servings, time, category)
  const metaParts: string[] = [];
  metaParts.push(`${portions} ${portions === 1 ? 'portion' : 'portioner'}`);
  if (timeStr) {
    metaParts.push(timeStr);
  }
  if (recipe.category) {
    metaParts.push(recipe.category);
  }
  lines.push(metaParts.join(' • '));

  // Optional description
  if (recipe.description && recipe.description.trim()) {
    lines.push('');
    lines.push(recipe.description.trim());
  }

  // Ingredients
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    lines.push('');
    lines.push('INGREDIENSER:');
    recipe.ingredients.forEach((ing) => {
      const scaledAmount = scaleIngredientAmount(ing.amount, recipe.servings, portions);
      const amountStr = formatAmount(scaledAmount);
      const unit = formatUnit(ing.unit || '', scaledAmount).trim();
      const rawName = (ing.name || '').trim();
      const name = formatIngredientName(rawName, scaledAmount, ing.unit) || rawName;

      let line = '';
      if (amountStr && unit) {
        line = `• ${amountStr} ${unit} ${name}`;
      } else if (amountStr) {
        line = `• ${amountStr} ${name}`;
      } else if (unit && unit.toLowerCase() === 'efter smak') {
        line = `• ${name} efter smak`;
      } else if (unit) {
        line = `• ${unit} ${name}`;
      } else {
        line = `• ${name}`;
      }
      lines.push(line);
    });
  }

  // Instructions
  if (recipe.instructions && recipe.instructions.length > 0) {
    lines.push('');
    lines.push('GÖR SÅ HÄR:');
    recipe.instructions.forEach((inst, idx) => {
      const cleanText = cleanLeadingStepNumber(inst.text);
      const stepNum = inst.stepNumber || idx + 1;
      lines.push(`${stepNum}. ${cleanText}`);
    });
  }

  // Notes / Tips
  if (recipe.notes && recipe.notes.trim()) {
    lines.push('');
    lines.push('TIPS & ANTECKNINGAR:');
    lines.push(recipe.notes.trim());
  }

  // Source URL
  if (recipe.sourceUrl && recipe.sourceUrl.trim()) {
    lines.push('');
    lines.push(`Källa: ${recipe.sourceUrl.trim()}`);
  }

  return lines.join('\n');
}

/**
 * Robust copy-to-clipboard function that supports modern Clipboard API
 * with fallback to document.execCommand for older browsers or non-HTTPS/LAN environments.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  // Method 1: Modern Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below if permission was denied or insecure context
    }
  }

  // Method 2: execCommand fallback
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.fontSize = '12pt';
      textArea.style.border = '0';
      textArea.style.padding = '0';
      textArea.style.margin = '0';
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      textArea.setAttribute('readonly', '');
      document.body.appendChild(textArea);

      const isiOS = /ipad|iphone/i.test(navigator.userAgent);
      if (isiOS) {
        const range = document.createRange();
        range.selectNodeContents(textArea);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
        textArea.setSelectionRange(0, 999999);
      } else {
        textArea.select();
      }

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Helper to generate recipe text and copy it directly to clipboard.
 */
export async function shareRecipeAsText(
  recipe: Recipe,
  targetServings?: number
): Promise<{ success: boolean; text: string }> {
  const text = formatRecipeToShareText(recipe, targetServings);
  const success = await copyTextToClipboard(text);
  return { success, text };
}
