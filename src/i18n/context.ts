import { createContext, useContext } from 'react';

import type { Language } from '../backend/types';
import { translator, type Translator } from './index';

export const I18nContext = createContext<Translator>(translator('en'));
export const useI18n = () => useContext(I18nContext);

/** Lets any screen switch the language (the welcome step and Settings both offer it). */
export const SetLanguageContext = createContext<(lang: Language) => void>(() => undefined);
export const useSetLanguage = () => useContext(SetLanguageContext);
