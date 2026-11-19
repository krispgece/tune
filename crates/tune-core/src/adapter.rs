//! The one place that calls the ssgg library (`steelseries_gg`).
//!
//! Listing reads what the system already knows about each USB device and opens none of them. Sending opens the
//! settings interface of one mouse for one setting group, sends it through the library and closes it again.

use std::collections::{HashMap, HashSet};
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant};

use steelseries_gg::devices::hid_reports::MouseDpiStagesCommand;
use steelseries_gg::devices::mice::modern::{MouseModel, model_for};
use steelseries_gg::devices::mice::{Mouse, SettingAck};
use steelseries_gg::devices::{DeviceInfo, DeviceManager, DeviceType, product_ids};
use steelseries_gg::rgb::Color;

use crate::access::{installed_rule, node_access, node_instance};
use crate::backend::{Backend, BackendKind};
use crate::model::{
    ActionOutcome, ApplyOutcome, Connection, DeviceAccess, DeviceKind, DevicePage, DeviceSummary, MouseCaps,
    ScanReport, SettingGroup, sort_devices, usb_id,
};
use crate::settings::{DeviceSettings, LightMode};
use crate::sleep::{WakeCounter, time_asleep};
use crate::{Error, Result};

/// Polling rates a Rival 3 Gen 2 offers, in Hz.
const POLL_RATES: [u32; 4] = [125, 250, 500, 1000];

/// The least time between the end of one send and the start of the next.
const SEND_SPACING: Duration = Duration::from_millis(50);

/// A device that drops off this soon after Tune sent it something counts towards the safety pause.
const DROP_AFTER_SEND: Duration = Duration::from_secs(5);
/// How long a drop keeps counting.
const DROP_WINDOW: Duration = Duration::from_secs(60);
/// Drops within the window that pause re-applying.
const DROPS_TO_PAUSE: usize = 2;

/// Real devices through ssgg.
#[derive(Debug, Default)]
pub struct SsggBackend {
    guard: Mutex<Guard>,
    wakes: Mutex<WakeCounter>,
    /// Held while sending, so two setting groups never reach a device at once. Holds when the last send ended.
    sending: Mutex<Option<Instant>>,
    /// A file that exists while re-applying is paused, so the pause holds across restarts until the user resumes.
    pause_file: Option<PathBuf>,
}

impl SsggBackend {
    pub fn new() -> Self {
        Self::default()
    }

    /// Keeps the safety pause in `path`: a pause left there by an earlier run starts this one paused.
    pub fn with_pause_file(path: impl Into<PathBuf>) -> Self {
        let path = path.into();
        let backend = Self {
            pause_file: Some(path.clone()),
            ..Self::default()
        };
        backend.guard().paused = matches!(path.try_exists(), Ok(true));
        backend
    }

    fn guard(&self) -> MutexGuard<'_, Guard> {
        self.guard.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// Counts the drops among the instances plugged in now and says whether re-applying is paused. A new pause is
    /// written to the pause file; if that fails, it still holds until Tune quits.
    fn observe_guard(&self, present: &HashSet<String>, now: Instant) -> bool {
        let mut guard = self.guard();
        let was_paused = guard.paused;
        guard.observe(present, now);
        let paused = guard.paused;
        drop(guard);
        if paused
            && !was_paused
            && let Some(path) = &self.pause_file
            && let Err(error) = write_pause_file(path)
        {
            eprintln!("Could not keep the safety pause in {}: {error}", path.display());
        }
        paused
    }

    fn send(&self, device_id: &str, group: SettingGroup, settings: &DeviceSettings) -> Result<ApplyOutcome> {
        let manager = DeviceManager::new().map_err(|e| Error::Scan(e.to_string()))?;
        let info = manager
            .devices_by_type(DeviceType::Mouse)
            .into_iter()
            .find(|info| page_for(info.product_id).is_some() && device_id_of(info) == device_id)
            .ok_or(Error::DeviceGone)?;
        self.guard().sent(&node_instance(&info.path), Instant::now());
        let mut mouse = manager.open_mouse(info).map_err(send_error)?;
        send_group(mouse.as_mut(), group, settings)
    }
}

impl Backend for SsggBackend {
    fn kind(&self) -> BackendKind {
        BackendKind::Device
    }

    fn sends_settings(&self) -> bool {
        true
    }

    fn scan(&self) -> Result<ScanReport> {
        let manager = DeviceManager::new().map_err(|e| Error::Scan(e.to_string()))?;
        let mut devices: Vec<DeviceSummary> = [DeviceType::Mouse, DeviceType::Keyboard, DeviceType::Headset]
            .into_iter()
            .flat_map(|device_type| manager.devices_by_type(device_type))
            .filter_map(|info| summarize(info, node_access, node_instance))
            .collect();
        sort_devices(&mut devices);
        let present: HashSet<String> = devices
            .iter()
            .filter(|device| device.page.is_some())
            .map(|device| device.instance.clone())
            .collect();
        let wakes = self
            .wakes
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .observe(time_asleep());
        let reapply_paused = self.observe_guard(&present, Instant::now());
        Ok(ScanReport {
            devices,
            access_rule: installed_rule().map(|path| path.to_string_lossy().into_owned()),
            reapply_paused,
            wakes,
            mock_scenario: None,
        })
    }

    fn apply(&self, device_id: &str, group: SettingGroup, settings: &DeviceSettings) -> Result<ApplyOutcome> {
        let mut last_end = self.sending.lock().unwrap_or_else(PoisonError::into_inner);
        if self.guard().paused {
            return Ok(ApplyOutcome::NotSent);
        }
        if let Some(wait) = last_end.and_then(|end| SEND_SPACING.checked_sub(end.elapsed())) {
            std::thread::sleep(wait);
        }
        let outcome = self.send(device_id, group, settings);
        *last_end = Some(Instant::now());
        outcome
    }

    fn request_access(&self) -> ActionOutcome {
        ActionOutcome::NotAvailable
    }

    fn remove_access(&self) -> ActionOutcome {
        ActionOutcome::NotAvailable
    }

    fn resume_reapply(&self) -> ActionOutcome {
        self.guard().resume();
        if let Some(path) = &self.pause_file
            && let Err(error) = std::fs::remove_file(path)
            && error.kind() != ErrorKind::NotFound
        {
            eprintln!("Could not clear the safety pause in {}: {error}", path.display());
        }
        ActionOutcome::Done
    }
}

fn write_pause_file(path: &Path) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    std::fs::write(
        path,
        "Tune stopped sending settings after a device dropped off twice right after a send.\n\
         Use Try again in Tune to send again.\n",
    )
}

/// Pauses re-applying when a device drops off twice in a short time right after Tune sent it something, so a setting
/// that knocks a device off its port is not sent to it again and again.
#[derive(Debug, Default)]
struct Guard {
    /// When Tune last sent something to each plugged-in device, by instance.
    last_sent: HashMap<String, Instant>,
    /// When the drops were noticed.
    drops: Vec<Instant>,
    paused: bool,
}

impl Guard {
    fn sent(&mut self, instance: &str, now: Instant) {
        self.last_sent.insert(instance.to_owned(), now);
    }

    /// Takes the instances that are plugged in now and counts the ones that dropped off soon after a send.
    fn observe(&mut self, present: &HashSet<String>, now: Instant) {
        let mut dropped = 0;
        self.last_sent.retain(|instance, sent| {
            if present.contains(instance) {
                return true;
            }
            if now.saturating_duration_since(*sent) <= DROP_AFTER_SEND {
                dropped += 1;
            }
            false
        });
        self.drops.extend(std::iter::repeat_n(now, dropped));
        self.drops
            .retain(|noticed| now.saturating_duration_since(*noticed) <= DROP_WINDOW);
        if self.drops.len() >= DROPS_TO_PAUSE {
            self.paused = true;
        }
    }

    fn resume(&mut self) {
        self.paused = false;
        self.drops.clear();
    }
}

/// One colour change of a lighting send.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Light {
    /// Every zone the same colour.
    All(Color),
    /// One zone, counted from the front.
    Zone(u8, Color),
}

/// Sends one setting group to an open mouse and says what it answered.
fn send_group(mouse: &mut dyn Mouse, group: SettingGroup, settings: &DeviceSettings) -> Result<ApplyOutcome> {
    let mut answers: Vec<SettingAck> = Vec::new();
    match group {
        SettingGroup::Dpi => {
            let stages = dpi_stages(settings)?;
            match stages.as_slice() {
                [single] => mouse.set_dpi(*single),
                _ => mouse.set_dpi_stages(&stages, start_stage(settings)?),
            }
            .map_err(send_error)?;
            answers.extend_from_slice(mouse.last_acknowledgements());
        }
        SettingGroup::Rate => {
            let hz = u16::try_from(settings.poll_rate_hz)
                .map_err(|_| Error::Send(format!("{} Hz is not a polling rate", settings.poll_rate_hz)))?;
            mouse.set_poll_rate(hz).map_err(send_error)?;
            answers.extend_from_slice(mouse.last_acknowledgements());
            // Only a read-back naming the rate just set counts; any other answer leaves the outcome to the echo.
            if let Ok(Some(readback)) = mouse.poll_rate_readback()
                && readback.hz == Some(hz)
            {
                return Ok(ApplyOutcome::Verified);
            }
        }
        SettingGroup::Light => {
            for light in lights(settings)? {
                match light {
                    Light::All(color) => mouse.set_color(color),
                    Light::Zone(zone, color) => mouse.set_zone_color(zone, color),
                }
                .map_err(send_error)?;
                answers.extend_from_slice(mouse.last_acknowledgements());
            }
        }
    }
    Ok(outcome_of(&answers))
}

/// `Echoed` when the mouse answered every part of the send and reported no problem, `Sent` otherwise.
fn outcome_of(answers: &[SettingAck]) -> ApplyOutcome {
    let taken = !answers.is_empty()
        && answers
            .iter()
            .all(|answer| matches!(answer, SettingAck::Echoed { status: 0, .. }));
    if taken {
        ApplyOutcome::Echoed
    } else {
        ApplyOutcome::Sent
    }
}

fn dpi_stages(settings: &DeviceSettings) -> Result<Vec<u16>> {
    settings
        .dpi_stages
        .iter()
        .map(|dpi| u16::try_from(*dpi).map_err(|_| Error::Send(format!("{dpi} DPI is out of range"))))
        .collect()
}

fn start_stage(settings: &DeviceSettings) -> Result<u8> {
    u8::try_from(settings.start_stage)
        .map_err(|_| Error::Send(format!("stage {} is out of range", settings.start_stage + 1)))
}

/// The colours a lighting send sets: one colour on every zone, or front, middle and rear each their own.
fn lights(settings: &DeviceSettings) -> Result<Vec<Light>> {
    Ok(match settings.light_mode {
        LightMode::Single => vec![Light::All(color(&settings.color)?)],
        LightMode::Off => vec![Light::All(Color::BLACK)],
        LightMode::Zones => vec![
            Light::Zone(0, color(&settings.zones.front)?),
            Light::Zone(1, color(&settings.zones.middle)?),
            Light::Zone(2, color(&settings.zones.rear)?),
        ],
    })
}

fn color(hex: &str) -> Result<Color> {
    Color::parse(hex).ok_or_else(|| Error::Send(format!("{hex} is not a colour")))
}

fn send_error(error: steelseries_gg::Error) -> Error {
    Error::Send(error.to_string())
}

/// The id the app knows a device by: its USB id, and its serial number when it reports one.
fn device_id_of(info: &DeviceInfo) -> String {
    let usb = usb_id(info.vendor_id, info.product_id);
    match info.serial_number.as_deref().map(str::trim) {
        Some(serial) if !serial.is_empty() => format!("{usb}/{serial}"),
        _ => usb,
    }
}

/// Maps one device that ssgg recognized to what the app shows. `check_access` and `instance_of` are only asked about
/// devices Tune has a page for, with the path of their settings interface. Devices of an unknown type are left out.
pub fn summarize(
    info: &DeviceInfo,
    check_access: impl Fn(&str) -> DeviceAccess,
    instance_of: impl Fn(&str) -> String,
) -> Option<DeviceSummary> {
    let kind = match info.device_type {
        DeviceType::Mouse => DeviceKind::Mouse,
        DeviceType::Keyboard => DeviceKind::Keyboard,
        DeviceType::Headset => DeviceKind::Headset,
        DeviceType::Unknown => return None,
    };
    let model = (kind == DeviceKind::Mouse)
        .then(|| model_for(info.product_id))
        .flatten();
    let page = page_for(info.product_id);
    Some(DeviceSummary {
        id: device_id_of(info),
        usb_id: usb_id(info.vendor_id, info.product_id),
        name: info.name.to_string(),
        kind,
        connection: match model {
            Some(model) if model.dongle => Connection::Receiver,
            Some(_) => Connection::Wired,
            None => Connection::Unknown,
        },
        page,
        access: if page.is_some() {
            check_access(&info.path)
        } else {
            DeviceAccess::NotChecked
        },
        caps: page.and(model).map(mouse_caps),
        instance: if page.is_some() {
            instance_of(&info.path)
        } else {
            info.path.clone()
        },
    })
}

fn page_for(product_id: u16) -> Option<DevicePage> {
    (product_id == product_ids::RIVAL_3_GEN_2).then_some(DevicePage::Rival3Gen2)
}

fn mouse_caps(model: &MouseModel) -> MouseCaps {
    let dpi = &model.spec.dpi;
    MouseCaps {
        dpi_min: dpi.min.into(),
        dpi_max: dpi.max.into(),
        dpi_step: dpi.step.into(),
        max_stages: if dpi.multi_stage {
            MouseDpiStagesCommand::MAX_STAGES
        } else {
            1
        },
        poll_rates: POLL_RATES.to_vec(),
        zones: model.spec.zone_count,
    }
}

#[cfg(test)]
mod tests {
    use std::borrow::Cow;
    use std::cell::RefCell;
    use std::collections::VecDeque;

    use steelseries_gg::devices::Device;
    use steelseries_gg::devices::mice::PollRateReadback;

    use super::*;
    use crate::settings::Zones;

    fn info(device_type: DeviceType, product_id: u16, name: &'static str, serial: Option<&str>) -> DeviceInfo {
        DeviceInfo {
            name: Cow::Borrowed(name),
            device_type,
            vendor_id: 0x1038,
            product_id,
            interface_number: 3,
            usage_page: 0xFFC0,
            usage: 1,
            serial_number: serial.map(str::to_owned),
            manufacturer: Some("SteelSeries".to_owned()),
            path: "/dev/hidraw7".to_owned(),
        }
    }

    fn plug_in(path: &str) -> String {
        format!("plug-in of {path}")
    }

    #[test]
    fn the_rival_3_gen_2_gets_its_page_caps_and_an_access_check() -> std::result::Result<(), String> {
        let asked = RefCell::new(Vec::new());
        let check = |path: &str| {
            asked.borrow_mut().push(path.to_owned());
            DeviceAccess::Denied
        };
        let summary = summarize(&info(DeviceType::Mouse, 0x1870, "Rival 3 Gen 2", None), check, plug_in)
            .ok_or("the mouse was left out")?;

        assert_eq!(summary.id, "1038:1870");
        assert_eq!(summary.usb_id, "1038:1870");
        assert_eq!(summary.name, "Rival 3 Gen 2");
        assert_eq!(summary.kind, DeviceKind::Mouse);
        assert_eq!(summary.connection, Connection::Wired);
        assert_eq!(summary.page, Some(DevicePage::Rival3Gen2));
        assert_eq!(summary.access, DeviceAccess::Denied);
        assert_eq!(summary.instance, "plug-in of /dev/hidraw7");
        assert_eq!(asked.borrow().as_slice(), ["/dev/hidraw7"]);
        let caps = summary.caps.ok_or("no caps")?;
        assert_eq!((caps.dpi_min, caps.dpi_max, caps.dpi_step), (200, 8500, 100));
        assert_eq!(caps.max_stages, 5);
        assert_eq!(caps.poll_rates, [125, 250, 500, 1000]);
        assert_eq!(caps.zones, 3);
        Ok(())
    }

    #[test]
    fn devices_without_a_page_are_listed_but_never_checked() -> std::result::Result<(), String> {
        let check = |_: &str| -> DeviceAccess { panic!("an unsupported device was checked") };
        let instance = |_: &str| -> String { panic!("an unsupported device was looked up") };
        let keyboard = summarize(
            &info(DeviceType::Keyboard, 0x1628, "Apex Pro TKL (2023)", None),
            check,
            instance,
        )
        .ok_or("the keyboard was left out")?;
        assert_eq!(keyboard.kind, DeviceKind::Keyboard);
        assert_eq!(keyboard.page, None);
        assert_eq!(keyboard.access, DeviceAccess::NotChecked);
        assert_eq!(keyboard.connection, Connection::Unknown);
        assert_eq!(keyboard.caps, None);
        assert_eq!(keyboard.instance, "/dev/hidraw7");

        let headset = summarize(
            &info(DeviceType::Headset, 0x227E, "Arctis Nova 7 Gen 2", None),
            check,
            instance,
        )
        .ok_or("the headset was left out")?;
        assert_eq!(headset.kind, DeviceKind::Headset);
        assert_eq!(headset.access, DeviceAccess::NotChecked);
        Ok(())
    }

    #[test]
    fn other_mice_show_their_connection_but_get_no_page() -> std::result::Result<(), String> {
        let check = |_: &str| -> DeviceAccess { panic!("an unsupported mouse was checked") };
        // Aerox 3 Wireless through its 2.4 GHz receiver.
        let mouse = summarize(
            &info(DeviceType::Mouse, 0x1838, "Aerox 3 Wireless", None),
            check,
            plug_in,
        )
        .ok_or("the mouse was left out")?;
        assert_eq!(mouse.connection, Connection::Receiver);
        assert_eq!(mouse.page, None);
        assert_eq!(mouse.caps, None);
        Ok(())
    }

    #[test]
    fn unknown_devices_are_left_out() {
        let summary = summarize(
            &info(DeviceType::Unknown, 0x0001, "Unknown", None),
            |_| DeviceAccess::Allowed,
            plug_in,
        );
        assert_eq!(summary, None);
    }

    #[test]
    fn a_serial_number_keeps_two_identical_devices_apart() -> std::result::Result<(), String> {
        let with_serial = summarize(
            &info(DeviceType::Mouse, 0x1870, "Rival 3 Gen 2", Some(" ABC123 ")),
            |_| DeviceAccess::Allowed,
            plug_in,
        )
        .ok_or("left out")?;
        assert_eq!(with_serial.id, "1038:1870/ABC123");
        assert_eq!(with_serial.usb_id, "1038:1870");

        let blank_serial = summarize(
            &info(DeviceType::Mouse, 0x1870, "Rival 3 Gen 2", Some("  ")),
            |_| DeviceAccess::Allowed,
            plug_in,
        )
        .ok_or("left out")?;
        assert_eq!(blank_serial.id, "1038:1870");
        Ok(())
    }

    #[test]
    fn the_real_backend_sends_and_can_resume_but_cannot_install_the_rule() {
        let backend = SsggBackend::new();
        assert_eq!(backend.kind(), BackendKind::Device);
        assert!(backend.sends_settings());
        assert_eq!(backend.request_access(), ActionOutcome::NotAvailable);
        assert_eq!(backend.remove_access(), ActionOutcome::NotAvailable);
        assert_eq!(backend.resume_reapply(), ActionOutcome::Done);
        assert!(backend.set_mock_scenario(crate::model::Scenario::Normal).is_err());
    }

    #[test]
    fn nothing_is_sent_while_paused() -> Result<()> {
        let backend = SsggBackend::new();
        backend.guard().paused = true;
        // An id no device has, so nothing could be reached even if the pause check moved.
        let outcome = backend.apply("test:none", SettingGroup::Dpi, &DeviceSettings::default())?;
        assert_eq!(outcome, ApplyOutcome::NotSent);
        Ok(())
    }

    fn echoed(status: u8) -> SettingAck {
        SettingAck::Echoed { opcode: 1, status }
    }

    #[test]
    fn only_a_clean_answer_to_every_part_counts_as_echoed() {
        assert_eq!(outcome_of(&[echoed(0)]), ApplyOutcome::Echoed);
        assert_eq!(outcome_of(&[echoed(0), echoed(0), echoed(0)]), ApplyOutcome::Echoed);
        assert_eq!(outcome_of(&[echoed(0), SettingAck::NoReply]), ApplyOutcome::Sent);
        assert_eq!(outcome_of(&[echoed(0), echoed(7)]), ApplyOutcome::Sent);
        assert_eq!(outcome_of(&[]), ApplyOutcome::Sent);
    }

    /// What `send_group` asked the mouse to do.
    #[derive(Clone, Debug, PartialEq, Eq)]
    enum Call {
        Dpi(u16),
        Stages(Vec<u16>, u8),
        Rate(u16),
        Color(Color),
        Zone(u8, Color),
        ReadRate,
    }

    /// What the polling-rate read-back gives.
    enum Readback {
        /// A reply, naming a rate or (`None`) none.
        Rate(Option<u16>),
        NoReply,
        Fails,
    }

    /// A mouse that records each call and answers from a script. Like the library, each setting call replaces the
    /// answers of the one before.
    struct FakeMouse {
        info: DeviceInfo,
        calls: Vec<Call>,
        /// The answers to the next setting calls, in order; a call with none scripted gets one clean answer.
        answers: VecDeque<Vec<SettingAck>>,
        last: Vec<SettingAck>,
        readback: Readback,
        /// Every setting call fails, as when the mouse is unplugged mid-send.
        fails: bool,
    }

    impl FakeMouse {
        fn new() -> Self {
            Self {
                info: info(DeviceType::Mouse, 0x1870, "Rival 3 Gen 2", None),
                calls: Vec::new(),
                answers: VecDeque::new(),
                last: Vec::new(),
                readback: Readback::NoReply,
                fails: false,
            }
        }

        fn setting(&mut self, call: Call) -> steelseries_gg::Result<()> {
            self.calls.push(call);
            if self.fails {
                return Err(steelseries_gg::Error::DeviceCommunication(
                    "the mouse is gone".to_owned(),
                ));
            }
            self.last = self.answers.pop_front().unwrap_or_else(|| vec![echoed(0)]);
            Ok(())
        }
    }

    impl Device for FakeMouse {
        fn info(&self) -> &DeviceInfo {
            &self.info
        }

        fn device_type(&self) -> DeviceType {
            DeviceType::Mouse
        }

        fn initialize(&mut self) -> steelseries_gg::Result<()> {
            Ok(())
        }

        fn close(&mut self) -> steelseries_gg::Result<()> {
            Ok(())
        }

        fn is_connected(&self) -> bool {
            true
        }

        fn send_raw(&mut self, _data: &[u8]) -> steelseries_gg::Result<()> {
            Err(steelseries_gg::Error::DeviceCommunication(
                "the fake takes no raw data".to_owned(),
            ))
        }

        fn receive_raw(&mut self, _buf: &mut [u8]) -> steelseries_gg::Result<usize> {
            Err(steelseries_gg::Error::DeviceCommunication(
                "the fake gives no raw data".to_owned(),
            ))
        }
    }

    impl Mouse for FakeMouse {
        fn set_dpi(&mut self, dpi: u16) -> steelseries_gg::Result<()> {
            self.setting(Call::Dpi(dpi))
        }

        fn set_dpi_stages(&mut self, stages: &[u16], active: u8) -> steelseries_gg::Result<()> {
            self.setting(Call::Stages(stages.to_vec(), active))
        }

        fn set_poll_rate(&mut self, hz: u16) -> steelseries_gg::Result<()> {
            self.setting(Call::Rate(hz))
        }

        fn set_color(&mut self, color: Color) -> steelseries_gg::Result<()> {
            self.setting(Call::Color(color))
        }

        fn set_zone_color(&mut self, zone: u8, color: Color) -> steelseries_gg::Result<()> {
            self.setting(Call::Zone(zone, color))
        }

        fn battery_level(&mut self) -> steelseries_gg::Result<Option<u8>> {
            Ok(None)
        }

        fn poll_rate_readback(&mut self) -> steelseries_gg::Result<Option<PollRateReadback>> {
            self.calls.push(Call::ReadRate);
            match self.readback {
                Readback::Rate(hz) => Ok(Some(PollRateReadback { reply: Vec::new(), hz })),
                Readback::NoReply => Ok(None),
                Readback::Fails => Err(steelseries_gg::Error::DeviceCommunication("no read-back".to_owned())),
            }
        }

        fn last_acknowledgements(&self) -> &[SettingAck] {
            &self.last
        }
    }

    fn mouse_settings() -> DeviceSettings {
        DeviceSettings {
            dpi_stages: vec![400, 800, 1600, 3200],
            start_stage: 2,
            poll_rate_hz: 500,
            color: "#ff0000".to_owned(),
            zones: Zones {
                front: "#0000ff".to_owned(),
                middle: "#00ff00".to_owned(),
                rear: "#ffffff".to_owned(),
            },
            ..DeviceSettings::default()
        }
    }

    #[test]
    fn dpi_goes_out_as_stages_with_the_start_stage_or_as_one_value() -> Result<()> {
        let mut mouse = FakeMouse::new();
        assert_eq!(
            send_group(&mut mouse, SettingGroup::Dpi, &mouse_settings())?,
            ApplyOutcome::Echoed
        );
        assert_eq!(mouse.calls, [Call::Stages(vec![400, 800, 1600, 3200], 2)]);

        let single = DeviceSettings {
            dpi_stages: vec![800],
            start_stage: 0,
            ..mouse_settings()
        };
        let mut mouse = FakeMouse::new();
        send_group(&mut mouse, SettingGroup::Dpi, &single)?;
        assert_eq!(mouse.calls, [Call::Dpi(800)]);
        Ok(())
    }

    fn send_rate(readback: Readback) -> Result<(ApplyOutcome, Vec<Call>)> {
        let mut mouse = FakeMouse {
            readback,
            ..FakeMouse::new()
        };
        let outcome = send_group(&mut mouse, SettingGroup::Rate, &mouse_settings())?;
        Ok((outcome, mouse.calls))
    }

    #[test]
    fn a_polling_rate_is_verified_only_by_a_read_back_naming_it() -> Result<()> {
        let (outcome, calls) = send_rate(Readback::Rate(Some(500)))?;
        assert_eq!(calls, [Call::Rate(500), Call::ReadRate]);
        assert_eq!(outcome, ApplyOutcome::Verified);
        // No read-back, one naming no rate, or a failed one leave the outcome to the answer.
        assert_eq!(send_rate(Readback::NoReply)?.0, ApplyOutcome::Echoed);
        assert_eq!(send_rate(Readback::Rate(None))?.0, ApplyOutcome::Echoed);
        assert_eq!(send_rate(Readback::Fails)?.0, ApplyOutcome::Echoed);
        Ok(())
    }

    #[test]
    fn lighting_sets_every_zone_or_each_zone_and_needs_every_answer() -> Result<()> {
        let mut mouse = FakeMouse::new();
        assert_eq!(
            send_group(&mut mouse, SettingGroup::Light, &mouse_settings())?,
            ApplyOutcome::Echoed
        );
        assert_eq!(mouse.calls, [Call::Color(Color::new(255, 0, 0))]);

        let zones = DeviceSettings {
            light_mode: LightMode::Zones,
            ..mouse_settings()
        };
        let mut mouse = FakeMouse::new();
        assert_eq!(
            send_group(&mut mouse, SettingGroup::Light, &zones)?,
            ApplyOutcome::Echoed
        );
        assert_eq!(
            mouse.calls,
            [
                Call::Zone(0, Color::new(0, 0, 255)),
                Call::Zone(1, Color::new(0, 255, 0)),
                Call::Zone(2, Color::new(255, 255, 255)),
            ]
        );

        // The front zone's answer went missing; the clean answers of the later zones must not hide that.
        let mut mouse = FakeMouse {
            answers: VecDeque::from([vec![SettingAck::NoReply]]),
            ..FakeMouse::new()
        };
        assert_eq!(send_group(&mut mouse, SettingGroup::Light, &zones)?, ApplyOutcome::Sent);

        let off = DeviceSettings {
            light_mode: LightMode::Off,
            ..mouse_settings()
        };
        let mut mouse = FakeMouse::new();
        send_group(&mut mouse, SettingGroup::Light, &off)?;
        assert_eq!(mouse.calls, [Call::Color(Color::BLACK)]);
        Ok(())
    }

    #[test]
    fn a_failing_mouse_ends_the_send_with_an_error() {
        let zones = DeviceSettings {
            light_mode: LightMode::Zones,
            ..mouse_settings()
        };
        let mut mouse = FakeMouse {
            fails: true,
            ..FakeMouse::new()
        };
        assert!(matches!(
            send_group(&mut mouse, SettingGroup::Light, &zones),
            Err(Error::Send(_))
        ));
        assert_eq!(mouse.calls.len(), 1, "nothing more goes out after a failure");
    }

    #[test]
    fn each_light_mode_sets_the_right_zones() -> Result<()> {
        let mut settings = DeviceSettings {
            color: "#ff0000".to_owned(),
            zones: Zones {
                front: "#0000ff".to_owned(),
                middle: "#00ff00".to_owned(),
                rear: "#ffffff".to_owned(),
            },
            ..DeviceSettings::default()
        };
        assert_eq!(lights(&settings)?, [Light::All(Color::new(255, 0, 0))]);

        settings.light_mode = LightMode::Off;
        assert_eq!(lights(&settings)?, [Light::All(Color::new(0, 0, 0))]);

        settings.light_mode = LightMode::Zones;
        assert_eq!(
            lights(&settings)?,
            [
                Light::Zone(0, Color::new(0, 0, 255)),
                Light::Zone(1, Color::new(0, 255, 0)),
                Light::Zone(2, Color::new(255, 255, 255)),
            ]
        );

        settings.zones.rear = "rear".to_owned();
        assert!(lights(&settings).is_err());
        Ok(())
    }

    #[test]
    fn dpi_values_that_do_not_fit_are_refused_before_anything_is_sent() -> Result<()> {
        let settings = DeviceSettings {
            dpi_stages: vec![400, 3200],
            start_stage: 1,
            ..DeviceSettings::default()
        };
        assert_eq!(dpi_stages(&settings)?, [400, 3200]);
        assert_eq!(start_stage(&settings)?, 1);

        let huge = DeviceSettings {
            dpi_stages: vec![70_000],
            ..DeviceSettings::default()
        };
        assert!(dpi_stages(&huge).is_err());
        Ok(())
    }

    fn present(instances: &[&str]) -> HashSet<String> {
        instances.iter().map(|i| (*i).to_owned()).collect()
    }

    #[test]
    fn two_drops_soon_after_a_send_pause_re_applying() {
        let start = Instant::now();
        let at = |secs: u64| start + Duration::from_secs(secs);
        let mut guard = Guard::default();

        guard.sent("a", at(0));
        guard.observe(&present(&["a"]), at(2));
        assert!(!guard.paused);

        // The mouse comes back as a new instance two seconds after the send: one drop.
        guard.observe(&present(&["b"]), at(4));
        assert!(!guard.paused);

        guard.sent("b", at(5));
        guard.observe(&present(&[]), at(7));
        assert!(guard.paused);

        guard.resume();
        assert!(!guard.paused);
        guard.sent("c", at(8));
        guard.observe(&present(&[]), at(9));
        assert!(!guard.paused, "the drops before resuming no longer count");
    }

    #[test]
    fn the_safety_pause_holds_across_a_restart_until_resumed() -> std::result::Result<(), Box<dyn std::error::Error>> {
        let dir = tempfile::tempdir()?;
        let path = dir.path().join("config").join("reapply-paused");
        let start = Instant::now();
        let at = |secs: u64| start + Duration::from_secs(secs);

        let backend = SsggBackend::with_pause_file(&path);
        backend.guard().sent("a", at(0));
        assert!(!backend.observe_guard(&present(&[]), at(1)));
        assert!(!path.exists());
        backend.guard().sent("b", at(2));
        assert!(backend.observe_guard(&present(&[]), at(3)));
        assert!(path.exists());

        let restarted = SsggBackend::with_pause_file(&path);
        assert!(restarted.guard().paused);
        let outcome = restarted.apply("test:none", SettingGroup::Light, &DeviceSettings::default())?;
        assert_eq!(outcome, ApplyOutcome::NotSent);

        assert_eq!(restarted.resume_reapply(), ActionOutcome::Done);
        assert!(!restarted.guard().paused);
        assert!(!path.exists());
        assert!(!SsggBackend::with_pause_file(&path).guard().paused);
        Ok(())
    }

    #[test]
    fn unplugging_long_after_a_send_or_far_apart_is_not_a_drop() {
        let start = Instant::now();
        let at = |secs: u64| start + Duration::from_secs(secs);
        let mut guard = Guard::default();

        // Unplugged a minute after the last send.
        guard.sent("a", at(0));
        guard.observe(&present(&[]), at(60));
        // Plugged in, sent to, unplugged right away: one drop.
        guard.sent("b", at(100));
        guard.observe(&present(&[]), at(102));
        // The second quick drop comes after the first one stopped counting.
        guard.sent("c", at(200));
        guard.observe(&present(&[]), at(201));
        assert!(!guard.paused);

        // A device that was never sent to does not count either.
        guard.observe(&present(&["d"]), at(202));
        guard.observe(&present(&[]), at(203));
        assert!(!guard.paused);
    }
}
