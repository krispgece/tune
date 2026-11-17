import { Gauge, Info, Lightbulb, Settings, type LucideIcon } from 'lucide-react';

import type { Screen, Tune } from '../app/useTune';
import { DeviceIcon } from '../components/ui';
import type { StringKey } from '../i18n';
import { connectionKey, LIST_STATUS_TEXT, listStatus, type ListStatus } from '../state/devices';

const DOT: Record<ListStatus, string> = {
  connected: 'ok',
  noperm: 'warn',
  paused: 'warn',
  unplugged: '',
  unsupported: '',
};

const SECTIONS: { screen: Screen; key: StringKey; icon: LucideIcon }[] = [
  { screen: 'perf', key: 'perf', icon: Gauge },
  { screen: 'light', key: 'light', icon: Lightbulb },
  { screen: 'device', key: 'device', icon: Info },
];

function NavButton({ tune, screen, label, icon: Icon }: { tune: Tune; screen: Screen; label: string; icon: LucideIcon }) {
  return (
    <button
      type="button"
      className="nav-btn"
      aria-current={tune.screen === screen ? 'page' : undefined}
      onClick={() => tune.setScreen(screen)}
    >
      <Icon aria-hidden size={20} strokeWidth={1.75} />
      <span>{label}</span>
    </button>
  );
}

export function Sidebar({ tune }: { tune: Tune }) {
  const { t } = tune.i18n;
  const onSettings = tune.screen === 'settings';
  return (
    <div className="sidebar">
      <div className="stack">
        <h2 id="devlist-title" className="eyebrow">
          {t('devices')}
        </h2>
        <ul aria-labelledby="devlist-title" className="device-list">
          {tune.entries.map((entry) => {
            const status = listStatus(entry, tune.paused);
            const current = !onSettings && entry.summary.id === tune.selected.summary.id;
            return (
              <li key={entry.summary.id} style={{ display: 'flex', minWidth: 0 }}>
                <button
                  type="button"
                  className="device-btn"
                  aria-current={current ? 'true' : undefined}
                  onClick={() => tune.pick(entry.summary.id)}
                >
                  <DeviceIcon kind={entry.summary.kind} />
                  <span className="text">
                    <span className="name">{entry.summary.name}</span>
                    <span className="sub">{t(connectionKey(entry.summary))}</span>
                    <span className="status-line">
                      <span aria-hidden className={`dot ${DOT[status]}`} />
                      <span>{t(LIST_STATUS_TEXT[status])}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {tune.selected.summary.page && (
        <nav aria-label={t('sections')} className="section-nav">
          {SECTIONS.map((section) => (
            <NavButton key={section.screen} tune={tune} screen={section.screen} label={t(section.key)} icon={section.icon} />
          ))}
        </nav>
      )}
      <div className="nav-settings">
        <NavButton tune={tune} screen="settings" label={t('settings')} icon={Settings} />
      </div>
    </div>
  );
}
