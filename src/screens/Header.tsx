import { Moon, Sun } from 'lucide-react';

import type { Tune } from '../app/useTune';
import { SCENARIOS, type Scenario } from '../backend';
import { Logo } from '../components/art';
import type { StringKey } from '../i18n';
import { APP_NAME } from '../identity';

export function Header({ tune }: { tune: Tune }) {
  const { t } = tune.i18n;
  const dark = tune.mode === 'dark';
  return (
    <header className="header">
      <div className="brand">
        <Logo />
        <span className="brand-name">{APP_NAME}</span>
      </div>
      <button
        type="button"
        role="switch"
        className="theme-switch"
        aria-checked={dark}
        aria-label={t('darkTheme')}
        title={dark ? t('toLight') : t('toDark')}
        onClick={tune.toggleTheme}
      >
        <span aria-hidden className="knob" />
        <Sun aria-hidden size={18} className="sun" />
        <Moon aria-hidden size={18} className="moon" />
      </button>
    </header>
  );
}

const SCENARIO_NAMES: Record<Scenario, StringKey> = {
  setup: 'scSetup',
  normal: 'scNormal',
  own: 'scOwn',
  multi: 'scMulti',
  unplugged: 'scUnplugged',
  noperm: 'scNoperm',
  replug: 'scReplug',
  guard: 'scGuard',
};

/** Only with the mock backend: picks one of the approved mockup's situations. */
export function MockBar({ tune }: { tune: Tune }) {
  const { t } = tune.i18n;
  if (!tune.isMock) return null;
  return (
    <div role="group" aria-label={t('mockGroup')} className="mock-bar">
      <span className="eyebrow">{t('mockBar')}</span>
      <div className="controls">
        <label htmlFor="scenario">{t('state')}</label>
        <select
          id="scenario"
          className="select"
          value={tune.scan?.mockScenario ?? 'setup'}
          onChange={(e) => void tune.applyScenario(e.target.value as Scenario)}
        >
          {SCENARIOS.map((scenario) => (
            <option key={scenario} value={scenario}>
              {t(SCENARIO_NAMES[scenario])}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
