// The mock backend again, in the page, so the interface also runs in a plain browser (`npm run dev`). It follows
// `crates/tune-core/src/mock.rs`; nothing here reaches a device.
import pkg from '../../package.json';
import { APP_NAME } from '../identity';
import { RULE_DIR, RULE_FILE_NAME } from '../state/commands';
import { RIVAL_CAPS } from '../state/devices';
import { defaultSettings } from '../state/settings';
import type {
  ApplyOutcome,
  Backend,
  DeviceSettings,
  DeviceSummary,
  ScanReport,
  Scenario,
  SettingGroup,
  Settings,
} from './types';

interface Delays {
  access: number;
  apply: number;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class BrowserMock implements Backend {
  private scenario: Scenario = 'setup';
  /** The access rule is installed. */
  private rule = false;
  /** The rule has reached the mouse. */
  private access = false;
  private paused = false;
  private settings: Settings = defaultSettings();

  constructor(private readonly delays: Delays = { access: 1600, apply: 300 }) {}

  private reset(scenario: Scenario) {
    this.scenario = scenario;
    this.rule = scenario !== 'setup' && scenario !== 'noperm';
    this.access = this.rule && scenario !== 'replug';
    this.paused = scenario === 'guard';
  }

  async appInfo() {
    return { name: APP_NAME, version: pkg.version, backend: 'mock' as const, sendsSettings: true };
  }

  async scan(): Promise<ScanReport> {
    const devices: DeviceSummary[] = [];
    if (this.scenario !== 'unplugged') {
      devices.push({
        id: '1038:1870',
        usbId: '1038:1870',
        name: 'Rival 3 Gen 2',
        kind: 'mouse',
        connection: 'wired',
        page: 'rival3Gen2',
        access: this.access ? 'allowed' : 'denied',
        caps: RIVAL_CAPS,
        instance: 'mock',
      });
    }
    if (this.scenario === 'multi') {
      const unsupported = (usbId: string, name: string, kind: 'keyboard' | 'headset', receiver: boolean) => ({
        id: usbId,
        usbId,
        name,
        kind,
        connection: receiver ? ('receiver' as const) : ('wired' as const),
        page: null,
        access: 'notChecked' as const,
        caps: null,
        instance: usbId,
      });
      devices.push(unsupported('1038:1628', 'Apex Pro TKL (2023)', 'keyboard', false));
      devices.push(unsupported('1038:227e', 'Arctis Nova 7 Gen 2', 'headset', true));
    }
    return {
      devices,
      accessRule: this.rule ? `${RULE_DIR}/${RULE_FILE_NAME}` : null,
      reapplyPaused: this.paused,
      wakes: 0,
      mockScenario: this.scenario,
    };
  }

  async loadSettings() {
    return structuredClone(this.settings);
  }

  async saveSettings(settings: Settings) {
    this.settings = structuredClone(settings);
    return structuredClone(settings);
  }

  /** Answers the way the real mouse does: the polling rate is read back, DPI and colour are echoed. */
  async apply(_deviceId: string, group: SettingGroup, _settings: DeviceSettings): Promise<ApplyOutcome> {
    await wait(this.delays.apply);
    if (this.paused) return 'notSent';
    return group === 'rate' ? 'verified' : 'echoed';
  }

  async requestAccess() {
    await wait(this.delays.access);
    this.rule = true;
    this.access = true;
    if (this.scenario === 'setup' || this.scenario === 'noperm' || this.scenario === 'replug') this.scenario = 'own';
    return 'done' as const;
  }

  async removeAccess() {
    this.reset('noperm');
    return 'done' as const;
  }

  async resumeReapply() {
    this.paused = false;
    if (this.scenario === 'guard') this.scenario = 'normal';
    return 'done' as const;
  }

  async setMockScenario(scenario: Scenario) {
    this.reset(scenario);
  }

  async accessRule() {
    return { fileName: RULE_FILE_NAME, source: null };
  }
}
