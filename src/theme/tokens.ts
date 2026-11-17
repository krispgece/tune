// The colour tokens for both themes. Accents are derived from one colour, so every pairing keeps WCAG contrast.
import { bestText, contrast, deepen, ensure, INK_LIGHT, mix, normalizeHex } from './color';

export type Mode = 'light' | 'dark';

/** The app's own accent, a lavender. Never SteelSeries orange. */
export const ACCENT = '#9f86ff';

interface Palette {
  bg: string;
  sideBg: string;
  surface: string;
  surface2: string;
  track: string;
  border: string;
  sep: string;
  borderStrong: string;
  text: string;
  text2: string;
  muted: string;
  inputBg: string;
  btnBg: string;
  btnBorder: string;
  okInk: string;
  warnInk: string;
  stage: string;
  stageLine: string;
  stageText: string;
  codeBg: string;
  overlay: string;
  shadow: string;
  modalShadow: string;
  barEdge: string;
  mouseBody: string;
  mousePart: string;
  mouseLine: string;
  mouseDetail: string;
  mouseUnlit: string;
  haloOp: string;
}

export function palette(mode: Mode): Palette {
  if (mode === 'light') {
    return {
      bg: '#eceef2',
      sideBg: '#ffffff',
      surface: '#ffffff',
      surface2: '#f5f6f8',
      track: '#e7e9ee',
      border: '#dcdfe6',
      sep: '#e6e8ed',
      borderStrong: '#767d8c',
      text: '#13151a',
      text2: '#454b57',
      muted: '#5a606d',
      inputBg: '#ffffff',
      btnBg: '#ffffff',
      btnBorder: '#cfd3dc',
      okInk: '#0b7643',
      warnInk: '#73630a',
      stage: '#16191e',
      stageLine: '#16191e',
      stageText: '#c3c8d2',
      codeBg: '#f1f2f5',
      overlay: 'rgba(17, 19, 25, 0.45)',
      shadow: '0 1px 2px rgba(17, 19, 26, 0.05), 0 14px 32px -22px rgba(17, 19, 26, 0.30)',
      modalShadow: '0 28px 64px -24px rgba(17, 19, 26, 0.45)',
      barEdge: 'rgba(0, 0, 0, 0.45)',
      mouseBody: '#1a1d23',
      mousePart: '#2a2e36',
      mouseLine: '#737a88',
      mouseDetail: '#3b404a',
      mouseUnlit: '#3a3f49',
      haloOp: '0.85',
    };
  }
  return {
    bg: '#111318',
    sideBg: '#181b21',
    surface: '#181b21',
    surface2: '#1f232a',
    track: '#121418',
    border: '#2b2f38',
    sep: '#292d35',
    borderStrong: '#6f7685',
    text: '#eef0f4',
    text2: '#b9bec9',
    muted: '#9ca3b0',
    inputBg: '#121418',
    btnBg: '#262a32',
    btnBorder: '#3a3f4a',
    okInk: '#61da92',
    warnInk: '#edd55e',
    stage: '#0b0d10',
    stageLine: '#252932',
    stageText: '#c3c8d2',
    codeBg: '#0e1013',
    overlay: 'rgba(4, 5, 8, 0.68)',
    shadow: '0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 18px 40px -28px rgba(0, 0, 0, 0.9)',
    modalShadow: '0 28px 64px -24px rgba(0, 0, 0, 0.85)',
    barEdge: 'rgba(255, 255, 255, 0.40)',
    mouseBody: '#1a1d23',
    mousePart: '#2a2e36',
    mouseLine: '#737a88',
    mouseDetail: '#3b404a',
    mouseUnlit: '#3a3f49',
    haloOp: '0.85',
  };
}

export interface Tokens extends Palette {
  mode: Mode;
  accentFill: string;
  onAccent: string;
  accentInk: string;
  accentSoft: string;
  tileOnBg: string;
  infoBorder: string;
  okSoft: string;
  okBorder: string;
  warnSoft: string;
  warnBorder: string;
}

/** The surfaces that text and accents sit on. */
export function grounds(t: Palette): string[] {
  return [t.bg, t.sideBg, t.surface, t.surface2, t.track, t.inputBg, t.btnBg];
}

export function tokens(mode: Mode, accent: string = ACCENT): Tokens {
  const p = palette(mode);
  const dark = mode === 'dark';
  const toward = dark ? '#ffffff' : '#000000';
  const acc = normalizeHex(accent) ?? ACCENT;
  const base = grounds(p);
  const accentSoft = mix(p.surface, acc, dark ? 0.16 : 0.1);
  const tileOnBg = mix(p.surface2, acc, dark ? 0.16 : 0.1);
  const inkGrounds = [...base, accentSoft, tileOnBg];

  let fill: string;
  let onAccent: string;
  let accentInk: string;
  if (dark) {
    fill = ensure(acc, base, 3, toward);
    onAccent = bestText(fill);
    for (let i = 0; i < 40 && contrast(onAccent, fill) < 4.5; i++) {
      fill = mix(fill, toward, 0.05);
      onAccent = bestText(fill);
    }
    accentInk = ensure(acc, inkGrounds, 4.5, toward);
  } else {
    fill = deepen(
      acc,
      (x) => contrast(INK_LIGHT, x) >= 4.5 && Math.min(...inkGrounds.map((g) => contrast(x, g))) >= 4.6,
    );
    onAccent = INK_LIGHT;
    accentInk = fill;
  }

  const okSoft = mix(p.surface, p.okInk, dark ? 0.12 : 0.08);
  const okInk = ensure(p.okInk, [...base, okSoft], 4.5, toward);
  const warnSoft = mix(p.surface, p.warnInk, dark ? 0.12 : 0.1);
  const warnInk = ensure(p.warnInk, [...base, warnSoft], 4.5, toward);

  return {
    ...p,
    mode,
    accentFill: fill,
    onAccent,
    accentInk,
    accentSoft,
    tileOnBg,
    infoBorder: mix(p.surface, acc, dark ? 0.42 : 0.38),
    okInk,
    okSoft,
    okBorder: mix(p.surface, okInk, dark ? 0.4 : 0.35),
    warnInk,
    warnSoft,
    warnBorder: mix(p.surface, warnInk, dark ? 0.45 : 0.4),
  };
}

/** `--kebab-case` CSS custom properties for every token. */
export function cssVariables(t: Tokens): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(t)) {
    if (key === 'mode') continue;
    vars['--' + key.replace(/[A-Z0-9]/g, (c) => '-' + c.toLowerCase())] = value;
  }
  return vars;
}
