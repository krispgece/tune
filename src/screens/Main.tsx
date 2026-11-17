import { FlaskConical, Info, RotateCw, TriangleAlert } from 'lucide-react';

import type { Tune } from '../app/useTune';
import { Button } from '../components/ui';
import { managedCount } from '../state/settings';
import { NoPermission, Unplugged } from './Access';
import { DeviceInfo } from './DeviceInfo';
import { Lighting } from './Lighting';
import { Performance } from './Performance';
import { SettingsScreen } from './SettingsScreen';
import { Unsupported } from './Unsupported';

function GuardBanner({ tune }: { tune: Tune }) {
  const { t } = tune.i18n;
  return (
    <div className="banner warn">
      <div role="status" className="message">
        <TriangleAlert aria-hidden size={20} strokeWidth={1.75} />
        <p>{t('guardBanner')}</p>
      </div>
      <div className="row-wrap">
        <Button variant="primary" icon={RotateCw} onClick={() => void tune.retry()}>
          {t('retry')}
        </Button>
        <Button onClick={tune.keepOff}>{t('keepOff')}</Button>
      </div>
    </div>
  );
}

export function Main({ tune }: { tune: Tune }) {
  const { t } = tune.i18n;
  const onDevice = tune.view === 'device';
  return (
    <main className="main">
      <div className="main-inner">
        {onDevice && !tune.sendsSettings && (
          <div role="note" className="banner">
            <FlaskConical aria-hidden size={20} strokeWidth={1.75} />
            <p>{t('previewBanner')}</p>
          </div>
        )}
        {onDevice && managedCount(tune.device) === 0 && (
          <div role="status" className="banner">
            <Info aria-hidden size={20} strokeWidth={1.75} />
            <p>{t('ownBanner')}</p>
          </div>
        )}
        {onDevice && tune.paused && !tune.guardHidden && <GuardBanner tune={tune} />}

        {onDevice && tune.screen === 'perf' && <Performance tune={tune} />}
        {onDevice && tune.screen === 'light' && <Lighting tune={tune} />}
        {onDevice && tune.screen === 'device' && <DeviceInfo tune={tune} />}
        {tune.view === 'settings' && <SettingsScreen tune={tune} />}
        {tune.view === 'unsupported' && <Unsupported tune={tune} />}
        {tune.view === 'unplugged' && <Unplugged tune={tune} />}
        {tune.view === 'noperm' && <NoPermission tune={tune} />}
      </div>
    </main>
  );
}
