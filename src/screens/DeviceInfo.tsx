import { Copy, FlaskConical, LogOut, RotateCw } from 'lucide-react';
import { useRef, useState, type ReactNode, type RefObject } from 'react';

import type { Tune } from '../app/useTune';
import { ReleaseDialog } from '../components/ReleaseDialog';
import { Button, DeviceIcon, Toast } from '../components/ui';
import { LIST_STATUS_TEXT, listStatus, RIVAL_CAPS } from '../state/devices';
import { diagnostics } from '../state/diagnostics';
import { managedCount } from '../state/settings';

export function Fact({ term, children, mono }: { term: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="cell">
      <dt>{term}</dt>
      <dd className={mono ? 'mono' : undefined} style={mono ? { fontSize: 14 } : undefined}>
        {children}
      </dd>
    </div>
  );
}

/** Moves focus once the dialog is gone. */
const focusSoon = (ref: RefObject<HTMLButtonElement | null>) => window.setTimeout(() => ref.current?.focus(), 0);

export function DeviceInfo({ tune }: { tune: Tune }) {
  const { t } = tune.i18n;
  const summary = tune.selected.summary;
  const caps = summary.caps ?? RIVAL_CAPS;
  const count = managedCount(tune.device);
  const groups = t(count === 1 ? 'groupsOne' : 'groupsMany', { n: count });
  const [releasing, setReleasing] = useState(false);
  const diagRef = useRef<HTMLButtonElement>(null);
  const releaseRef = useRef<HTMLButtonElement>(null);

  const management = count === 0 ? t('mgmtOff') : tune.paused ? t('mgmtPaused', { groups }) : t('mgmtOn', { groups });

  const copyDiagnostics = () => {
    if (!tune.info) return;
    const text = diagnostics(tune.i18n, {
      info: tune.info,
      device: summary,
      settings: tune.device,
      state: t(LIST_STATUS_TEXT[listStatus(tune.selected, tune.paused)]),
      accessAllowed: summary.access !== 'denied',
    });
    void tune.copy(text, 'device');
  };

  return (
    <div className="stack stack-20">
      <h1 className="h1">{t('device')}</h1>
      <section aria-labelledby="dev-title" className="card">
        <div className="row-wrap" style={{ gap: 12, flexWrap: 'nowrap' }}>
          <DeviceIcon kind={summary.kind} large />
          <h2 id="dev-title" className="h2">
            {summary.name}
          </h2>
        </div>

        <dl className="box facts">
          <Fact term={t('model')}>
            {summary.connection === 'wired' ? t('modelWired', { name: summary.name }) : summary.name}
          </Fact>
          <Fact term={t('usbId')} mono>
            {summary.usbId}
          </Fact>
          <Fact term={t('firmware')}>{t('firmwareVal')}</Fact>
          <Fact term={t('connection')}>{t('connectionVal', { max: Math.max(...caps.pollRates) })}</Fact>
          <Fact term={t('access')}>{summary.access === 'denied' ? t('accessNo') : t('accessVal')}</Fact>
          <div className="cell">
            <dt>{t('mgmt')}</dt>
            <dd className="with-action">
              <span aria-live="polite">{management}</span>
              {tune.paused && tune.guardHidden && (
                <Button icon={RotateCw} onClick={() => void tune.retry()}>
                  {t('retry')}
                </Button>
              )}
            </dd>
          </div>
        </dl>

        <div className="banner plain">
          <FlaskConical aria-hidden size={20} strokeWidth={1.75} />
          <div className="stack" style={{ gap: 4 }}>
            <h3 className="h3">{t('expTitle')}</h3>
            <p className="small-2">{t('expText')}</p>
          </div>
        </div>

        <div className="row-wrap" style={{ gap: '8px 12px' }}>
          <Button ref={diagRef} icon={Copy} onClick={copyDiagnostics}>
            {t('copyDiag')}
          </Button>
          <Button ref={releaseRef} icon={LogOut} disabled={count === 0} onClick={() => setReleasing(true)}>
            {t('stopManaging')}
          </Button>
          <Toast show={tune.toast === 'device'} />
        </div>
      </section>

      {releasing && (
        <ReleaseDialog
          onCancel={() => {
            setReleasing(false);
            focusSoon(releaseRef);
          }}
          onConfirm={() => {
            tune.stopManaging();
            setReleasing(false);
            focusSoon(diagRef);
          }}
        />
      )}
    </div>
  );
}
