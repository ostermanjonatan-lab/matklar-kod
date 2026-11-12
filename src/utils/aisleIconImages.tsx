import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { aisleIconOf } from '../components/shopping/AisleIcon';

/**
 * The aisle icons as pictures that can be drawn on a canvas, for the shopping list picture.
 * Each icon is drawn once off screen and read back as an SVG, in the given colour.
 */
export async function loadAisleIconImages(aisles: string[], color: string): Promise<Map<string, HTMLImageElement>> {
  const result = new Map<string, HTMLImageElement>();
  await Promise.all(
    Array.from(new Set(aisles.filter(Boolean))).map(async (aisle) => {
      const Icon = aisleIconOf(aisle);
      const holder = document.createElement('div');
      const root = createRoot(holder);
      flushSync(() => root.render(<Icon width={48} height={48} strokeWidth={1.75} color={color} />));
      const svg = holder.innerHTML;
      root.unmount();
      const img = await new Promise<HTMLImageElement | null>((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      });
      if (img) result.set(aisle, img);
    })
  );
  return result;
}
