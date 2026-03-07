import type { Locale } from '../i18n/i18n';

export type PageViewMode = 'single' | 'double';
export type ImageFitMode = 'auto' | 'actual' | 'width' | 'height';

export interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export interface AppSettings {
  locale: Locale;
  pageViewMode: PageViewMode;
  imageFitMode: ImageFitMode;
  sidebarWidth: number;
  windowBounds: WindowBounds;
  isMaximized: boolean;
}

export const defaultAppSettings: AppSettings = {
  locale: 'ko',
  pageViewMode: 'single',
  imageFitMode: 'auto',
  sidebarWidth: 260,
  windowBounds: {
    width: 1200,
    height: 820
  },
  isMaximized: false
};
