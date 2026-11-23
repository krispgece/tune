import { describe, expect, it } from 'vitest';

import { defaultDeviceSettings } from '../state/settings';
import { BrowserMock } from './browserMock';

const quick = () => new BrowserMock({ access: 0, apply: 0 });
const names = async (mock: BrowserMock) => (await mock.scan()).devices.map((d) => d.name);

describe('browser mock', () => {
  it('starts at the first launch without permission', async () => {
    const mock = quick();
    const report = await mock.scan();
    expect(report.mockScenario).toBe('setup');
    expect(report.devices.map((d) => [d.name, d.access])).toEqual([['Rival 3 Gen 2', 'denied']]);
    expect(report.accessRule).toBeNull();
    expect((await mock.appInfo()).sendsSettings).toBe(true);
  });

  it('keeps the start-at-login choice in memory and has a tray', async () => {
    const mock = quick();
    expect((await mock.appInfo()).tray).toBe(true);
    expect(await mock.autostartStatus()).toEqual({ available: true, enabled: false });
    expect(await mock.setAutostart(true)).toEqual({ available: true, enabled: true });
    expect((await mock.autostartStatus()).enabled).toBe(true);
    await mock.setTrayTexts('Open', 'Quit');
    await mock.quit();
  });

  it('grants access and leaves the mouse its own settings', async () => {
    const mock = quick();
    expect(await mock.requestAccess()).toBe('done');
    const report = await mock.scan();
    expect(report.mockScenario).toBe('own');
    expect(report.devices[0]?.access).toBe('allowed');
    expect(report.accessRule).toMatch(/70-tune-rival3-gen2\.rules$/);
  });

  it('lists the unsupported devices with several devices plugged in', async () => {
    const mock = quick();
    await mock.setMockScenario('multi');
    expect(await names(mock)).toEqual(['Rival 3 Gen 2', 'Apex Pro TKL (2023)', 'Arctis Nova 7 Gen 2']);
    const report = await mock.scan();
    expect(report.devices.slice(1).every((d) => d.page === null && d.access === 'notChecked')).toBe(true);
  });

  it('shows no mouse when it is unplugged', async () => {
    const mock = quick();
    await mock.setMockScenario('unplugged');
    expect(await names(mock)).toEqual([]);
  });

  it('pauses sending under protection until resumed', async () => {
    const mock = quick();
    await mock.setMockScenario('guard');
    expect((await mock.scan()).reapplyPaused).toBe(true);
    expect(await mock.apply('1038:1870', 'rate', defaultDeviceSettings())).toBe('notSent');
    await mock.resumeReapply();
    expect((await mock.scan()).mockScenario).toBe('normal');
    expect(await mock.apply('1038:1870', 'rate', defaultDeviceSettings())).toBe('verified');
  });

  it('answers like the real mouse: the polling rate reads back, DPI and colour are echoed', async () => {
    const mock = quick();
    await mock.setMockScenario('normal');
    const settings = defaultDeviceSettings();
    expect(await mock.apply('1038:1870', 'dpi', settings)).toBe('echoed');
    expect(await mock.apply('1038:1870', 'rate', settings)).toBe('verified');
    expect(await mock.apply('1038:1870', 'light', settings)).toBe('echoed');
    expect((await mock.scan()).devices[0]?.instance).toBe('mock');
  });

  it('has the rule installed but not yet on the mouse', async () => {
    const mock = quick();
    await mock.setMockScenario('replug');
    const report = await mock.scan();
    expect(report.devices[0]?.access).toBe('denied');
    expect(report.accessRule).toMatch(/70-tune-rival3-gen2\.rules$/);
    expect(await mock.requestAccess()).toBe('done');
    const after = await mock.scan();
    expect(after.mockScenario).toBe('own');
    expect(after.devices[0]?.access).toBe('allowed');
  });

  it('removes access', async () => {
    const mock = quick();
    await mock.setMockScenario('normal');
    await mock.removeAccess();
    const report = await mock.scan();
    expect(report.mockScenario).toBe('noperm');
    expect(report.devices[0]?.access).toBe('denied');
    expect(report.accessRule).toBeNull();
  });

  it('keeps saved settings apart from the caller', async () => {
    const mock = quick();
    const settings = await mock.loadSettings();
    settings.firstRunDone = true;
    expect((await mock.loadSettings()).firstRunDone).toBe(false);
    await mock.saveSettings(settings);
    expect((await mock.loadSettings()).firstRunDone).toBe(true);
  });
});
