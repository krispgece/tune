import { BrowserMock } from './browserMock';
import { tauriBackend } from './tauri';
import type { Backend } from './types';

export * from './types';

/** The app shell's commands inside the app window; the in-page mock in a plain browser. */
export function createBackend(): Backend {
  return '__TAURI_INTERNALS__' in window ? tauriBackend : new BrowserMock();
}
