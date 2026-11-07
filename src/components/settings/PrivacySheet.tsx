import React from 'react';
import { X } from 'lucide-react';

/** What MatKlar saves, where, and how to remove it. Opened from Settings. */
export const PrivacySheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const h = 'font-semibold text-stone-900 pt-4';
  const p = 'text-sm text-stone-700 leading-relaxed mt-1';
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center animate-fade-in font-sans"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-title"
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[90dvh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-3 border-b border-[#EBE7DF] flex items-center justify-between shrink-0">
          <h2 id="privacy-title" className="font-serif font-bold text-lg text-stone-900">
            Personuppgifter
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-100 touch-manipulation"
            aria-label="Stäng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <h3 className={h}>Utan hushåll</h3>
          <p className={p}>
            Allt du lägger in sparas bara på den här telefonen, i webbläsarens lagring. Inget av det skickas till någon server.
          </p>

          <h3 className={h}>Med hushåll</h3>
          <p className={p}>
            Recept, veckoplan, inköpslista, Hemmet, val av avdelningar, hushållets namn och medlemmarnas namn sparas i
            en databas hos Supabase, så att alla i hushållet ser samma sak. Bilder du laddar upp sparas där också.
            Namnet är det du själv skriver in. Appen frågar inte efter e-post, telefonnummer eller lösenord.
          </p>

          <h3 className={h}>Recept från en länk</h3>
          <p className={p}>
            När du hämtar ett recept från en länk hämtas sidan via MatKlars server hos Vercel. Om det inte går används
            någon av tjänsterna Jina AI Reader, codetabs, allOrigins eller corsproxy.io. Då skickas bara receptets
            adress, inget om dig.
          </p>

          <h3 className={h}>Annat som hämtas</h3>
          <p className={p}>
            Bilderna till startrecepten hämtas från Unsplash, och läsningen av text i foton hämtar språkdata från
            jsDelivr. Som vid alla besök på en webbsida ser de tjänsterna telefonens IP-adress.
          </p>

          <h3 className={h}>Ta bort dina uppgifter</h3>
          <p className={p}>
            Lämna hushållet, eller ta bort det om du är administratör, under Hushåll här i Inställningar. Det som bara
            finns på telefonen tar du bort genom att rensa webbplatsens data i webbläsaren, eller genom att ta bort
            appen från hemskärmen.
          </p>
        </div>
      </div>
    </div>
  );
};
