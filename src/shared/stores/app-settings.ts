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
  showSidebarList: boolean;
  sidebarWidth: number;
  windowBounds: WindowBounds;
  isMaximized: boolean;
  theme: string;
}

export const defaultAppSettings: AppSettings = {
  locale: 'ko',
  pageViewMode: 'double', // 📐 [유저 최종 선호] 양면 보기 기본화!
  imageFitMode: 'width',  // 📐 [유저 최종 선호] 가로 폭 맞춤 기본화!
  showSidebarList: true, // 📐 [상태 보존] 사이드바 스플릿이 바로 보이도록 활성 상태로 격상!
  sidebarWidth: 230, // 📐 [황금비 초기간격] 기존 180에서 종료 시점의 230으로 격상!
  windowBounds: {
    width: 1350, // 📐 [최적 너비 고정] 지정해주신 황금 규격(1350)으로 가로폭 정밀 세팅!
    height: 825  // 📐 [최적 높이 고정] 최소 규격(825)에 맞춘 칼같은 높이 리모델링!
  },
  isMaximized: false,
  theme: 'default'
};
