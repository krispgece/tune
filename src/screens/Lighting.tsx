import { Check } from 'lucide-react';

import type { Tune } from '../app/useTune';
import type { Zones } from '../backend';
import { MousePreview, ZoneGlyph } from '../components/art';
import { helpItems, SettingCard } from '../components/SettingCard';
import { Note, Segmented } from '../components/ui';
import type { StringKey } from '../i18n';
import { applyStatus } from '../state/devices';
import { colorName, litZones, PRESETS } from '../state/lighting';
import { bestText } from '../theme/color';

const ZONES: { zone: keyof Zones; key: StringKey }[] = [
  { zone: 'front', key: 'zFront' },
  { zone: 'middle', key: 'zMiddle' },
  { zone: 'rear', key: 'zRear' },
];

export function Lighting({ tune }: { tune: Tune }) {
  const { t } = tune.i18n;
  const d = tune.device;
  const lit = litZones(d);
  const label = lit
    ? t('previewOn', {
        front: colorName(lit.front, tune.i18n),
        middle: colorName(lit.middle, tune.i18n),
        rear: colorName(lit.rear, tune.i18n),
      })
    : t('previewOff');
  const presetIndex = PRESETS.findIndex((p) => p.hex === d.color);

  return (
    <div className="stack stack-20">
      <h1 className="h1">{t('light')}</h1>
      <SettingCard
        id="light"
        title={t('lightColour')}
        note={t('lightVerified')}
        status={applyStatus('light', d, tune.paused, tune.groupStatus.light)}
        help={helpItems(tune.i18n, 'light', tune.sendsSettings)}
      >
        <div className={`light-layout${lit ? '' : ' off'}`}>
          <div className="hero">
            <MousePreview colors={lit} label={label} />
          </div>
          <div className="box light-panel">
            <div className="cell stack">
              <span id="mode-label" className="label-small">
                {t('lightMode')}
              </span>
              <Segmented
                labelledBy="mode-label"
                value={d.lightMode}
                onChange={tune.setLightMode}
                options={[
                  { value: 'single', label: t('lmSingle') },
                  { value: 'zones', label: t('lmZones') },
                  { value: 'off', label: t('lmOff') },
                ]}
              />
            </div>

            {d.lightMode === 'single' && (
              <>
                <div className="cell stack stack-12">
                  <span id="presets-label" className="label-small">
                    {t('presets')}
                  </span>
                  <div role="group" aria-labelledby="presets-label" className="swatches">
                    {PRESETS.map((preset, i) => (
                      <button
                        key={preset.hex}
                        type="button"
                        className="swatch"
                        aria-label={t(preset.key)}
                        title={t(preset.key)}
                        aria-pressed={i === presetIndex}
                        style={{ background: preset.hex, color: bestText(preset.hex) }}
                        onClick={() => tune.pickColor(preset.hex)}
                      >
                        {i === presetIndex && <Check aria-hidden size={20} />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="cell color-row">
                  <label htmlFor="custom-color">{t('custom')}</label>
                  <code>{d.color.toUpperCase()}</code>
                  <input
                    id="custom-color"
                    type="color"
                    className={`color-input${presetIndex < 0 ? ' picked' : ''}`}
                    value={d.color}
                    onChange={(e) => tune.pickColor(e.target.value)}
                  />
                </div>
              </>
            )}

            {d.lightMode === 'zones' && (
              <>
                {ZONES.map(({ zone, key }) => (
                  <div key={zone} className="cell color-row zone">
                    <ZoneGlyph zone={zone} color={d.zones[zone]} />
                    <label htmlFor={`zone-${zone}`}>{t(key)}</label>
                    <code>{d.zones[zone].toUpperCase()}</code>
                    <input
                      id={`zone-${zone}`}
                      type="color"
                      className="color-input"
                      value={d.zones[zone]}
                      onChange={(e) => tune.setZone(zone, e.target.value)}
                    />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
        <ul className="stack">
          <li>
            <Note>{t('waveNote')}</Note>
          </li>
          <li>
            <Note>{t('saveNote')}</Note>
          </li>
        </ul>
      </SettingCard>
    </div>
  );
}
