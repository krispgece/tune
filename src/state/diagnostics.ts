import type { AppInfo, DeviceSettings, DeviceSummary } from '../backend/types';
import type { Translator } from '../i18n';
import { managedCount } from './settings';

export interface DiagnosticsInput {
  info: AppInfo;
  device: DeviceSummary;
  settings: DeviceSettings;
  /** The device's status line, already translated. */
  state: string;
  accessAllowed: boolean;
}

/** The text behind "Copy diagnostic info": what the app knows, nothing read from the device. */
export function diagnostics({ t }: Translator, input: DiagnosticsInput): string {
  const { info, device, settings } = input;
  const name = device.connection === 'wired' ? t('modelWired', { name: device.name }) : device.name;
  const zones = settings.zones;
  const light =
    settings.lightMode === 'off'
      ? t('diagLightOff')
      : settings.lightMode === 'zones'
        ? t('diagLightZones', {
            front: zones.front.toUpperCase(),
            middle: zones.middle.toUpperCase(),
            rear: zones.rear.toUpperCase(),
          })
        : t('diagLightSingle', { hex: settings.color.toUpperCase() });
  return [
    t('diagApp', { version: info.version, backend: info.backend === 'mock' ? t('diagMock') : t('diagReal') }),
    t('diagDevice', { name, usb: device.usbId }),
    t('diagFirmware'),
    t('diagState', { state: input.state }),
    t('diagAccess', { value: input.accessAllowed ? t('accessVal') : t('accessNo') }),
    t('diagManaged', { n: managedCount(settings) }),
    t('diagDpi', { stages: settings.dpiStages.join(', '), start: settings.startStage + 1 }),
    t('diagRate', { hz: settings.pollRateHz }),
    light,
  ].join('\n');
}
