import type { AppApi } from '../main/preload';

declare global {
  interface Window {
    appApi: AppApi;
  }
}

export {};

