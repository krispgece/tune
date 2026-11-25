import { describe, expect, it } from 'vitest';

import type { AppInfo, DeviceSummary, ScanReport, Settings } from '../backend/types';
import { translator } from '../i18n';
import { applyCommands, installCommands, removeCommands, ruleFromPackage, shellQuote } from './commands';
import {
  applyStatus,
  comebacks,
  deviceEntries,
  dpiSyncAfter,
  foundKey,
  listStatus,
  needsPermission,
  needsReplug,
  planReapply,
  reachable,
  reapplyGroups,
  RIVAL_CAPS,
  RIVAL_USB_ID,
} from './devices';
import { diagnostics } from './diagnostics';
import { addStage, clampDpi, deleteStage, makeStart, quickPicks, setSelectedDpi, sliderFraction } from './dpi';
import { colorName, litZones } from './lighting';
import { allManaged, defaultDeviceSettings, defaultSettings, withDevice } from './settings';

const caps = RIVAL_CAPS;
const en = translator('en', 'App');
const tr = translator('tr', 'App');

const rival: DeviceSummary = {
  id: '1038:1870',
  usbId: '1038:1870',
  name: 'Rival 3 Gen 2',
  kind: 'mouse',
  connection: 'wired',
  page: 'rival3Gen2',
  access: 'allowed',
  caps,
  instance: 'first plug-in',
};
const keyboard: DeviceSummary = { ...rival, id: '1038:1628', usbId: '1038:1628', kind: 'keyboard', page: null };
const report = (devices: DeviceSummary[], accessRule: string | null = null): ScanReport => ({
  devices,
  accessRule,
  accessRuleFromPackage: false,
  reapplyPaused: false,
  wakes: 0,
  mockScenario: null,
});

describe('DPI stages', () => {
  const base = { stages: [400, 800, 1600, 3200], start: 1, selected: 1 };

  it('round and clamp to the mouse', () => {
    expect(clampDpi(1234, caps)).toBe(1200);
    expect(clampDpi(1250, caps)).toBe(1300);
    expect(clampDpi(50, caps)).toBe(200);
    expect(clampDpi(99999, caps)).toBe(8500);
    expect(clampDpi(Number.NaN, caps)).toBe(800);
  });

  it('change the selected stage, and report no change', () => {
    expect(setSelectedDpi(base, 1000, caps)?.stages).toEqual([400, 1000, 1600, 3200]);
    expect(setSelectedDpi(base, 820, caps)).toBeNull();
  });

  it('add a doubled stage up to the limit and select it', () => {
    const added = addStage(base, caps);
    expect(added).toEqual({ stages: [400, 800, 1600, 3200, 6400], start: 1, selected: 4 });
    expect(added && addStage(added, caps)).toBeNull();
    expect(addStage({ stages: [5000], start: 0, selected: 0 }, caps)?.stages).toEqual([5000, 8500]);
  });

  it('delete the selected stage and keep the start stage on the same value', () => {
    expect(deleteStage({ ...base, selected: 0 })).toEqual({ stages: [800, 1600, 3200], start: 0, selected: 0 });
    expect(deleteStage({ ...base, selected: 3 })).toEqual({ stages: [400, 800, 1600], start: 1, selected: 2 });
  });

  it('move the start back one when the start stage is deleted', () => {
    expect(deleteStage(base)).toEqual({ stages: [400, 1600, 3200], start: 0, selected: 1 });
    expect(deleteStage({ stages: [400, 800], start: 0, selected: 0 })).toEqual({
      stages: [800],
      start: 0,
      selected: 0,
    });
  });

  it('never delete the last stage', () => {
    expect(deleteStage({ stages: [800], start: 0, selected: 0 })).toBeNull();
  });

  it('make the selected stage the start', () => {
    expect(makeStart({ ...base, selected: 3 })).toEqual({ ...base, selected: 3, start: 3 });
    expect(makeStart(base)).toBeNull();
  });

  it('offer quick picks inside the range and place the slider', () => {
    expect(quickPicks(caps)).toEqual([400, 800, 1600, 3200]);
    expect(quickPicks({ ...caps, dpiMax: 1000 })).toEqual([400, 800]);
    expect(sliderFraction(200, caps)).toBe(0);
    expect(sliderFraction(8500, caps)).toBe(1);
  });
});

describe('lighting', () => {
  it('names presets and other colours in both languages', () => {
    expect(colorName('#FF2340', en)).toBe('red');
    expect(colorName('#ff2340', tr)).toBe('kırmızı');
    expect(colorName('#123456', en)).toBe('blue shade #123456');
    expect(colorName('#123456', tr)).toBe('mavi tonu #123456');
  });

  it('light the zones by mode', () => {
    const device = defaultDeviceSettings();
    expect(litZones(device)).toEqual({ front: '#1fc8ff', middle: '#1fc8ff', rear: '#1fc8ff' });
    expect(litZones({ ...device, lightMode: 'zones' })).toEqual(device.zones);
    expect(litZones({ ...device, lightMode: 'off' })).toBeNull();
  });
});

describe('commands', () => {
  it('quote paths only when needed', () => {
    expect(shellQuote('/opt/app/udev/70-x.rules')).toBe('/opt/app/udev/70-x.rules');
    expect(shellQuote("/home/a b/it's.rules")).toBe(`'/home/a b/it'\\''s.rules'`);
  });

  it('install the bundled rule by name, reload and apply it to the plugged-in mouse', () => {
    expect(installCommands({ fileName: '70-x.rules', source: '/opt/app/udev/70-x.rules' })).toEqual([
      'sudo install -m 0644 /opt/app/udev/70-x.rules /etc/udev/rules.d/70-x.rules',
      'sudo udevadm control --reload-rules',
      'sudo udevadm trigger --subsystem-match=hidraw',
    ]);
    expect(installCommands({ fileName: '70-x.rules', source: null })[0]).toBe(
      'sudo install -m 0644 70-x.rules /etc/udev/rules.d/70-x.rules',
    );
  });

  it('apply an installed rule without a replug', () => {
    expect(applyCommands()).toEqual(['sudo udevadm trigger --subsystem-match=hidraw']);
  });

  it('remove the installed rule', () => {
    expect(removeCommands(null, '70-x.rules')).toHaveLength(2);
    expect(removeCommands(null, '70-x.rules')[0]).toBe('sudo rm /etc/udev/rules.d/70-x.rules');
    expect(removeCommands('/usr/lib/udev/rules.d/70-x.rules', '70-x.rules')[0]).toBe(
      'sudo rm /usr/lib/udev/rules.d/70-x.rules',
    );
  });

  it('tell a rule from the package apart from one installed by hand', () => {
    expect(ruleFromPackage('/usr/lib/udev/rules.d/70-x.rules')).toBe(true);
    expect(ruleFromPackage('/lib/udev/rules.d/70-x.rules')).toBe(true);
    expect(ruleFromPackage('/etc/udev/rules.d/70-x.rules')).toBe(false);
    expect(ruleFromPackage(null)).toBe(false);
  });
});

describe('devices', () => {
  it('keep the supported mouse listed while it is unplugged', () => {
    const entries = deviceEntries(report([keyboard]));
    expect(entries.map((e) => [e.summary.name, e.present])).toEqual([
      ['Rival 3 Gen 2', false],
      ['Rival 3 Gen 2', true],
    ]);
    expect(listStatus(entries[0]!, false)).toBe('unplugged');
    expect(listStatus(entries[1]!, false)).toBe('unsupported');
    expect(deviceEntries(null)).toHaveLength(1);
  });

  it('give the mouse its status', () => {
    const [entry] = deviceEntries(report([rival]));
    expect(listStatus(entry!, false)).toBe('connected');
    expect(listStatus(entry!, true)).toBe('paused');
    expect(listStatus({ summary: { ...rival, access: 'denied' }, present: true }, false)).toBe('noperm');
  });

  it('say what the first-run scan found', () => {
    expect(foundKey(rival)).toBe('foundReady');
    expect(foundKey({ ...rival, access: 'denied' })).toBe('foundNeedsPerm');
    expect(foundKey(keyboard)).toBe('foundUnsupported');
  });

  it('skip the permission step only when access is in place', () => {
    const rule = '/etc/udev/rules.d/70-x.rules';
    expect(needsPermission(null)).toBe(true);
    expect(needsPermission(report([]))).toBe(true);
    expect(needsPermission(report([keyboard]))).toBe(true);
    expect(needsPermission(report([{ ...rival, access: 'denied' }]))).toBe(true);
    expect(needsPermission(report([rival]))).toBe(false);
    expect(needsPermission(report([], rule))).toBe(false);
    expect(needsPermission(report([{ ...rival, access: 'denied' }], rule))).toBe(true);
  });

  it('tell an installed rule that has not reached the mouse', () => {
    const rule = '/etc/udev/rules.d/70-x.rules';
    expect(needsReplug(null)).toBe(false);
    expect(needsReplug(report([{ ...rival, access: 'denied' }]))).toBe(false);
    expect(needsReplug(report([{ ...rival, access: 'denied' }], rule))).toBe(true);
    expect(needsReplug(report([rival], rule))).toBe(false);
    expect(needsReplug(report([keyboard], rule))).toBe(false);
    expect(needsReplug(report([], rule))).toBe(false);
  });

  it('send colour and polling rate again on a comeback, and DPI only while a change is unconfirmed', () => {
    const managed = { ...defaultDeviceSettings(), managed: { dpi: true, rate: true, light: true } };
    expect(reapplyGroups(managed)).toEqual(['rate', 'light']);
    expect(reapplyGroups({ ...managed, dpiSync: 'onMouse' })).toEqual(['rate', 'light']);
    expect(reapplyGroups({ ...managed, dpiSync: 'pending' })).toEqual(['dpi', 'rate', 'light']);
    expect(
      reapplyGroups({ ...managed, managed: { dpi: true, rate: false, light: true }, dpiSync: 'pending' }),
    ).toEqual(['dpi', 'light']);
    expect(reapplyGroups({ ...defaultDeviceSettings(), dpiSync: 'pending' })).toEqual([]);
  });

  it('put DPI stages on the mouse only when the mouse confirms them', () => {
    expect(dpiSyncAfter('pending', 'echoed')).toBe('onMouse');
    expect(dpiSyncAfter('pending', 'sent')).toBe('pending');
    expect(dpiSyncAfter('pending', 'notSent')).toBe('pending');
    expect(dpiSyncAfter('unknown', 'sent')).toBe('unknown');
    expect(dpiSyncAfter('onMouse', 'echoed')).toBe('onMouse');
  });

  it('find the reachable devices on a plug-in that has not had its settings', () => {
    const scan = report([rival, keyboard, { ...rival, id: '1038:1870/B', access: 'denied' }]);
    expect(reachable(scan).map((d) => d.id)).toEqual(['1038:1870']);
    expect(comebacks(scan, new Map()).map((d) => d.id)).toEqual(['1038:1870']);
    expect(comebacks(scan, new Map([['1038:1870', 'first plug-in']]))).toEqual([]);
    expect(comebacks(scan, new Map([['1038:1870', 'an earlier plug-in']])).map((d) => d.id)).toEqual(['1038:1870']);
  });

  it('show the apply status', () => {
    const managed = { ...defaultDeviceSettings(), managed: { dpi: true, rate: true, light: true } };
    expect(applyStatus('rate', defaultDeviceSettings(), true, 'verified')).toBe('own');
    expect(applyStatus('rate', managed, true, 'verified')).toBe('paused');
    expect(applyStatus('rate', managed, false, 'sending')).toBe('sending');
    expect(applyStatus('rate', managed, false, 'verified')).toBe('verified');
    expect(applyStatus('light', managed, false, 'failed')).toBe('failed');
    expect(applyStatus('light', managed, false, 'notSent')).toBe('notSent');
  });

  it('show DPI stages as stored on the mouse only once the mouse confirmed them', () => {
    const managed = { ...defaultDeviceSettings(), managed: { dpi: true, rate: true, light: true } };
    expect(applyStatus('dpi', { ...managed, dpiSync: 'onMouse' }, false, 'idle')).toBe('stored');
    // Stages Tune never sent, such as a file from before it could send, may not be the mouse's.
    expect(applyStatus('dpi', managed, false, 'idle')).toBe('waiting');
    expect(applyStatus('dpi', { ...managed, dpiSync: 'pending' }, false, 'idle')).toBe('waiting');
    expect(applyStatus('dpi', { ...managed, dpiSync: 'onMouse' }, false, 'echoed')).toBe('echoed');
    expect(applyStatus('rate', managed, false, 'idle')).toBe('waiting');
  });
});

describe('re-sending', () => {
  const managed: Settings = withDevice(defaultSettings(), RIVAL_USB_ID, {
    ...defaultDeviceSettings(),
    managed: allManaged(true),
  });
  const fresh = { reapplied: new Map<string, string>(), wakes: null };
  const scanOf = (devices: DeviceSummary[], wakes = 0): ScanReport => ({ ...report(devices), wakes });
  const sent = (plan: ReturnType<typeof planReapply>) => plan.sends.map((s) => [s.target.id, s.groups]);

  it('send colour and polling rate to each reachable supported device at the first scan', () => {
    const denied = { ...rival, id: '1038:1870/B', access: 'denied' as const };
    const plan = planReapply(scanOf([rival, keyboard, denied]), fresh, managed, true);
    expect(sent(plan)).toEqual([['1038:1870', ['rate', 'light']]]);
    expect([...plan.memory.reapplied]).toEqual([['1038:1870', 'first plug-in']]);
    expect(plan.memory.wakes).toBe(0);
  });

  it('send nothing again on the same plug-in, and everything on a new one', () => {
    const first = planReapply(scanOf([rival]), fresh, managed, true);
    expect(planReapply(scanOf([rival]), first.memory, managed, true).sends).toEqual([]);
    const replugged = planReapply(scanOf([{ ...rival, instance: 'second plug-in' }]), first.memory, managed, true);
    expect(sent(replugged)).toEqual([['1038:1870', ['rate', 'light']]]);
  });

  it('send again after a wake from sleep, even on the same plug-in', () => {
    const first = planReapply(scanOf([rival], 3), fresh, managed, true);
    const woke = planReapply(scanOf([rival], 4), first.memory, managed, true);
    expect(sent(woke)).toEqual([['1038:1870', ['rate', 'light']]]);
    expect(woke.memory.wakes).toBe(4);
    expect(planReapply(scanOf([rival], 4), woke.memory, managed, true).sends).toEqual([]);
  });

  it('send again to a mouse that was out of reach, even on the same plug-in', () => {
    const first = planReapply(scanOf([rival]), fresh, managed, true);
    const denied = planReapply(scanOf([{ ...rival, access: 'denied' }]), first.memory, managed, true);
    expect(denied.sends).toEqual([]);
    expect(denied.memory.reapplied.size).toBe(0);
    expect(sent(planReapply(scanOf([rival]), denied.memory, managed, true))).toHaveLength(1);
  });

  it('plan and record nothing while sending is paused or off, so the mouse counts as come back afterwards', () => {
    const paused = planReapply(scanOf([rival]), fresh, managed, false);
    expect(paused.sends).toEqual([]);
    expect(paused.memory.reapplied.size).toBe(0);
    expect(sent(planReapply(scanOf([rival]), paused.memory, managed, true))).toHaveLength(1);
  });

  it('send DPI stages only while a change is pending, and nothing to a mouse the app does not manage', () => {
    const pending = withDevice(managed, RIVAL_USB_ID, {
      ...defaultDeviceSettings(),
      managed: allManaged(true),
      dpiSync: 'pending',
    });
    expect(sent(planReapply(scanOf([rival]), fresh, pending, true))).toEqual([['1038:1870', ['dpi', 'rate', 'light']]]);
    const own = planReapply(scanOf([rival]), fresh, defaultSettings(), true);
    expect(own.sends).toEqual([]);
    expect(own.memory.reapplied.get('1038:1870')).toBe('first plug-in');
  });
});

describe('diagnostics', () => {
  const info: AppInfo = { name: 'App', version: '0.1.0', backend: 'mock', sendsSettings: true, tray: true };

  it('describe the device and its settings', () => {
    const settings = { ...defaultDeviceSettings(), managed: { dpi: true, rate: false, light: true } };
    expect(diagnostics(en, { info, device: rival, settings, state: 'Connected', accessAllowed: true })).toBe(
      [
        'App 0.1.0 · fake data',
        'Device: Rival 3 Gen 2 (wired) · USB 1038:1870',
        'Firmware: not read',
        'State: Connected',
        'Access permission: Allowed · settings channel only',
        'Managed setting groups: 2',
        'DPI stages: 400, 800, 1600, 3200 · start: stage 2',
        'Polling rate: 1000 Hz',
        'Lighting: single colour #1FC8FF',
      ].join('\n'),
    );
  });

  it('describe the lighting by zone in Turkish', () => {
    const settings = { ...defaultDeviceSettings(), lightMode: 'zones' as const };
    const text = diagnostics(tr, { info, device: rival, settings, state: 'Bağlı', accessAllowed: false });
    expect(text).toContain('Erişim izni: Yok');
    expect(text).toContain('Aydınlatma: bölge bölge (ön #1FC8FF, orta #9A5BFF, arka #FF4FA8)');
  });
});
