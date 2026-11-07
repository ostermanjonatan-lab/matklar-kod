import React from 'react';
import { InfoSheet, sheetHeading as h, sheetText as p } from './InfoSheet';

/** What MatKlar saves, where, and how to remove it. Opened from Settings. */
export const PrivacySheet: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <InfoSheet title="Personuppgifter" onClose={onClose}>
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
      Under Avancerat i Inställningar finns Radera allt. Det tar bort hushållet ur databasen om du är
      administratör, annars bara dig, och sedan allt som är sparat på telefonen. Du kan också bara lämna
      hushållet under Hushåll.
    </p>
  </InfoSheet>
);
