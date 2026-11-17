import { describe, expect, it } from 'vitest';

import { en } from './en';
import { fill, translator } from './index';
import { tr } from './tr';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('strings', () => {
  const enKeys = Object.keys(en).sort();
  const trKeys = Object.keys(tr).sort();

  it('every English string has a Turkish one, and nothing more', () => {
    expect(trKeys).toEqual(enKeys);
  });

  it.each(enKeys)('%s is filled in both languages with the same placeholders', (key) => {
    const english = en[key as keyof typeof en];
    const turkish = tr[key as keyof typeof tr];
    expect(typeof turkish).toBe(typeof english);
    if (Array.isArray(english)) {
      expect(Array.isArray(turkish)).toBe(true);
      expect((turkish as string[]).length).toBe(english.length);
      for (const item of turkish as string[]) expect(item.trim()).not.toBe('');
      return;
    }
    expect((turkish as string).trim()).not.toBe('');
    expect(placeholders(turkish as string)).toEqual(placeholders(english));
  });

  it('no string spells out the working name instead of using {app}', () => {
    for (const dict of [en, tr]) {
      for (const value of Object.values(dict).flat()) expect(value).not.toMatch(/\bTune\b/);
    }
  });

  it('no string uses the GG section names', () => {
    for (const dict of [en, tr]) {
      for (const value of Object.values(dict).flat()) {
        expect(value).not.toMatch(/\b(Engine|Sonar|Moments|Prism)\b/);
        expect(value).not.toMatch(/\bCPI\b/);
      }
    }
  });
});

describe('fill', () => {
  it('replaces known placeholders and keeps unknown ones', () => {
    expect(fill('{a} and {b}', { a: 1 })).toBe('1 and {b}');
    expect(fill('{n} of {n}', { n: 'x' })).toBe('x of x');
  });

  it('does not treat inherited object keys as values', () => {
    expect(fill('{toString}', {})).toBe('{toString}');
  });
});

describe('translator', () => {
  it('fills in the app name', () => {
    expect(translator('en', 'Example').t('welcomeTitle')).toBe('Welcome to Example');
    expect(translator('tr', 'Example').t('openApp')).toBe("Example'u aç");
  });

  it('takes extra values', () => {
    expect(translator('en', 'X').t('stepOf', { n: 2, total: 4 })).toBe('Step 2 of 4');
    expect(translator('tr', 'X').t('stepOf', { n: 2, total: 4 })).toBe('Adım 2 / 4');
  });
});
