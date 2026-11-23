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
  /** Changes each time the device is plugged in again; stays the same while it stays plugged in. */
  instance: string;
}

export const SCENARIOS = ['setup', 'normal', 'own', 'multi', 'unplugged', 'noperm', 'replug', 'guard'] as const;
export type Scenario = (typeof SCENARIOS)[number];

export interface ScanReport {
  devices: DeviceSummary[];
  /** Where the access rule is installed, when it is. */
  accessRule: string | null;
  /** Re-applying stopped after the mouse dropped off twice in a short time. */
  reapplyPaused: boolean;
  /** How many times the computer woke from sleep while the app ran; the mouse may have lost its settings in between. */
  wakes: number;
  mockScenario: Scenario | null;
}

export type SettingGroup = 'dpi' | 'rate' | 'light';
export const SETTING_GROUPS: SettingGroup[] = ['dpi', 'rate', 'light'];
/**
 * How far a send got: `sent` without an answer, `echoed` when the device answered that it took the setting,
 * `verified` when it reported the value back, `notSent` while re-applying is paused.
 */
export type ApplyOutcome = 'sent' | 'echoed' | 'verified' | 'notSent';
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

/**
 * Where the DPI stages kept here stand with the mouse, which stores its stages itself and can't report them:
 * `unknown` when Tune hasn't sent them (never changed, or changed before Tune could send), `pending` when they changed
 * and the mouse hasn't confirmed them yet, `onMouse` once it has.
 */
export type DpiSync = 'unknown' | 'pending' | 'onMouse';

export interface DeviceSettings {
  managed: Managed;
  dpiStages: number[];
  startStage: number;
  pollRateHz: number;
  lightMode: LightMode;
  color: string;
  zones: Zones;
  /** Where the DPI stages stand with the mouse; they go out again on a comeback only while pending. */
  dpiSync: DpiSync;
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
  /** False when sending is off: choices stay on this computer. */
  sendsSettings: boolean;
  /** True when the app has a tray icon and keeps running after its window is closed. */
  tray: boolean;
}

export interface AutostartStatus {
  /** False where starting at login can't work, as in a development build. */
  available: boolean;
  enabled: boolean;
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
  apply(deviceId: string, group: SettingGroup, settings: DeviceSettings): Promise<ApplyOutcome>;
  requestAccess(): Promise<ActionOutcome>;
  removeAccess(): Promise<ActionOutcome>;
  resumeReapply(): Promise<ActionOutcome>;
  setMockScenario(scenario: Scenario): Promise<void>;
  accessRule(): Promise<AccessRuleInfo>;
  autostartStatus(): Promise<AutostartStatus>;
  setAutostart(enabled: boolean): Promise<AutostartStatus>;
  /** The tray menu's texts, in the interface language. */
  setTrayTexts(open: string, quit: string): Promise<void>;
  /** Ends the app, tray icon included. */
  quit(): Promise<void>;
}
