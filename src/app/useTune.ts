// The app's state and actions in one hook: settings, scanning, sending, permission and the mock scenarios.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  type AccessRuleInfo,
  type ActionOutcome,
  type AppInfo,
  type ApplyOutcome,
  type AutostartStatus,
  type Backend,
  type DeviceSettings,
  type DeviceSummary,
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
import {
  deviceEntries,
  dpiSyncAfter,
  needsPermission,
  needsReplug,
  planReapply,
  RIVAL_USB_ID,
  type DeviceEntry,
  type GroupStatus,
} from '../state/devices';
import type { DpiState } from '../state/dpi';
import { allManaged, defaultDeviceSettings, defaultSettings, deviceSettings, withDevice } from '../state/settings';

export type Screen = 'perf' | 'light' | 'device' | 'settings';
export type View = 'settings' | 'unsupported' | 'unplugged' | 'noperm' | 'device';
export type FirstRunStep = 'welcome' | 'scan' | 'perm' | 'ready';
export type PermState = 'idle' | 'waiting' | 'notAvailable' | 'stillDenied';
export type ToastKind = 'device' | 'perm' | 'settings';
export type Place = 'firstRun' | 'app';

const SAVE_DELAY = 250;
/** How long a group waits for further changes before it is sent. DPI waits longer: the mouse stores it each time. */
const SEND_DELAY: Record<SettingGroup, number> = { dpi: 600, rate: 150, light: 150 };
/** How long a mouse that has just come back gets before its settings go out again. */
const REAPPLY_DELAY = 1000;
const SCAN_INTERVAL = 2000;
const TOAST_TIME = 2400;

type StatusMap = Record<string, Partial<Record<SettingGroup, GroupStatus>>>;
const OUTCOME_STATUS: Record<ApplyOutcome, GroupStatus> = {
  sent: 'sent',
  echoed: 'echoed',
  verified: 'verified',
  notSent: 'notSent',
};
const sendKey = (deviceId: string, group: SettingGroup) => `${deviceId}|${group}`;

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
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [dpiSelected, setDpiSelected] = useState<number | null>(null);
  const [firstRunStep, setFirstRunStep] = useState<FirstRunStep>('welcome');
  const [perm, setPerm] = useState<PermState>('idle');
  const [manualOpen, setManualOpen] = useState(false);
  const [removeHelp, setRemoveHelp] = useState(false);
  const [guardHidden, setGuardHidden] = useState(false);
  const [toast, setToast] = useState<ToastKind | null>(null);
  const [autostart, setAutostartStatus] = useState<AutostartStatus | null>(null);
  const [autostartFailed, setAutostartFailed] = useState(false);

  const latest = useRef<Settings | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const sendSeq = useRef<Record<string, number>>({});
  const sendTimers = useRef<Record<string, number | undefined>>({});
  /** The plug-in each reachable device last got its settings for, by device id. */
  const reapplied = useRef(new Map<string, string>());
  /** The wakes from sleep the last scan reported. */
  const wakes = useRef<number | null>(null);
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

  useEffect(() => {
    backend
      .setTrayTexts(i18n.t('trayOpen'), i18n.t('trayQuit'))
      .catch((e: unknown) => console.error('Updating the tray menu failed:', e));
  }, [backend, i18n]);

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
      backend.autostartStatus().then(
        (status) => alive && setAutostartStatus(status),
        (e: unknown) => console.error('Reading the start-at-login choice failed:', e),
      );
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
  const fallbackStatus: GroupStatus = sendsSettings ? 'idle' : 'notSent';
  const ownStatus = statuses[selected.summary.id] ?? {};
  const groupStatus: Record<SettingGroup, GroupStatus> = {
    dpi: ownStatus.dpi ?? fallbackStatus,
    rate: ownStatus.rate ?? fallbackStatus,
    light: ownStatus.light ?? fallbackStatus,
  };
  const presentPage = entries.find((e) => e.present && e.summary.page);
  const accessAllowed = presentPage ? presentPage.summary.access !== 'denied' : Boolean(scan?.accessRule);

  let view: View;
  if (screen === 'settings') view = 'settings';
  else if (!selected.summary.page) view = 'unsupported';
  else if (!selected.present) view = 'unplugged';
  else if (selected.summary.access === 'denied') view = 'noperm';
  else view = 'device';

  const replug = needsReplug(scan);
  const firstRunOpen = settings ? !settings.firstRunDone : false;
  const mouseReachable = Boolean(presentPage) && accessAllowed;

  // The permission step moves on by itself once the mouse can be reached, as after a replug.
  useEffect(() => {
    if (!firstRunOpen || firstRunStep !== 'perm' || perm === 'waiting' || !mouseReachable) return;
    setPerm('idle');
    setManualOpen(false);
    setFirstRunStep('ready');
  }, [firstRunOpen, firstRunStep, perm, mouseReachable]);

  const showToast = (kind: ToastKind) => {
    setToast(kind);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_TIME);
  };

  const copy = async (text: string, kind: ToastKind) => {
    if (await copyText(text)) showToast(kind);
  };

  // Sending setting groups to a device
  const setOne = (deviceId: string, group: SettingGroup, status: GroupStatus) =>
    setStatuses((prev) => ({ ...prev, [deviceId]: { ...prev[deviceId], [group]: status } }));

  /** Makes the earlier sends of one group to one device stale: a waiting one is dropped, an answer is ignored. */
  const supersede = (deviceId: string, group: SettingGroup): number => {
    const key = sendKey(deviceId, group);
    const n = (sendSeq.current[key] ?? 0) + 1;
    sendSeq.current[key] = n;
    window.clearTimeout(sendTimers.current[key]);
    return n;
  };

  /** Drops the sends that haven't finished, for one device or for all; their answers are ignored. */
  const cancelSends = (deviceId?: string) => {
    for (const key of Object.keys(sendSeq.current)) {
      if (deviceId !== undefined && !key.startsWith(`${deviceId}|`)) continue;
      sendSeq.current[key] = (sendSeq.current[key] ?? 0) + 1;
      window.clearTimeout(sendTimers.current[key]);
    }
  };

  /**
   * Records what the mouse answered to the DPI stages it was sent. An answer that is still current belongs to the
   * stages kept here: every DPI change makes the sends before it stale.
   */
  const dpiAnswered = (usb: string, outcome: ApplyOutcome) => {
    const current = latest.current;
    if (!current) return;
    const device = deviceSettings(current, usb);
    const sync = dpiSyncAfter(device.dpiSync, outcome);
    if (sync !== device.dpiSync) update((s) => withDevice(s, usb, { ...deviceSettings(s, usb), dpiSync: sync }));
  };

  /** Sends one setting group with the values it has when the wait is over; a newer send of it replaces this one. */
  const send = (target: DeviceSummary, group: SettingGroup, delay = SEND_DELAY[group]) => {
    const key = sendKey(target.id, group);
    const n = supersede(target.id, group);
    if (!sendsSettings) {
      setOne(target.id, group, 'notSent');
      return;
    }
    setOne(target.id, group, 'sending');
    sendTimers.current[key] = window.setTimeout(() => {
      const current = latest.current;
      if (!current) return;
      backend.apply(target.id, group, deviceSettings(current, target.usbId)).then(
        (outcome) => {
          if (sendSeq.current[key] !== n) return;
          setOne(target.id, group, OUTCOME_STATUS[outcome]);
          if (group === 'dpi') dpiAnswered(target.usbId, outcome);
        },
        (e: unknown) => {
          console.error('Sending failed:', e);
          if (sendSeq.current[key] === n) setOne(target.id, group, 'failed');
        },
      );
    }, delay);
  };

  // A device that comes back (plugged in, reachable again, or found when the app starts or the computer wakes)
  // gets the settings it forgets. Nothing goes out while re-applying is paused.
  useEffect(() => {
    const current = latest.current;
    if (!scan || !loaded || !current) return;
    const plan = planReapply(
      scan,
      { reapplied: reapplied.current, wakes: wakes.current },
      current,
      sendsSettings && !scan.reapplyPaused,
    );
    reapplied.current = plan.memory.reapplied;
    wakes.current = plan.memory.wakes;
    for (const { target, groups } of plan.sends) for (const group of groups) send(target, group, REAPPLY_DELAY);
    // `send` reads the values when it fires, so only a new scan needs to run this again.
  }, [scan, loaded, sendsSettings]);

  /** Changes a setting group of the selected device; from then on the app manages that group. */
  const touch = (group: SettingGroup, change: (d: DeviceSettings) => DeviceSettings) => {
    update((s) => {
      const next = change(deviceSettings(s, usbId));
      return withDevice(s, usbId, {
        ...next,
        managed: { ...next.managed, [group]: true },
        dpiSync: group === 'dpi' ? 'pending' : next.dpiSync,
      });
    });
    // While paused nothing goes out, but an answer still on its way belongs to the values before this change.
    if (paused) supersede(selected.summary.id, group);
    else send(selected.summary, group);
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
    cancelSends(selected.summary.id);
    update((s) => withDevice(s, usbId, { ...deviceSettings(s, usbId), managed: allManaged(false) }));
  };

  // The mock's scenarios, mirrored in the interface's own state
  const applyScenario = async (scenario: Scenario) => {
    await backend.setMockScenario(scenario);
    cancelSends();
    setStatuses({});
    reapplied.current.clear();
    setToast(null);
    setPerm('idle');
    setManualOpen(false);
    setRemoveHelp(false);
    setGuardHidden(false);
    setDpiSelected(null);
    update((s) => ({
      ...withDevice(s, RIVAL_USB_ID, {
        ...deviceSettings(s, RIVAL_USB_ID),
        managed: allManaged(scenario !== 'own'),
        dpiSync: 'onMouse',
      }),
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

  const setAutostart = async (enabled: boolean) => {
    try {
      setAutostartStatus(await backend.setAutostart(enabled));
      setAutostartFailed(false);
    } catch (e) {
      console.error('Changing the start-at-login choice failed:', e);
      setAutostartFailed(true);
    }
  };

  const quit = () => backend.quit().catch((e: unknown) => console.error('Quitting failed:', e));

  const retry = async () => {
    try {
      await backend.resumeReapply();
    } catch (e) {
      console.error('Resuming failed:', e);
    }
    setGuardHidden(false);
    // Every reachable device counts as come back, so the next scan sends its settings again.
    reapplied.current.clear();
    await rescan();
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
    replug,
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
    autostart,
    autostartFailed,
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
    setAutostart,
    quit,
    keepOff: () => setGuardHidden(true),
    applyScenario,
  };
}

export type Tune = ReturnType<typeof useTune>;
