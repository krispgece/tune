// The permission pieces shared by the first run, the "needs permission" page and Settings.
import { Info, LoaderCircle, Lock, Shield, TriangleAlert } from 'lucide-react';

import type { Place, Tune } from '../app/useTune';
import { UnpluggedArt } from '../components/art';
import { Commands } from '../components/Commands';
import { Button, Disclosure } from '../components/ui';
import { installCommands, RULE_FILE_NAME } from '../state/commands';

export function Waiting({ tune, center }: { tune: Tune; center?: boolean }) {
  return (
    <p role="status" className={`banner${center ? ' center' : ''}`}>
      <LoaderCircle aria-hidden size={20} className="spin" />
      <span>{tune.i18n.t('waiting')}</span>
    </p>
  );
}

/** Why the commands are shown: the button can't install the rule yet, or the rule still isn't in place. */
export function PermMessage({ tune }: { tune: Tune }) {
  const { t } = tune.i18n;
  if (tune.perm === 'notAvailable') {
    return (
      <p role="status" className="banner">
        <Info aria-hidden size={20} strokeWidth={1.75} />
        <span>{t('allowLater')}</span>
      </p>
    );
  }
  if (tune.perm === 'stillDenied') {
    return (
      <p role="status" className="banner caution">
        <TriangleAlert aria-hidden size={20} strokeWidth={1.75} />
        <span>{t('stillNoPerm')}</span>
      </p>
    );
  }
  return null;
}

export function installLines(tune: Tune): string[] {
  return installCommands(tune.rule ?? { fileName: RULE_FILE_NAME, source: null });
}

export function ManualSection({ tune, place }: { tune: Tune; place: Place }) {
  const { t } = tune.i18n;
  const id = `manual-${place}`;
  const lines = installLines(tune);
  return (
    <div className="manual">
      <Disclosure open={tune.manualOpen} onToggle={() => tune.setManualOpen(!tune.manualOpen)} controls={id}>
        {t('manual')}
      </Disclosure>
      <div id={id} className="stack stack-12" hidden={!tune.manualOpen}>
        <p className="small-2">{t('manualText')}</p>
        <Commands
          lines={lines}
          copied={tune.toast === 'perm'}
          onCopy={() => void tune.copy(lines.join('\n'), 'perm')}
          onCheckAgain={() => void tune.checkAgain(place)}
        />
      </div>
    </div>
  );
}

export function Unplugged({ tune }: { tune: Tune }) {
  const { t } = tune.i18n;
  return (
    <section aria-labelledby="unplugged-title" className="card empty-state">
      <UnpluggedArt />
      <h1 id="unplugged-title" className="h1">
        {t('unplTitle')}
      </h1>
      <p>{t('unplText')}</p>
    </section>
  );
}

export function NoPermission({ tune }: { tune: Tune }) {
  const { t } = tune.i18n;
  return (
    <section aria-labelledby="noperm-title" className="card noperm">
      <div className="intro">
        <span aria-hidden className="lock">
          <Lock size={28} strokeWidth={1.75} />
        </span>
        <h1 id="noperm-title" className="h1">
          {t('npTitle')}
        </h1>
        <p>{t('npText')}</p>
      </div>
      <div className="actions stack" style={{ gap: 16 }}>
        {tune.perm === 'waiting' ? (
          <Waiting tune={tune} center />
        ) : (
          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            <Button variant="primary" large icon={Shield} onClick={() => void tune.allow('app')}>
              {t('allow')}
            </Button>
          </div>
        )}
        <PermMessage tune={tune} />
        <ManualSection tune={tune} place="app" />
      </div>
    </section>
  );
}
