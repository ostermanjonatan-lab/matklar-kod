import React, { useEffect, useState } from 'react';
import { Toast } from './Toast';
import { ChangelogSheet } from '../settings/ChangelogSheet';
import { APP_VERSION } from '../../version';
import { CHANGELOG } from '../../data/changelog';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';

const SEEN_KEY = 'matklar_seen_version';

/**
 * After an update, says so once with a way to read what is new. Not on the first start, and not
 * when the new version has nothing in the list.
 */
export const WhatsNew: React.FC = () => {
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  useModalBackHandler(open, () => setOpen(false), 'whats-new');

  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(SEEN_KEY);
      localStorage.setItem(SEEN_KEY, APP_VERSION);
    } catch {
      return;
    }
    if (!seen || seen === APP_VERSION) return;
    const seenIndex = CHANGELOG.findIndex((e) => e.version === seen);
    // Something is listed for a version newer than the one last seen
    if (seenIndex === 0) return;
    setShow(true);
    const timer = window.setTimeout(() => setShow(false), 8000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      {show && (
        <Toast
          message={`MatKlar är uppdaterad till version ${APP_VERSION}`}
          onDismiss={() => setShow(false)}
          actions={[
            {
              label: 'Visa nyheter',
              onClick: () => {
                setShow(false);
                setOpen(true);
              },
            },
          ]}
        />
      )}
      {open && <ChangelogSheet onClose={() => setOpen(false)} />}
    </>
  );
};
