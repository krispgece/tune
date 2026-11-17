import { describe, expect, it } from 'vitest';

import { contrast, hueName, normalizeHex } from './color';
import { ACCENT, cssVariables, grounds, tokens, type Mode } from './tokens';

const modes: Mode[] = ['light', 'dark'];
const minContrast = (color: string, against: string[]) => Math.min(...against.map((g) => contrast(color, g)));

describe.each(modes)('%s theme', (mode) => {
  const t = tokens(mode);
  const all = [...grounds(t), t.accentSoft, t.tileOnBg];

  it('body text and secondary text read on every surface', () => {
    expect(minContrast(t.text, grounds(t))).toBeGreaterThanOrEqual(7);
    expect(minContrast(t.text2, grounds(t))).toBeGreaterThanOrEqual(4.5);
    expect(minContrast(t.muted, grounds(t))).toBeGreaterThanOrEqual(4.5);
  });

  it('text on the accent fill reads', () => {
    expect(contrast(t.onAccent, t.accentFill)).toBeGreaterThanOrEqual(4.5);
  });

  it('accent text reads on every surface, the selected ones included', () => {
    expect(minContrast(t.accentInk, all)).toBeGreaterThanOrEqual(4.5);
  });

  it('the accent fill stands out from every surface', () => {
    expect(minContrast(t.accentFill, grounds(t))).toBeGreaterThanOrEqual(3);
  });

  it('status colours read on every surface and on their own tint', () => {
    expect(minContrast(t.okInk, [...grounds(t), t.okSoft])).toBeGreaterThanOrEqual(4.5);
    expect(minContrast(t.warnInk, [...grounds(t), t.warnSoft])).toBeGreaterThanOrEqual(4.5);
  });

  it('the strong border is visible on every surface', () => {
    expect(minContrast(t.borderStrong, grounds(t))).toBeGreaterThanOrEqual(3);
  });
});

describe('tokens', () => {
  it('keep the accent away from SteelSeries orange', () => {
    for (const mode of modes) {
      const fill = tokens(mode).accentFill;
      expect(hueName(fill)).not.toBe('orange');
      expect(fill).not.toBe('#ff5200');
    }
  });

  it('fall back to the default accent for a bad value', () => {
    expect(tokens('dark', 'nonsense')).toEqual(tokens('dark', ACCENT));
  });

  it('become kebab-case CSS variables', () => {
    const vars = cssVariables(tokens('light'));
    expect(vars['--accent-fill']).toMatch(/^#[0-9a-f]{6}$/);
    expect(vars['--surface-2']).toBe('#f5f6f8');
    expect(vars['--text-2']).toBe('#454b57');
    expect(vars).not.toHaveProperty('--mode');
  });
});

describe('colour helpers', () => {
  it('normalize hex values', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex(' #1FC8FF ')).toBe('#1fc8ff');
    expect(normalizeHex('1fc8ff')).toBeNull();
    expect(normalizeHex('#12345')).toBeNull();
  });

  it('name hues', () => {
    expect(hueName('#ffffff')).toBe('white');
    expect(hueName('#000000')).toBe('black');
    expect(hueName('#808080')).toBe('grey');
    expect(hueName('#ff2340')).toBe('red');
    expect(hueName('#ffd83a')).toBe('yellow');
    expect(hueName('#33e05a')).toBe('green');
    expect(hueName('#2f6dff')).toBe('blue');
    expect(hueName('#1de2c1')).toBe('turquoise');
    expect(hueName('#9a5bff')).toBe('purple');
    expect(hueName('#ff4fa8')).toBe('pink');
    expect(hueName('#ff8800')).toBe('orange');
  });
});
