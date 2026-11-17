import { Flag, Minus, Plus, Trash } from 'lucide-react';
import { useState, type CSSProperties } from 'react';

import type { Tune } from '../app/useTune';
import { helpItems, SettingCard } from '../components/SettingCard';
import { Button, Note, Segmented } from '../components/ui';
import { applyStatus, RIVAL_CAPS } from '../state/devices';
import {
  addStage,
  deleteStage,
  makeStart,
  quickPicks,
  setSelectedDpi,
  sliderFraction,
  type DpiState,
} from '../state/dpi';

/** One colour per stage position, so the tiles are easy to tell apart. */
const STAGE_COLORS = ['#505ac8', '#0092d2', '#16bbbc', '#7cdf81', '#f1e758'];

export function Performance({ tune }: { tune: Tune }) {
  const { t } = tune.i18n;
  const caps = tune.selected.summary.caps ?? RIVAL_CAPS;
  const d = tune.device;
  const selected = Math.min(tune.dpiSelected ?? d.startStage, d.dpiStages.length - 1);
  const state: DpiState = { stages: d.dpiStages, start: d.startStage, selected };
  const value = d.dpiStages[selected] ?? caps.dpiMin;
  const [draft, setDraft] = useState<string | null>(null);
  const status = (group: 'dpi' | 'rate') => applyStatus(group, d, tune.paused, tune.groupStatus[group]);

  const apply = (next: DpiState | null) => {
    setDraft(null);
    if (next) tune.setDpi(next);
  };
  const setValue = (dpi: number) => apply(setSelectedDpi(state, dpi, caps));
  const commitDraft = () => {
    if (draft === null) return;
    const n = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(n)) setDraft(null);
    else setValue(n);
  };

  return (
    <div className="stack stack-20">
      <h1 className="h1">{t('perf')}</h1>

      <SettingCard
        id="dpi"
        title={t('dpiStages')}
        note={t('testedOne')}
        status={status('dpi')}
        help={helpItems(tune.i18n, 'dpi', tune.sendsSettings)}
      >
        <div role="group" aria-label={t('stagesGroup')} className="tiles">
          {d.dpiStages.map((dpi, i) => (
            <button
              key={i}
              type="button"
              className="tile"
              aria-pressed={i === selected}
              aria-label={t(i === d.startStage ? 'stageAriaStart' : 'stageAria', { n: i + 1, dpi })}
              onClick={() => {
                setDraft(null);
                tune.selectStage(i);
              }}
            >
              <span className="num">{i + 1}</span>
              <span className="value">{dpi}</span>
              <span aria-hidden className="swatch-bar" style={{ background: STAGE_COLORS[i % STAGE_COLORS.length] }} />
              <span className="grow" />
              {i === d.startStage && <Flag aria-hidden size={16} className="flag" />}
            </button>
          ))}
          {d.dpiStages.length < caps.maxStages && (
            <button type="button" className="tile add" aria-label={t('addStage')} onClick={() => apply(addStage(state, caps))}>
              <Plus aria-hidden size={22} />
            </button>
          )}
        </div>

        <div className="box">
          <div className="cell stack stack-12">
            <div className="dpi-readout">
              <div className="stack" style={{ gap: 0 }}>
                <label htmlFor="dpi-range">DPI</label>
                <span className="small-2">
                  {t('stageN', { n: selected + 1 })}
                  {selected === d.startStage && ` · ${t('start')}`}
                </span>
              </div>
              <span aria-hidden className="dpi-big">
                {value}
              </span>
            </div>
            <div className="range" style={{ '--frac': sliderFraction(value, caps) } as CSSProperties}>
              <input
                id="dpi-range"
                type="range"
                min={caps.dpiMin}
                max={caps.dpiMax}
                step={caps.dpiStep}
                value={value}
                aria-valuetext={`${value} DPI`}
                onChange={(e) => setValue(Number(e.target.value))}
              />
              <span aria-hidden className="track" />
              <span aria-hidden className="fill" />
              <span aria-hidden className="thumb" />
            </div>
            <div aria-hidden className="range-ends">
              <span>{caps.dpiMin}</span>
              <span>{caps.dpiMax}</span>
            </div>
            <div className="row-wrap" style={{ gap: '12px 16px' }}>
              <div className="row-wrap" style={{ flexWrap: 'nowrap' }}>
                <button
                  type="button"
                  className="btn icon"
                  aria-label={t('dec', { step: caps.dpiStep })}
                  disabled={value <= caps.dpiMin}
                  onClick={() => setValue(value - caps.dpiStep)}
                >
                  <Minus aria-hidden size={18} />
                </button>
                <input
                  type="number"
                  className="number-input"
                  aria-label={t('dpiValue')}
                  inputMode="numeric"
                  min={caps.dpiMin}
                  max={caps.dpiMax}
                  step={caps.dpiStep}
                  value={draft ?? String(value)}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitDraft}
                  onKeyDown={(e) => e.key === 'Enter' && commitDraft()}
                />
                <button
                  type="button"
                  className="btn icon"
                  aria-label={t('inc', { step: caps.dpiStep })}
                  disabled={value >= caps.dpiMax}
                  onClick={() => setValue(value + caps.dpiStep)}
                >
                  <Plus aria-hidden size={18} />
                </button>
              </div>
              <div role="group" aria-label={t('quick')} className="row-wrap quick">
                {quickPicks(caps).map((pick) => (
                  <button key={pick} type="button" aria-pressed={pick === value} onClick={() => setValue(pick)}>
                    {pick}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="cell row-wrap">
            <Button icon={Flag} disabled={selected === d.startStage} onClick={() => apply(makeStart(state))}>
              {t('makeStart')}
            </Button>
            <Button icon={Trash} disabled={d.dpiStages.length <= 1} onClick={() => apply(deleteStage(state))}>
              {t('delStage')}
            </Button>
          </div>
        </div>

        <div className="stack" style={{ gap: 4 }}>
          <p className="small-2">{t('dpiNote')}</p>
          <Note>{t('dpiStored')}</Note>
          <Note>{t('dpiSuggest')}</Note>
        </div>
      </SettingCard>

      <SettingCard
        id="rate"
        title={t('rateTitle')}
        note={t('testedOne')}
        status={status('rate')}
        help={helpItems(tune.i18n, 'rate', tune.sendsSettings)}
      >
        <Segmented
          labelledBy="rate-title"
          className="numbers"
          value={d.pollRateHz}
          onChange={tune.setRate}
          options={caps.pollRates.map((hz) => ({
            value: hz,
            label: (
              <>
                {hz}
                <small>Hz</small>
              </>
            ),
          }))}
        />
        <p className="small-2">{t('rateNote', { max: Math.max(...caps.pollRates) })}</p>
      </SettingCard>
    </div>
  );
}
