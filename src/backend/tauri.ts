import { invoke } from '@tauri-apps/api/core';

import type { Backend } from './types';

/** The commands of `src-tauri/src/lib.rs`. */
export const tauriBackend: Backend = {
  appInfo: () => invoke('app_info'),
  scan: () => invoke('scan_devices'),
  loadSettings: () => invoke('load_settings'),
  saveSettings: (settings) => invoke('save_settings', { settings }),
  apply: (deviceId, group, settings) => invoke('apply_settings', { deviceId, group, settings }),
  requestAccess: () => invoke('request_access'),
  removeAccess: () => invoke('remove_access'),
  resumeReapply: () => invoke('resume_reapply'),
  setMockScenario: (scenario) => invoke('set_mock_scenario', { scenario }),
  accessRule: () => invoke('access_rule'),
  autostartStatus: () => invoke('autostart_status'),
  setAutostart: (enabled) => invoke('set_autostart', { enabled }),
  setTrayTexts: (open, quit) => invoke('set_tray_texts', { open, quit }),
  quit: () => invoke('quit_app'),
};
