import { ChevronDown, Shield } from 'lucide-react';
import { useState } from 'react';

import type { Tune } from '../app/useTune';
import { Commands } from '../components/Commands';
import { Button, LanguagePicker, Segmented } from '../components/ui';
import { removeCommands, RULE_FILE_NAME } from '../state/commands';
import { installLines, PermMessage, ReplugHelp, Waiting } from './Access';

export function SettingsScreen({ tune }: { tune: Tune }) {
  const { t } = tune.i18n;
  const [licenses, setLicenses] = useState(false);
  const installedRule = tune.scan?.accessRule ?? null;
  const fileName = tune.rule?.fileName ?? RULE_FILE_NAME;
  const showInstall =
    !tune.accessAllowed && !tune.replug && (tune.perm === 'notAvailable' || tune.perm === 'stillDenied');
  const accessText = tune.accessAllowed ? 'accessOn' : tune.replug ? 'accessPending' : 'accessOff';
  const removeLines = removeCommands(installedRule, fileName);
  const installCommandLines = installLines(tune);

  return (
    <div className="stack stack-20">
      <h1 className="h1">{t('settings')}</h1>

      <section aria-labelledby="set-look-title" className="card">
        <h2 id="set-look-title" className="h2">
          {t('appearance')}
        </h2>
        <div className="box">
          <div className="cell row-wrap spread" style={{ gap: '8px 16px' }}>
            <span id="theme-label" className="label">
              {t('theme')}
            </span>
            <Segmented
              labelledBy="theme-label"
              value={tune.theme}
              onChange={tune.setTheme}
              style={{ flex: '0 1 320px' }}
              options={[
                { value: 'system', label: t('thSystem') },
                { value: 'light', label: t('thLight') },
                { value: 'dark', label: t('thDark') },
              ]}
            />
          </div>
          <div className="cell row-wrap spread" style={{ gap: '8px 16px' }}>
            <span id="lang-label" className="label">
              {t('language')}
            </span>
            <LanguagePicker labelledBy="lang-label" style={{ flex: '0 1 240px' }} />
          </div>
        </div>
      </section>

      <section aria-labelledby="set-start-title" className="card">
        <h2 id="set-start-title" className="h2">
          {t('startupTitle')}
        </h2>
        <div className="box">
          <div className="cell row-wrap spread" style={{ gap: '8px 16px' }}>
            <span id="login-label" className="label">
              {t('startAtLogin')}
            </span>
            <Segmented
              labelledBy="login-label"
              value={tune.autostart?.enabled ? 'on' : 'off'}
              onChange={(value) => void tune.setAutostart(value === 'on')}
              // A build that can't start at login can still turn off an entry another build left.
              disabled={!tune.autostart || (!tune.autostart.available && !tune.autostart.enabled)}
              style={{ flex: '0 1 200px' }}
              options={[
                { value: 'off', label: t('switchOff') },
                { value: 'on', label: t('switchOn') },
              ]}
            />
          </div>
          <p className="cell small-2">
            {t(
              tune.autostart?.available !== false
                ? 'startupText'
                : tune.autostart.enabled
                  ? 'startupDevOn'
                  : 'startupDev',
            )}
          </p>
          {tune.autostartFailed && (
            <p className="cell small-2" role="alert">
              {t('startupFailed')}
            </p>
          )}
          {tune.info?.tray && (
            <div className="cell stack" style={{ alignItems: 'flex-start' }}>
              <p className="small-2">{t('trayText')}</p>
              <button type="button" className="btn" onClick={() => void tune.quit()}>
                {t('trayQuit')}
              </button>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="set-access-title" className="card">
        <h2 id="set-access-title" className="h2">
          {t('accessTitle')}
        </h2>
        <div className="box">
          <div className="cell row-wrap spread" style={{ gap: '8px 16px' }}>
            <p className="icon-line">
              <Shield
                aria-hidden
                size={20}
                strokeWidth={1.75}
                style={{ color: tune.accessAllowed ? 'var(--ok-ink)' : 'var(--warn-ink)' }}
              />
              <span>{t(accessText)}</span>
            </p>
            {installedRule ? (
              <Button onClick={() => void tune.removeAccess()}>{t('removePerm')}</Button>
            ) : (
              !tune.accessAllowed &&
              tune.perm !== 'waiting' && (
                <Button variant="primary" onClick={() => void tune.allow('app')}>
                  {t('allow')}
                </Button>
              )
            )}
          </div>
          {!tune.accessAllowed && tune.perm === 'waiting' && (
            <div className="cell">
              <Waiting tune={tune} />
            </div>
          )}
          {showInstall && (
            <div className="cell stack stack-12">
              <PermMessage tune={tune} />
              <p className="small-2">{t('manualText')}</p>
              <Commands
                lines={installCommandLines}
                copied={tune.toast === 'settings'}
                onCopy={() => void tune.copy(installCommandLines.join('\n'), 'settings')}
                onCheckAgain={() => void tune.checkAgain('app')}
              />
            </div>
          )}
          {tune.replug && !tune.removeHelp && (
            <div className="cell">
              <ReplugHelp tune={tune} toast="settings" />
            </div>
          )}
          {(tune.accessAllowed || tune.replug) && tune.removeHelp && (
            <div className="cell stack stack-12">
              <p className="small-2">{t('removeLater')}</p>
              <Commands
                lines={removeLines}
                copied={tune.toast === 'settings'}
                onCopy={() => void tune.copy(removeLines.join('\n'), 'settings')}
              />
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="set-priv-title" className="card">
        <h2 id="set-priv-title" className="h2">
          {t('privacy')}
        </h2>
        <div className="box">
          <p className="cell icon-line">
            <Shield aria-hidden size={20} strokeWidth={1.75} style={{ color: 'var(--text-2)' }} />
            <span>{t('privacyText')}</span>
          </p>
        </div>
      </section>

      <section aria-labelledby="set-about-title" className="card">
        <h2 id="set-about-title" className="h2">
          {t('about')}
        </h2>
        <div className="box">
          <p className="cell" style={{ fontSize: 15 }}>
            {t('aboutVer', { version: tune.info?.version ?? '' })}
          </p>
          <p className="cell body-2">{t('frontend')}</p>
          <div className="cell stack">
            <h3 className="h3">{t('legalTitle')}</h3>
            {(['legal1', 'legal2', 'legal3', 'legal4'] as const).map((key) => (
              <p key={key} className="small-2">
                {t(key)}
              </p>
            ))}
          </div>
          <div className="cell stack">
            <h3 className="h3">{t('creditsTitle')}</h3>
            <p className="small-2">{t('credits')}</p>
          </div>
          <div className="cell stack" style={{ alignItems: 'flex-start' }}>
            <button
              type="button"
              className="btn"
              aria-expanded={licenses}
              aria-controls="licenses-text"
              onClick={() => setLicenses(!licenses)}
            >
              <span>{t('licenses')}</span>
              <ChevronDown aria-hidden size={16} className="chevron" />
            </button>
            <p id="licenses-text" className="small-2" hidden={!licenses}>
              {t('licensesText')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
