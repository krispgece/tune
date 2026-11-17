// The app's state and actions in one hook: settings, scanning, sending, permission and the mock scenarios.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  SETTING_GROUPS,
  type AccessRuleInfo,
  type ActionOutcome,
  type AppInfo,
  type Backend,
  type DeviceSettings,
  type Language,
  type LightMode,
  type ScanReport,
  type Scenario,
  type SettingGroup,
  type Settings,
  type Theme,
  type Zones,
} from '../backend';
import { translator } from '../i18n';
import { normalizeHex } from '../theme/color';
import { cssVariables, tokens, type Mode } from '../theme/tokens';
import { copyText } from '../state/clipboard';
import { deviceEntries, needsPermission, RIVAL_USB_ID, type DeviceEntry, type GroupStatus } from '../state/devices';
import type { DpiState } from '../state/dpi';
import { allManaged, defaultDeviceSettings, defaultSettings, deviceSettings, withDevice } from '../state/settings';

export type Screen = 'perf' | 'light' | 'device' | 'settings';
export type View = 'settings' | 'unsupported' | 'unplugged' | 'noperm' | 'device';
export type FirstRunStep = 'welcome' | 'scan' | 'perm' | 'ready';
export type PermState = 'idle' | 'waiting' | 'notAvailable' | 'stillDenied';
export type ToastKind = 'device' | 'perm' | 'settings';
export type Place = 'firstRun' | 'app';

const SAVE_DELAY = 250;
const SEND_DELAY = 150;
const SCAN_INTERVAL = 2000;
const TOAST_TIME = 2400;

const allStatus = (status: GroupStatus): Record<SettingGroup, GroupStatus> => ({
  dpi: status,
  rate: status,
  light: status,
});

function useSystemDark(): boolean {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, []);
  return dark;
}

export function useTune(backend: Backend) {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [rule, setRule] = useState<AccessRuleInfo | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanReport | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('perf');
  const [groupStatus, setGroupStatus] = useState(allStatus('ok'));
  const [dpiSelected, setDpiSelected] = useState<number | null>(null);
  const [firstRunStep, setFirstRunStep] = useState<FirstRunStep>('welcome');
  const [perm, setPerm] = useState<PermState>('idle');
  const [manualOpen, setManualOpen] = useState(false);
  const [removeHelp, setRemoveHelp] = useState(false);
  const [guardHidden, setGuardHidden] = useState(false);
  const [toast, setToast] = useState<ToastKind | null>(null);

  const latest = useRef<Settings | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const sendSeq = useRef<Record<SettingGroup, number>>({ dpi: 0, rate: 0, light: 0 });
  const sendTimers = useRef<Partial<Record<SettingGroup, number>>>({});
  const toastTimer = useRef<number | undefined>(undefined);
  const scanBusy = useRef(false);
  const permBusy = useRef(false);

  // Language and theme
  const language: Language = settings?.language ?? 'en';
  const i18n = useMemo(() => translator(language), [language]);
  const systemDark = useSystemDark();
  const theme: Theme = settings?.theme ?? 'system';
  const mode: Mode = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useLayoutEffect(() => {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(cssVariables(tokens(mode)))) root.style.setProperty(name, value);
    root.style.colorScheme = mode;
  }, [mode]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // Settings: changed here at once, saved shortly after the last change.
  const saveNow = useCallback(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = undefined;
    const current = latest.current;
    if (current) backend.saveSettings(current).catch((e: unknown) => console.error('Saving the settings failed:', e));
  }, [backend]);

  const update = useCallback(
    (change: (s: Settings) => Settings) => {
      const base = latest.current;
      if (!base) return;
      const next = change(base);
      latest.current = next;
      setSettings(next);
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(saveNow, SAVE_DELAY);
    },
    [saveNow],
  );

  useEffect(() => {
    const flush = () => {
      if (saveTimer.current !== undefined) saveNow();
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [saveNow]);

  // Scanning only lists devices; nothing is sent to them.
  const rescan = useCallback(async (): Promise<ScanReport | null> => {
    try {
      const report = await backend.scan();
      setScan(report);
      setScanError(null);
      return report;
    } catch (e) {
      setScanError(String(e));
      return null;
    }
  }, [backend]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [appInfo, accessRule, loaded] = await Promise.all([
        backend.appInfo(),
        backend.accessRule(),
        backend.loadSettings().catch((e: unknown) => {
          console.error('Loading the settings failed:', e);
          return defaultSettings();
        }),
      ]);
      if (!alive) return;
      setInfo(appInfo);
      setRule(accessRule);
      setGroupStatus(allStatus(appInfo.sendsSettings ? 'ok' : 'notSent'));
      latest.current = loaded;
      setSettings(loaded);
      await rescan();
    })().catch((e: unknown) => alive && setFatal(String(e)));
    return () => {
      alive = false;
    };
  }, [backend, rescan]);

  const loaded = settings !== null;
  useEffect(() => {
    if (!loaded) return;
    const id = window.setInterval(() => {
      if (scanBusy.current) return;
      scanBusy.current = true;
      void rescan().finally(() => {
        scanBusy.current = false;
      });
    }, SCAN_INTERVAL);
    return () => window.clearInterval(id);
  }, [loaded, rescan]);

  // What is selected and what the main area shows
  const entries = useMemo(() => deviceEntries(scan), [scan]);
  const selected: DeviceEntry = entries.find((e) => e.summary.id === selectedId) ?? (entries[0] as DeviceEntry);
  const usbId = selected.summary.usbId;
  const device: DeviceSettings = settings ? deviceSettings(settings, usbId) : defaultDeviceSettings();
  const paused = scan?.reapplyPaused ?? false;
  const isMock = info?.backend === 'mock';
  const sendsSettings = info?.sendsSettings ?? false;
  const presentPage = entries.find((e) => e.present && e.summary.page);
  const accessAllowed = presentPage ? presentPage.summary.access !== 'denied' : Boolean(scan?.accessRule);

  let view: View;
  if (screen === 'settings') view = 'settings';
  else if (!selected.summary.page) view = 'unsupported';
  else if (!selected.present) view = 'unplugged';
  else if (selected.summary.access === 'denied') view = 'noperm';
  else view = 'device';

  const showToast = (kind: ToastKind) => {
    setToast(kind);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_TIME);
  };

  const copy = async (text: string, kind: ToastKind) => {
    if (await copyText(text)) showToast(kind);
  };

  // Sending one setting group to the selected device
  const setOne = (group: SettingGroup, status: GroupStatus) => setGroupStatus((prev) => ({ ...prev, [group]: status }));

  const cancelSends = () => {
    for (const group of SETTING_GROUPS) {
      sendSeq.current[group] += 1;
      window.clearTimeout(sendTimers.current[group]);
    }
  };

  const send = (group: SettingGroup, deviceId: string) => {
    sendSeq.current[group] += 1;
    const n = sendSeq.current[group];
    window.clearTimeout(sendTimers.current[group]);
    if (!sendsSettings) {
      setOne(group, 'notSent');
      return;
    }
    setOne(group, 'sending');
    sendTimers.current[group] = window.setTimeout(() => {
      backend.apply(deviceId, group).then(
        (outcome) => sendSeq.current[group] === n && setOne(group, outcome === 'received' ? 'ok' : 'notSent'),
        () => sendSeq.current[group] === n && setOne(group, 'notSent'),
      );
    }, SEND_DELAY);
  };

  /** Changes a setting group of the selected device; from then on the app manages that group. */
  const touch = (group: SettingGroup, change: (d: DeviceSettings) => DeviceSettings) => {
    update((s) => {
      const next = change(deviceSettings(s, usbId));
      return withDevice(s, usbId, { ...next, managed: { ...next.managed, [group]: true } });
    });
    if (!paused) send(group, selected.summary.id);
  };

  const setDpi = (next: DpiState) => {
    setDpiSelected(next.selected);
    touch('dpi', (d) => ({ ...d, dpiStages: next.stages, startStage: next.start }));
  };

  const setRate = (hz: number) => {
    if (hz !== device.pollRateHz) touch('rate', (d) => ({ ...d, pollRateHz: hz }));
  };

  const setLightMode = (lightMode: LightMode) => {
    if (lightMode !== device.lightMode) touch('light', (d) => ({ ...d, lightMode }));
  };

  const pickColor = (value: string) => {
    const color = normalizeHex(value);
    if (color && color !== device.color) touch('light', (d) => ({ ...d, color }));
  };

  const setZone = (zone: keyof Zones, value: string) => {
    const color = normalizeHex(value);
    if (color && color !== device.zones[zone]) touch('light', (d) => ({ ...d, zones: { ...d.zones, [zone]: color } }));
  };

  const stopManaging = () => {
    cancelSends();
    update((s) => withDevice(s, usbId, { ...deviceSettings(s, usbId), managed: allManaged(false) }));
  };

  // The mock's scenarios, mirrored in the interface's own state the way the approved mockup does it
  const applyScenario = async (scenario: Scenario) => {
    await backend.setMockScenario(scenario);
    cancelSends();
    setGroupStatus(allStatus(sendsSettings ? 'ok' : 'notSent'));
    setToast(null);
    setPerm('idle');
    setManualOpen(false);
    setRemoveHelp(false);
    setGuardHidden(false);
    setDpiSelected(null);
    update((s) => ({
      ...withDevice(s, RIVAL_USB_ID, { ...deviceSettings(s, RIVAL_USB_ID), managed: allManaged(scenario !== 'own') }),
      firstRunDone: scenario !== 'setup',
    }));
    if (scenario === 'setup') setFirstRunStep('welcome');
    if (scenario !== 'multi') setSelectedId(null);
    await rescan();
  };

  const finishFirstRun = async (next: 'own' | 'noperm') => {
    if (isMock) await applyScenario(next);
    else update((s) => ({ ...s, firstRunDone: true }));
    setSelectedId(null);
    setScreen('perf');
  };

  // Permission
  const allow = async (place: Place) => {
    if (permBusy.current) return;
    permBusy.current = true;
    setPerm('waiting');
    let outcome: ActionOutcome;
    try {
      outcome = await backend.requestAccess();
    } catch {
      outcome = 'notAvailable';
    }
    permBusy.current = false;
    if (outcome !== 'done') {
      setPerm('notAvailable');
      setManualOpen(true);
      return;
    }
    setPerm('idle');
    setManualOpen(false);
    await rescan();
    if (place === 'firstRun') setFirstRunStep('ready');
    else if (isMock) await applyScenario('own');
  };

  const checkAgain = async (place: Place) => {
    const report = await rescan();
    if (report && !needsPermission(report)) {
      setPerm('idle');
      setManualOpen(false);
      if (place === 'firstRun') setFirstRunStep('ready');
    } else {
      setPerm('stillDenied');
    }
  };

  const removeAccess = async () => {
    let outcome: ActionOutcome;
    try {
      outcome = await backend.removeAccess();
    } catch {
      outcome = 'notAvailable';
    }
    if (outcome !== 'done') {
      setRemoveHelp(true);
      return;
    }
    setRemoveHelp(false);
    if (isMock) await applyScenario('noperm');
    else await rescan();
  };

  const retry = async () => {
    try {
      await backend.resumeReapply();
    } catch (e) {
      console.error('Resuming failed:', e);
    }
    setGuardHidden(false);
    const report = await rescan();
    if (report?.reapplyPaused) return;
    for (const group of SETTING_GROUPS) if (device.managed[group]) send(group, selected.summary.id);
  };

  return {
    // state
    info,
    rule,
    settings,
    fatal,
    scan,
    scanError,
    entries,
    selected,
    device,
    paused,
    isMock,
    sendsSettings,
    accessAllowed,
    view,
    screen,
    groupStatus,
    dpiSelected,
    firstRunStep,
    perm,
    manualOpen,
    removeHelp,
    guardHidden,
    toast,
    i18n,
    mode,
    theme,
    // actions
    rescan,
    copy,
    setScreen: (next: Screen) => setScreen(next),
    pick: (id: string) => {
      setSelectedId(id);
      setDpiSelected(null);
      if (screen === 'settings') setScreen('perf');
    },
    setLanguage: (lang: Language) => update((s) => ({ ...s, language: lang })),
    setTheme: (next: Theme) => update((s) => ({ ...s, theme: next })),
    toggleTheme: () => update((s) => ({ ...s, theme: mode === 'dark' ? 'light' : 'dark' })),
    setFirstRunStep,
    finishFirstRun,
    setManualOpen,
    allow,
    checkAgain,
    removeAccess,
    selectStage: (index: number) => setDpiSelected(index),
    setDpi,
    setRate,
    setLightMode,
    pickColor,
    setZone,
    stopManaging,
    retry,
    keepOff: () => setGuardHidden(true),
    applyScenario,
  };
}

export type Tune = ReturnType<typeof useTune>;
