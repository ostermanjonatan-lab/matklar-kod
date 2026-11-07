import React from 'react';
import { InfoSheet, sheetHeading as h, sheetText as p } from './InfoSheet';

/** The terms for using MatKlar. Opened from Settings. */
export const TermsSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <InfoSheet title="Användarvillkor" onClose={onClose}>
    <h3 className={h}>Appen</h3>
    <p className={p}>
      MatKlar är gratis och görs på fritiden. Den finns som den är, utan löfte om att den alltid fungerar eller
      att inget försvinner. Spara gärna recepten i en fil då och då, under Säkerhetskopia.
    </p>

    <h3 className={h}>Recept från andra</h3>
    <p className={p}>
      Recept som hämtas från en webbsida tillhör den som skrev dem, och bilderna tillhör den som tog dem. Appen
      sparar en kopia för ditt eget bruk i köket och visar alltid varifrån receptet kommer. Använd dem inte på
      annat sätt än vad källan tillåter.
    </p>

    <h3 className={h}>Det du delar</h3>
    <p className={p}>
      Delar du ett recept med en länk eller som bild, ansvarar du för att du får dela det. Det gäller också
      bilder och texter du själv lägger in.
    </p>

    <h3 className={h}>Hushållet</h3>
    <p className={p}>
      Alla med hushållets kod kan se och ändra recept, veckoplan och inköpslista. Ge bara koden till dem du bor
      med, och byt kod om den kommit i fel händer.
    </p>

    <h3 className={h}>Ändringar</h3>
    <p className={p}>
      Villkoren kan ändras när appen ändras. Större ändringar står under Nyheter.
    </p>
  </InfoSheet>
);
