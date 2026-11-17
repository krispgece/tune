//! Fake devices, so the whole interface can be run and checked with no hardware. Nothing is sent anywhere.

use std::sync::{Mutex, MutexGuard, PoisonError};
use std::thread::sleep;
use std::time::Duration;

use crate::Result;
use crate::access::{RULE_DIRS, RULE_FILE_NAME};
use crate::backend::{Backend, BackendKind};
use crate::model::{
    ActionOutcome, ApplyOutcome, Connection, DeviceAccess, DeviceKind, DevicePage, DeviceSummary, MouseCaps,
    ScanReport, Scenario, SettingGroup, sort_devices,
};

/// How long the fake password window takes.
const ACCESS_DELAY: Duration = Duration::from_millis(1600);
/// How long the fake mouse takes to answer a setting.
const APPLY_DELAY: Duration = Duration::from_millis(300);

#[derive(Debug)]
struct MockState {
    scenario: Scenario,
    access: bool,
    paused: bool,
}

impl MockState {
    fn for_scenario(scenario: Scenario) -> Self {
        Self {
            scenario,
            access: !matches!(scenario, Scenario::Setup | Scenario::NoPermission),
            paused: scenario == Scenario::Guard,
        }
    }
}

#[derive(Debug)]
pub struct MockBackend {
    state: Mutex<MockState>,
    delays: bool,
}

impl Default for MockBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl MockBackend {
    /// Starts at the first launch, like a fresh install.
    pub fn new() -> Self {
        Self {
            state: Mutex::new(MockState::for_scenario(Scenario::Setup)),
            delays: true,
        }
    }

    /// No simulated waiting, for tests.
    pub fn without_delays() -> Self {
        Self {
            delays: false,
            ..Self::new()
        }
    }

    fn state(&self) -> MutexGuard<'_, MockState> {
        self.state.lock().unwrap_or_else(PoisonError::into_inner)
    }

    fn wait(&self, delay: Duration) {
        if self.delays {
            sleep(delay);
        }
    }
}

impl Backend for MockBackend {
    fn kind(&self) -> BackendKind {
        BackendKind::Mock
    }

    fn sends_settings(&self) -> bool {
        true
    }

    fn scan(&self) -> Result<ScanReport> {
        let state = self.state();
        let mut devices = Vec::new();
        if state.scenario != Scenario::Unplugged {
            devices.push(rival(if state.access {
                DeviceAccess::Allowed
            } else {
                DeviceAccess::Denied
            }));
        }
        if state.scenario == Scenario::Multi {
            devices.push(unsupported(
                "1038:1628",
                "Apex Pro TKL (2023)",
                DeviceKind::Keyboard,
                Connection::Wired,
            ));
            devices.push(unsupported(
                "1038:227e",
                "Arctis Nova 7 Gen 2",
                DeviceKind::Headset,
                Connection::Receiver,
            ));
        }
        sort_devices(&mut devices);
        Ok(ScanReport {
            devices,
            access_rule: state.access.then(|| format!("{}/{RULE_FILE_NAME}", RULE_DIRS[0])),
            reapply_paused: state.paused,
            mock_scenario: Some(state.scenario),
        })
    }

    fn apply(&self, _device_id: &str, _group: SettingGroup) -> ApplyOutcome {
        self.wait(APPLY_DELAY);
        if self.state().paused {
            ApplyOutcome::NotSent
        } else {
            ApplyOutcome::Received
        }
    }

    fn request_access(&self) -> ActionOutcome {
        self.wait(ACCESS_DELAY);
        let mut state = self.state();
        state.access = true;
        if matches!(state.scenario, Scenario::Setup | Scenario::NoPermission) {
            state.scenario = Scenario::Own;
        }
        ActionOutcome::Done
    }

    fn remove_access(&self) -> ActionOutcome {
        *self.state() = MockState::for_scenario(Scenario::NoPermission);
        ActionOutcome::Done
    }

    fn resume_reapply(&self) -> ActionOutcome {
        let mut state = self.state();
        state.paused = false;
        if state.scenario == Scenario::Guard {
            state.scenario = Scenario::Normal;
        }
        ActionOutcome::Done
    }

    fn set_mock_scenario(&self, scenario: Scenario) -> Result<()> {
        *self.state() = MockState::for_scenario(scenario);
        Ok(())
    }
}

/// The caps ssgg gives the wired Rival 3 Gen 2.
pub fn rival_caps() -> MouseCaps {
    MouseCaps {
        dpi_min: 200,
        dpi_max: 8500,
        dpi_step: 100,
        max_stages: 5,
        poll_rates: vec![125, 250, 500, 1000],
        zones: 3,
    }
}

fn rival(access: DeviceAccess) -> DeviceSummary {
    DeviceSummary {
        id: "1038:1870".to_owned(),
        usb_id: "1038:1870".to_owned(),
        name: "Rival 3 Gen 2".to_owned(),
        kind: DeviceKind::Mouse,
        connection: Connection::Wired,
        page: Some(DevicePage::Rival3Gen2),
        access,
        caps: Some(rival_caps()),
    }
}

fn unsupported(usb_id: &str, name: &str, kind: DeviceKind, connection: Connection) -> DeviceSummary {
    DeviceSummary {
        id: usb_id.to_owned(),
        usb_id: usb_id.to_owned(),
        name: name.to_owned(),
        kind,
        connection,
        page: None,
        access: DeviceAccess::NotChecked,
        caps: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(report: &ScanReport) -> Vec<&str> {
        report.devices.iter().map(|d| d.name.as_str()).collect()
    }

    #[test]
    fn starts_at_the_first_launch_without_permission() -> Result<()> {
        let mock = MockBackend::without_delays();
        assert!(mock.sends_settings());
        let report = mock.scan()?;
        assert_eq!(report.mock_scenario, Some(Scenario::Setup));
        assert_eq!(names(&report), ["Rival 3 Gen 2"]);
        assert_eq!(report.devices[0].access, DeviceAccess::Denied);
        assert_eq!(report.access_rule, None);
        Ok(())
    }

    #[test]
    fn allowing_access_grants_it_and_leaves_the_mouse_its_own_settings() -> Result<()> {
        let mock = MockBackend::without_delays();
        assert_eq!(mock.request_access(), ActionOutcome::Done);
        let report = mock.scan()?;
        assert_eq!(report.mock_scenario, Some(Scenario::Own));
        assert_eq!(report.devices[0].access, DeviceAccess::Allowed);
        assert!(report.access_rule.is_some_and(|path| path.ends_with(RULE_FILE_NAME)));
        Ok(())
    }

    #[test]
    fn every_scenario_shows_what_the_mockup_shows() -> Result<()> {
        let mock = MockBackend::without_delays();

        mock.set_mock_scenario(Scenario::Multi)?;
        let multi = mock.scan()?;
        assert_eq!(
            names(&multi),
            ["Rival 3 Gen 2", "Apex Pro TKL (2023)", "Arctis Nova 7 Gen 2"]
        );
        assert!(multi.devices[1..].iter().all(|d| d.page.is_none()));

        mock.set_mock_scenario(Scenario::Unplugged)?;
        assert!(mock.scan()?.devices.is_empty());

        mock.set_mock_scenario(Scenario::NoPermission)?;
        let noperm = mock.scan()?;
        assert_eq!(noperm.devices[0].access, DeviceAccess::Denied);
        assert_eq!(noperm.access_rule, None);

        mock.set_mock_scenario(Scenario::Guard)?;
        let guard = mock.scan()?;
        assert!(guard.reapply_paused);
        assert_eq!(mock.apply("1038:1870", SettingGroup::Rate), ApplyOutcome::NotSent);
        assert_eq!(mock.resume_reapply(), ActionOutcome::Done);
        assert!(!mock.scan()?.reapply_paused);
        assert_eq!(mock.apply("1038:1870", SettingGroup::Rate), ApplyOutcome::Received);
        Ok(())
    }

    #[test]
    fn removing_access_leads_to_the_permission_screen() -> Result<()> {
        let mock = MockBackend::without_delays();
        mock.set_mock_scenario(Scenario::Normal)?;
        assert_eq!(mock.remove_access(), ActionOutcome::Done);
        let report = mock.scan()?;
        assert_eq!(report.mock_scenario, Some(Scenario::NoPermission));
        assert_eq!(report.devices[0].access, DeviceAccess::Denied);
        Ok(())
    }
}
