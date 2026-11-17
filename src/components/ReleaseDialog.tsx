import { useEffect, useRef, type KeyboardEvent } from 'react';

import { useI18n } from '../i18n/context';

/** Asks before the app stops managing the mouse. Focus stays inside until it closes; Escape cancels. */
export function ReleaseDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const { t } = useI18n();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => cancelRef.current?.focus(), []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key !== 'Tab') return;
    if (e.shiftKey && e.target === cancelRef.current) {
      e.preventDefault();
      confirmRef.current?.focus();
    } else if (!e.shiftKey && e.target === confirmRef.current) {
      e.preventDefault();
      cancelRef.current?.focus();
    }
  };

  return (
    <div className="overlay">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-title"
        aria-describedby="release-desc"
        className="dialog"
        onKeyDown={onKeyDown}
      >
        <h2 id="release-title" className="h2">
          {t('stopManaging')}
        </h2>
        <p id="release-desc" className="body-2">
          {t('relDesc')}
        </p>
        <div className="row-wrap end">
          <button ref={cancelRef} type="button" className="btn" onClick={onCancel}>
            {t('cancel')}
          </button>
          <button ref={confirmRef} type="button" className="btn primary" onClick={onConfirm}>
            {t('stopManaging')}
          </button>
        </div>
      </div>
    </div>
  );
}
