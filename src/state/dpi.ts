import type { MouseCaps } from '../backend/types';

/** The DPI stages being edited: `start` is where the mouse starts, `selected` is the stage shown for editing. */
export interface DpiState {
  stages: number[];
  start: number;
  selected: number;
}

export const QUICK_PICKS = [400, 800, 1600, 3200];

/** Rounds to the mouse's step and keeps the value in its range; a non-number becomes 800. */
export function clampDpi(value: number, caps: MouseCaps): number {
  const step = caps.dpiStep > 0 ? caps.dpiStep : 1;
  const n = Number.isFinite(value) ? Math.round(value / step) * step : 800;
  return Math.min(caps.dpiMax, Math.max(caps.dpiMin, n));
}

export function quickPicks(caps: MouseCaps): number[] {
  return QUICK_PICKS.filter((v) => v >= caps.dpiMin && v <= caps.dpiMax);
}

/** Each function returns the new state, or `null` when nothing changes. */
export function setSelectedDpi(state: DpiState, value: number, caps: MouseCaps): DpiState | null {
  const v = clampDpi(value, caps);
  if (state.stages[state.selected] === v) return null;
  const stages = state.stages.slice();
  stages[state.selected] = v;
  return { ...state, stages };
}

export function addStage(state: DpiState, caps: MouseCaps): DpiState | null {
  if (state.stages.length >= caps.maxStages) return null;
  const last = state.stages[state.stages.length - 1] ?? caps.dpiMin;
  const stages = [...state.stages, clampDpi(last * 2, caps)];
  return { ...state, stages, selected: stages.length - 1 };
}

export function deleteStage(state: DpiState): DpiState | null {
  if (state.stages.length <= 1) return null;
  const i = state.selected;
  const stages = state.stages.filter((_, k) => k !== i);
  let start = state.start;
  if (i < start) start -= 1;
  else if (i === start) start = Math.max(0, i - 1);
  start = Math.min(start, stages.length - 1);
  return { stages, start, selected: Math.min(i, stages.length - 1) };
}

export function makeStart(state: DpiState): DpiState | null {
  return state.selected === state.start ? null : { ...state, start: state.selected };
}

/** Where the selected value sits on the slider, 0 to 1. */
export function sliderFraction(value: number, caps: MouseCaps): number {
  const span = caps.dpiMax - caps.dpiMin;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (value - caps.dpiMin) / span));
}
