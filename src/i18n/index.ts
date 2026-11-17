import { APP_NAME } from '../identity';
import { en, type Strings } from './en';
import { tr } from './tr';

export type Lang = 'en' | 'tr';
export type { Strings };

export const dictionaries: Record<Lang, Strings> = { en, tr };

/** Keys whose value is a single string (not a list). */
export type StringKey = { [K in keyof Strings]: Strings[K] extends string ? K : never }[keyof Strings];

export type Values = Record<string, string | number>;

/** Replaces each `{name}` with its value; unknown placeholders stay as they are. */
export function fill(template: string, values: Values): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match,
  );
}

export interface Translator {
  lang: Lang;
  t: (key: StringKey, values?: Values) => string;
  list: (key: 'obNames') => string[];
}

export function translator(lang: Lang, appName: string = APP_NAME): Translator {
  const dict = dictionaries[lang];
  return {
    lang,
    t: (key, values = {}) => fill(dict[key], { app: appName, ...values }),
    list: (key) => dict[key],
  };
}
