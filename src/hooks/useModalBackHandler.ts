import { useEffect, useRef } from 'react';

/**
 * useModalBackHandler
 *
 * Synchronizes a modal/sheet/drawer's open state with browser history (HTML5 History API).
 * This enables the physical or gesture Back button on Android (and desktop browsers) to close
 * the modal instead of navigating away or closing the PWA/website.
 *
 * - When `isOpen` becomes true, a history state is pushed.
 * - When Android Back is pressed, `popstate` fires, closing the modal without popping history again.
 * - When closed via UI (✕, backdrop, cancel/save button), history is popped so the stack stays clean.
 * - If navigation replaces the modal entry (e.g. opening a recipe from the modal), history is not double-popped.
 * - Includes StrictMode guard: rapid unmount/remount in development will NOT trigger premature history popping.
 */
export function useModalBackHandler(
  isOpen: boolean,
  onClose: () => void,
  modalId: string
): void {
  const modalKeyRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);
  const isClosingFromPopstateRef = useRef(false);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    // If a cleanup was pending from rapid unmount/remount (e.g. React StrictMode), cancel it!
    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }

    if (!isOpen) {
      // If isOpen became false from UI action, and the modal's entry is still at the top of history:
      if (modalKeyRef.current && !isClosingFromPopstateRef.current) {
        const keyToRemove = modalKeyRef.current;
        modalKeyRef.current = null;
        if (typeof window !== 'undefined' && window.history.state?.modalKey === keyToRemove) {
          window.history.back();
        }
      }
      isClosingFromPopstateRef.current = false;
      return;
    }

    if (typeof window === 'undefined') return;

    // Check if we already have an active history entry for this modal (e.g. from StrictMode remount)
    const existingKey = window.history.state?.modalKey;
    const isSameModalInState =
      existingKey &&
      window.history.state?.modalId === modalId &&
      (modalKeyRef.current === existingKey || !modalKeyRef.current);

    const key = isSameModalInState
      ? (existingKey as string)
      : `${modalId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    modalKeyRef.current = key;
    isClosingFromPopstateRef.current = false;

    if (window.history.state?.modalKey !== key) {
      const currentHistoryState = window.history.state || {};
      window.history.pushState(
        {
          ...currentHistoryState,
          receptAppModal: true,
          modalKey: key,
          modalId,
        },
        '',
        window.location.pathname + window.location.hash
      );
    }

    const handlePopState = (event: PopStateEvent) => {
      // If our modal was on top and the new history state no longer has our modalKey,
      // it means the user pressed the Android back button (or browser back).
      if (modalKeyRef.current && event.state?.modalKey !== modalKeyRef.current) {
        isClosingFromPopstateRef.current = true;
        modalKeyRef.current = null;
        onCloseRef.current();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);

      // Defer history.back() to protect against React StrictMode instant remounting.
      // If the component remounts immediately, cleanupTimer is cleared in the next effect run.
      const keyToRemove = modalKeyRef.current;
      const closingFromPopstate = isClosingFromPopstateRef.current;

      if (keyToRemove && !closingFromPopstate) {
        cleanupTimerRef.current = setTimeout(() => {
          cleanupTimerRef.current = null;
          if (modalKeyRef.current === keyToRemove) {
            modalKeyRef.current = null;
            if (typeof window !== 'undefined' && window.history.state?.modalKey === keyToRemove) {
              window.history.back();
            }
          }
        }, 80);
      }
    };
  }, [isOpen, modalId]);
}
