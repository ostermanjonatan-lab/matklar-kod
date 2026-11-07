import React from 'react';
import { InfoSheet } from './InfoSheet';
import { CHANGELOG } from '../../data/changelog';
import { formatDayMonth } from '../../utils/mealPlanDates';

/** What has changed in the app, newest first. */
export const ChangelogSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <InfoSheet title="Nyheter" onClose={onClose}>
    {CHANGELOG.map((entry) => (
      <section key={entry.version} className="pt-4">
        <h3 className="flex items-baseline justify-between gap-3">
          <span className="font-semibold text-stone-900">Version {entry.version}</span>
          <span className="text-xs text-stone-500">{formatDayMonth(entry.date)}</span>
        </h3>
        <ul className="mt-1 divide-y divide-[#EBE7DF]">
          {entry.items.map((item) => (
            <li key={item} className="py-2 text-sm text-stone-700 leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      </section>
    ))}
  </InfoSheet>
);
