import { ArrowLeft, ArrowRight, Check, Globe, Lock, RotateCw, Search, Shield } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { FirstRunStep, Tune } from '../app/useTune';
import { Logo } from '../components/art';
import { Button, CheckList, DeviceIcon, LanguagePicker, Note } from '../components/ui';
import { connectionKey, foundKey, needsPermission } from '../state/devices';
import { ManualSection, PermMessage, ReplugHelp, Waiting } from './Access';

const STEPS: FirstRunStep[] = ['welcome', 'scan', 'perm', 'ready'];
/** The search shows for at least this long, so the step doesn't flash past. */
const MIN_SEARCH_MS = 1200;

export function FirstRun({ tune }: { tune: Tune }) {
  const { t, list } = tune.i18n;
  const step = tune.firstRunStep;
  const index = STEPS.indexOf(step);
  return (
    <div className="first-run">
      <section aria-labelledby="ob-title" className="card">
        <div className="stack stack-12">
          <p className="small-2" style={{ fontSize: 13, fontWeight: 600 }}>
            {t('stepOf', { n: index + 1, total: STEPS.length })}
          </p>
          <ol className="steps">
            {list('obNames').map((label, i) => (
              <li key={label} aria-current={i === index ? 'step' : undefined} className={i <= index ? 'done' : undefined}>
                <span aria-hidden className="bar" />
                <span>{label}</span>
              </li>
            ))}
          </ol>
        </div>
        {step === 'welcome' && <Welcome tune={tune} />}
        {step === 'scan' && <ScanStep tune={tune} />}
        {step === 'perm' && <PermissionStep tune={tune} />}
        {step === 'ready' && <ReadyStep tune={tune} />}
      </section>
    </div>
  );
}

function Welcome({ tune }: { tune: Tune }) {
  const { t } = tune.i18n;
  return (
    <div className="stack stack-24">
      <div className="stack stack-12" style={{ alignItems: 'flex-start' }}>
        <Logo size={56} />
        <h1 id="ob-title" className="h1">
          {t('welcomeTitle')}
        </h1>
        <p className="lead" style={{ maxWidth: 560 }}>
          {t('welcomeText')}
        </p>
      </div>
      <div className="box">
        <div className="cell row-wrap spread" style={{ gap: '8px 16px' }}>
          <span id="ob-lang-label" className="label-icon">
            <Globe aria-hidden size={18} />
            {t('language')}
          </span>
          <LanguagePicker labelledBy="ob-lang-label" style={{ flex: '0 1 260px' }} />
        </div>
      </div>
      <Note>{t('unofficial')}</Note>
      <div className="row-wrap end">
        <Button variant="primary" large iconAfter={ArrowRight} onClick={() => tune.setFirstRunStep('scan')}>
          {t('getStarted')}
        </Button>
      </div>
    </div>
  );
}

function ScanStep({ tune }: { tune: Tune }) {
  const { t } = tune.i18n;
  const { rescan } = tune;
  const [searching, setSearching] = useState(true);

  const search = useCallback(async () => {
    setSearching(true);
    await Promise.all([rescan(), new Promise((resolve) => setTimeout(resolve, MIN_SEARCH_MS))]);
    setSearching(false);
  }, [rescan]);

  useEffect(() => {
    void search();
  }, [search]);

  const devices = tune.scan?.devices ?? [];
  let result;
  if (searching) {
    result = (
      <p className="cell searching">
        <Search aria-hidden size={20} />
        <span>{t('scanning')}</span>
      </p>
    );
  } else if (tune.scanError) {
    result = <p className="cell body-2">{t('scanFailed', { error: tune.scanError })}</p>;
  } else if (devices.length === 0) {
    result = <p className="cell body-2">{t('noneFound')}</p>;
  } else {
    result = (
      <>
        <p className="cell found-count">{t(devices.length === 1 ? 'foundOne' : 'foundMany', { n: devices.length })}</p>
        {devices.map((d) => {
          const key = foundKey(d);
          const tone = key === 'foundReady' ? 'ok' : key === 'foundNeedsPerm' ? 'warn' : '';
          return (
            <div key={d.id} className="cell found">
              <DeviceIcon kind={d.kind} />
              <div className="name">
                <span style={{ fontSize: 15, fontWeight: 600 }}>{d.name}</span>
                <span className="caption">{t(connectionKey(d))}</span>
              </div>
              <span className="status-line">
                <span aria-hidden className={`dot ${tone}`} />
                <span>{t(key)}</span>
              </span>
            </div>
          );
        })}
      </>
    );
  }

  return (
    <div className="stack stack-24">
      <div className="stack">
        <h1 id="ob-title" className="h1">
          {t('scanTitle')}
        </h1>
        <p className="body-2">{t('scanText')}</p>
      </div>
      <div role="status" aria-live="polite" className="box">
        {result}
      </div>
      <Note>{t('scanLater')}</Note>
      <div className="row-wrap spread">
        <Button icon={ArrowLeft} onClick={() => tune.setFirstRunStep('welcome')}>
          {t('back')}
        </Button>
        <div className="row-wrap">
          <Button icon={RotateCw} disabled={searching} onClick={() => void search()}>
            {t('scanAgain')}
          </Button>
          <Button
            variant="primary"
            large
            iconAfter={ArrowRight}
            disabled={searching}
            onClick={() => tune.setFirstRunStep(needsPermission(tune.scan) ? 'perm' : 'ready')}
          >
            {t('next')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PermissionStep({ tune }: { tune: Tune }) {
  const { t } = tune.i18n;
  return (
    <div className="stack stack-24">
      <div className="stack">
        <h1 id="ob-title" className="h1">
          {t('permTitle')}
        </h1>
        <p className="body-2">{t('permText')}</p>
      </div>
      <div className="box pad stack stack-12">
        <h2 id="perm-what" className="h3">
          {t('permWhat')}
        </h2>
        <CheckList labelledBy="perm-what" items={[t('perm1'), t('perm2'), t('perm3'), t('perm4')]} />
      </div>
      {tune.replug ? (
        <>
          <ReplugHelp tune={tune} toast="perm" />
          <div className="row-wrap spread">
            <Button icon={ArrowLeft} onClick={() => tune.setFirstRunStep('scan')}>
              {t('back')}
            </Button>
            <Button onClick={() => void tune.finishFirstRun('noperm')}>{t('notNow')}</Button>
          </div>
        </>
      ) : (
        <>
          {tune.perm === 'waiting' ? (
            <Waiting tune={tune} />
          ) : (
            <div className="stack">
              <div className="row-wrap spread">
                <Button icon={ArrowLeft} onClick={() => tune.setFirstRunStep('scan')}>
                  {t('back')}
                </Button>
                <div className="row-wrap">
                  <Button onClick={() => void tune.finishFirstRun('noperm')}>{t('notNow')}</Button>
                  <Button variant="primary" large icon={Shield} onClick={() => void tune.allow('firstRun')}>
                    {t('allow')}
                  </Button>
                </div>
              </div>
              <Note icon={Lock}>{t('pwNote')}</Note>
            </div>
          )}
          <PermMessage tune={tune} />
          <ManualSection tune={tune} place="firstRun" />
          <p className="caption">{t('pkgNote')}</p>
        </>
      )}
    </div>
  );
}

function ReadyStep({ tune }: { tune: Tune }) {
  const { t } = tune.i18n;
  const supported = tune.scan?.devices.find((d) => d.page);
  return (
    <div className="stack stack-24">
      <div className="stack stack-12" style={{ alignItems: 'flex-start' }}>
        <span aria-hidden className="ready-mark">
          <Check size={28} strokeWidth={2.2} />
        </span>
        <h1 id="ob-title" className="h1">
          {t('readyTitle')}
        </h1>
        <p className="lead">{supported ? t('readyText', { device: supported.name }) : t('readyTextNone')}</p>
      </div>
      <div className="box pad">
        <CheckList items={[t('ready1'), t('ready2'), t('ready3')]} />
      </div>
      <div className="row-wrap end">
        <Button variant="primary" large iconAfter={ArrowRight} onClick={() => void tune.finishFirstRun('own')}>
          {t('openApp')}
        </Button>
      </div>
    </div>
  );
}
