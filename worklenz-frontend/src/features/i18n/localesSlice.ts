import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import i18n from '../../i18n';
import dayjs from 'dayjs';
import 'dayjs/locale/de';
import 'dayjs/locale/es';
import 'dayjs/locale/pt';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/ko';

export enum Language {
  EN = 'en',
  ES = 'es',
  PT = 'pt',
  ALB = 'alb',
  DE = 'de',
  ZH_CN = 'zh_cn',
  KO = 'ko',
}

export type ILanguageType = `${Language}`;

type LocalesState = {
  lng: ILanguageType;
};

const STORAGE_KEY = 'i18nextLng';

/**
 * Gets the user's browser language and returns it if supported, otherwise returns English
 * @returns The detected supported language or English as fallback
 */
const getDefaultLanguage = (): ILanguageType => {
  const browserLang = navigator.language.split('-')[0];
  if (Object.values(Language).includes(browserLang as Language)) {
    return browserLang as ILanguageType;
  }
  return Language.EN;
};

const DEFAULT_LANGUAGE: ILanguageType = getDefaultLanguage();

/**
 * Gets the current language from local storage
 * @returns The stored language or default language if not found
 */
const getLanguageFromLocalStorage = (): ILanguageType => {
  const savedLng = localStorage.getItem(STORAGE_KEY);
  if (Object.values(Language).includes(savedLng as Language)) {
    return savedLng as ILanguageType;
  }
  return DEFAULT_LANGUAGE;
};

/**
 * Saves the current language to local storage
 * @param lng Language to save
 */
const saveLanguageInLocalStorage = (lng: ILanguageType): void => {
  localStorage.setItem(STORAGE_KEY, lng);
};

/**
 * Maps language enum to dayjs locale code
 * @param language Language enum value
 * @returns Dayjs locale code
 */
const getDayjsLocale = (language: ILanguageType): string => {
  const localeMap: Record<ILanguageType, string> = {
    en: 'en',
    de: 'de',
    es: 'es',
    pt: 'pt',
    alb: 'en',
    zh_cn: 'zh-cn',
    ko: 'ko',
  };
  return localeMap[language] || 'en';
};

const initialState: LocalesState = {
  lng: getLanguageFromLocalStorage(),
};

const localesSlice = createSlice({
  name: 'localesReducer',
  initialState,
  reducers: {
    toggleLng: state => {
      const newLang: ILanguageType = state.lng === Language.EN ? Language.ES : Language.EN;
      state.lng = newLang;
      saveLanguageInLocalStorage(newLang);
      i18n.changeLanguage(newLang);
      dayjs.locale(getDayjsLocale(newLang));
    },
    setLanguage: (state, action: PayloadAction<ILanguageType>) => {
      state.lng = action.payload;
      saveLanguageInLocalStorage(action.payload);
      i18n.changeLanguage(action.payload);
      dayjs.locale(getDayjsLocale(action.payload));
    },
  },
});

export const { toggleLng, setLanguage } = localesSlice.actions;
export default localesSlice.reducer;
