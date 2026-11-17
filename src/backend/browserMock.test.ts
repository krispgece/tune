import { describe, expect, it } from 'vitest';

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
    expect(await mock.apply()).toBe('notSent');
    await mock.resumeReapply();
    expect((await mock.scan()).mockScenario).toBe('normal');
    expect(await mock.apply()).toBe('received');
  });

  it('removes access', async () => {
    const mock = quick();
    await mock.setMockScenario('normal');
    await mock.removeAccess();
    const report = await mock.scan();
    expect(report.mockScenario).toBe('noperm');
    expect(report.devices[0]?.access).toBe('denied');
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
