import { Copy, RotateCw, TriangleAlert } from 'lucide-react';

import { useI18n } from '../i18n/context';
import { Button, Note, Toast } from './ui';

/** Terminal commands with Copy, an optional Check again, and the warning never to run the app with sudo. */
export function Commands(props: {
  lines: string[];
  copied: boolean;
  onCopy: () => void;
  onCheckAgain?: () => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <div className="code">
        {/* Focusable so the keyboard can scroll a long line; lines never wrap, so they read as typed. */}
        <pre tabIndex={0} aria-label={t('cmdLabel')}>
          <code>{props.lines.join('\n')}</code>
        </pre>
      </div>
      <div className="row-wrap" style={{ gap: '8px 12px' }}>
        <Button icon={Copy} onClick={props.onCopy}>
          {t('copy')}
        </Button>
        {props.onCheckAgain && (
          <Button icon={RotateCw} onClick={props.onCheckAgain}>
            {t('checkAgain')}
          </Button>
        )}
        <Toast show={props.copied} />
      </div>
      <Note icon={TriangleAlert} strong>
        {t('noSudo')}
      </Note>
    </>
  );
}
