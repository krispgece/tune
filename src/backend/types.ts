// The shapes the app shell sends and receives. They mirror `tune-core` (`model.rs`, `settings.rs`) and the commands in
// `src-tauri/src/lib.rs`, in their camelCase JSON form.

export type DeviceKind = 'mouse' | 'keyboard' | 'headset';
export type Connection = 'wired' | 'receiver' | 'unknown';
export type DeviceAccess = 'allowed' | 'denied' | 'notChecked';
export type DevicePage = 'rival3Gen2';

export interface MouseCaps {
  dpiMin: number;
  dpiMax: number;
  dpiStep: number;
  maxStages: number;
  pollRates: number[];
  zones: number;
}

export interface DeviceSummary {
  /** Unique per plugged-in device: the USB id, plus `/serial` when the device reports one. */
  id: string;
  /** `vvvv:pppp`, lower-case hex. Settings are kept per USB id. */
  usbId: string;
  name: string;
  kind: DeviceKind;
  connection: Connection;
  page: DevicePage | null;
  access: DeviceAccess;
  caps: MouseCaps | null;
}

export const SCENARIOS = ['setup', 'normal', 'own', 'multi', 'unplugged', 'noperm', 'replug', 'guard'] as const;
export type Scenario = (typeof SCENARIOS)[number];

export interface ScanReport {
  devices: DeviceSummary[];
  /** Where the access rule is installed, when it is. */
  accessRule: string | null;
  /** Re-applying stopped after the mouse dropped off twice in a short time. */
  reapplyPaused: boolean;
  mockScenario: Scenario | null;
}

export type SettingGroup = 'dpi' | 'rate' | 'light';
export const SETTING_GROUPS: SettingGroup[] = ['dpi', 'rate', 'light'];
export type ApplyOutcome = 'received' | 'notSent';
export type ActionOutcome = 'done' | 'notAvailable';

export type Language = 'en' | 'tr';
export type Theme = 'system' | 'light' | 'dark';
export type LightMode = 'single' | 'zones' | 'off';

export type Managed = Record<SettingGroup, boolean>;

export interface Zones {
  front: string;
  middle: string;
  rear: string;
}

export interface DeviceSettings {
  managed: Managed;
  dpiStages: number[];
  startStage: number;
  pollRateHz: number;
  lightMode: LightMode;
  color: string;
  zones: Zones;
}

export interface Settings {
  version: number;
  language: Language;
  theme: Theme;
  firstRunDone: boolean;
  devices: Record<string, DeviceSettings>;
}

export interface AppInfo {
  name: string;
  version: string;
  backend: 'device' | 'mock';
  /** False while every apply is a stub: choices stay on this computer. */
  sendsSettings: boolean;
}

export interface AccessRuleInfo {
  fileName: string;
  /** The rule file that ships with the app, for installing it by hand. */
  source: string | null;
}

export interface Backend {
  appInfo(): Promise<AppInfo>;
  scan(): Promise<ScanReport>;
  loadSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<Settings>;
  apply(deviceId: string, group: SettingGroup): Promise<ApplyOutcome>;
  requestAccess(): Promise<ActionOutcome>;
  removeAccess(): Promise<ActionOutcome>;
  resumeReapply(): Promise<ActionOutcome>;
  setMockScenario(scenario: Scenario): Promise<void>;
  accessRule(): Promise<AccessRuleInfo>;
}
