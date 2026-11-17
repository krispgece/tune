import type { DeviceSettings, Zones } from '../backend/types';
import type { StringKey, Translator } from '../i18n';
import { hueName, type HueName } from '../theme/color';

export const PRESETS: { key: StringKey; hex: string }[] = [
  { key: 'cWhite', hex: '#ffffff' },
  { key: 'cRed', hex: '#ff2340' },
  { key: 'cPink', hex: '#ff4fa8' },
  { key: 'cPurple', hex: '#9a5bff' },
  { key: 'cLavender', hex: '#c3a6ff' },
  { key: 'cBlue', hex: '#2f6dff' },
  { key: 'cCyan', hex: '#1fc8ff' },
  { key: 'cTurquoise', hex: '#1de2c1' },
  { key: 'cGreen', hex: '#33e05a' },
  { key: 'cYellow', hex: '#ffd83a' },
];

const HUE_KEYS: Record<HueName, StringKey> = {
  white: 'hueWhite',
  black: 'hueBlack',
  grey: 'hueGrey',
  red: 'hueRed',
  orange: 'hueOrange',
  yellow: 'hueYellow',
  green: 'hueGreen',
  turquoise: 'hueTurquoise',
  blue: 'hueBlue',
  purple: 'huePurple',
  pink: 'huePink',
};

/** A spoken name for a colour: the preset's name, else "blue shade #2F6DFF". */
export function colorName(hex: string, { t, lang }: Translator): string {
  const value = hex.toLowerCase();
  const preset = PRESETS.find((p) => p.hex === value);
  if (preset) return t(preset.key).toLocaleLowerCase(lang);
  return t('shade', { hue: t(HUE_KEYS[hueName(value)]), hex: value.toUpperCase() });
}

/** The colour of each zone as the mouse would show it, or `null` with the lights off. */
export function litZones(device: DeviceSettings): Zones | null {
  if (device.lightMode === 'off') return null;
  if (device.lightMode === 'zones') return device.zones;
  return { front: device.color, middle: device.color, rear: device.color };
}
