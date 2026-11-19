import type {
  ApplyOutcome,
  DeviceSettings,
  DeviceSummary,
  DpiSync,
  MouseCaps,
  ScanReport,
  SettingGroup,
} from '../backend/types';
import type { StringKey } from '../i18n';

/** A device in the list. The supported mouse stays listed while it is unplugged (`present: false`). */
export interface DeviceEntry {
  summary: DeviceSummary;
  present: boolean;
}

/** The one device with a page so far. */
export const RIVAL_USB_ID = '1038:1870';

/** What ssgg reports for the Rival 3 Gen 2; used by the mock and when a scan gives no caps. */
export const RIVAL_CAPS: MouseCaps = {
  dpiMin: 200,
  dpiMax: 8500,
  dpiStep: 100,
  maxStages: 5,
  pollRates: [125, 250, 500, 1000],
  zones: 3,
};

const RIVAL_3_GEN_2: DeviceSummary = {
  id: RIVAL_USB_ID,
  usbId: RIVAL_USB_ID,
  name: 'Rival 3 Gen 2',
  kind: 'mouse',
  connection: 'wired',
  page: 'rival3Gen2',
  access: 'notChecked',
  caps: null,
  instance: '',
};

export function deviceEntries(scan: ScanReport | null): DeviceEntry[] {
  const devices = scan?.devices ?? [];
  const entries = devices.map((summary) => ({ summary, present: true }));
  if (!devices.some((d) => d.page === 'rival3Gen2')) entries.unshift({ summary: RIVAL_3_GEN_2, present: false });
  return entries;
}

export type ListStatus = 'connected' | 'unplugged' | 'noperm' | 'paused' | 'unsupported';

export function listStatus(entry: DeviceEntry, paused: boolean): ListStatus {
  if (!entry.summary.page) return 'unsupported';
  if (!entry.present) return 'unplugged';
  if (entry.summary.access === 'denied') return 'noperm';
  return paused ? 'paused' : 'connected';
}

export const LIST_STATUS_TEXT: Record<ListStatus, StringKey> = {
  connected: 'stConnected',
  unplugged: 'stUnplugged',
  noperm: 'stNoperm',
  paused: 'stPaused',
  unsupported: 'stUnsupported',
};

export function connectionKey(summary: DeviceSummary): StringKey {
  if (summary.connection === 'wired') return 'wiredUsb';
  if (summary.connection === 'receiver') return 'wirelessUsb';
  return 'usb';
}

/** What the first-run scan says about a device. */
export function foundKey(summary: DeviceSummary): StringKey {
  if (!summary.page) return 'foundUnsupported';
  return summary.access === 'denied' ? 'foundNeedsPerm' : 'foundReady';
}

/**
 * The permission step is skipped when the mouse can already be reached, or when no mouse is plugged in and the rule
 * is in place.
 */
export function needsPermission(scan: ScanReport | null): boolean {
  if (!scan) return true;
  const pages = scan.devices.filter((d) => d.page);
  if (pages.some((d) => d.access === 'denied')) return true;
  return pages.length === 0 && !scan.accessRule;
}

/**
 * The rule is installed but the plugged-in mouse is still denied: the rule reaches a mouse only when it is plugged in
 * again or udev applies its rules to the devices already plugged in.
 */
export function needsReplug(scan: ScanReport | null): boolean {
  if (!scan?.accessRule) return false;
  return scan.devices.some((d) => d.page && d.access === 'denied');
}

/**
 * The setting groups a device gets again when it comes back: colour and polling rate, which the mouse forgets when
 * it's unplugged, and DPI only while a change hasn't been confirmed, since the mouse keeps its stages itself.
 */
export function reapplyGroups(device: DeviceSettings): SettingGroup[] {
  const groups: SettingGroup[] = [];
  if (device.managed.dpi && device.dpiSync === 'pending') groups.push('dpi');
  if (device.managed.rate) groups.push('rate');
  if (device.managed.light) groups.push('light');
  return groups;
}

/** Supported devices that can be reached. */
export function reachable(scan: ScanReport): DeviceSummary[] {
  return scan.devices.filter((d) => d.page && d.access === 'allowed');
}

/** Reachable devices on a plug-in that hasn't got its settings yet; `reapplied` maps device ids to the last one that did. */
export function comebacks(scan: ScanReport, reapplied: ReadonlyMap<string, string>): DeviceSummary[] {
  return reachable(scan).filter((d) => reapplied.get(d.id) !== d.instance);
}

/**
 * What happened to a setting group's last send in this session: nothing yet (`idle`), on its way, sent without an
 * answer, answered (`echoed`), read back (`verified`), held back while paused or with sending off (`notSent`), or
 * not delivered because the mouse couldn't be reached (`failed`).
 */
export type GroupStatus = 'idle' | 'sending' | 'sent' | 'echoed' | 'verified' | 'notSent' | 'failed';
export type ApplyStatus = Exclude<GroupStatus, 'idle'> | 'own' | 'paused' | 'stored' | 'waiting';

/** What a DPI send's answer means for the stages kept here: only the mouse's confirmation puts them on the mouse. */
export function dpiSyncAfter(sync: DpiSync, outcome: ApplyOutcome): DpiSync {
  return outcome === 'echoed' || outcome === 'verified' ? 'onMouse' : sync;
}

/**
 * The status a setting card shows. Before anything is sent in this session, DPI stages the mouse confirmed earlier
 * show as stored on the mouse, which keeps them itself.
 */
export function applyStatus(
  group: SettingGroup,
  device: DeviceSettings,
  paused: boolean,
  status: GroupStatus,
): ApplyStatus {
  if (!device.managed[group]) return 'own';
  if (paused) return 'paused';
  if (status !== 'idle') return status;
  return group === 'dpi' && device.dpiSync === 'onMouse' ? 'stored' : 'waiting';
}
