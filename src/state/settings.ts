import type { DeviceSettings, Managed, Settings } from '../backend/types';

export const DEFAULT_ZONES = { front: '#1fc8ff', middle: '#9a5bff', rear: '#ff4fa8' };

export const allManaged = (on: boolean): Managed => ({ dpi: on, rate: on, light: on });

/** The same defaults as `DeviceSettings::default()` in `tune-core`. */
export function defaultDeviceSettings(): DeviceSettings {
  return {
    managed: allManaged(false),
    dpiStages: [400, 800, 1600, 3200],
    startStage: 1,
    pollRateHz: 1000,
    lightMode: 'single',
    color: '#1fc8ff',
    zones: { ...DEFAULT_ZONES },
  };
}

export function defaultSettings(): Settings {
  return { version: 1, language: 'en', theme: 'system', firstRunDone: false, devices: {} };
}

export function deviceSettings(settings: Settings, usbId: string): DeviceSettings {
  return settings.devices[usbId] ?? defaultDeviceSettings();
}

export function withDevice(settings: Settings, usbId: string, device: DeviceSettings): Settings {
  return { ...settings, devices: { ...settings.devices, [usbId]: device } };
}

export function managedCount(device: DeviceSettings): number {
  return Object.values(device.managed).filter(Boolean).length;
}
