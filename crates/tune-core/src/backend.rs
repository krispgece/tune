use serde::Serialize;

use crate::model::{ActionOutcome, ApplyOutcome, ScanReport, Scenario, SettingGroup};
use crate::{Error, Result};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum BackendKind {
    /// Real devices through the ssgg library.
    Device,
    /// Fake devices; nothing is sent anywhere.
    Mock,
}

/// What the app shell asks of a device backend.
///
/// Every action that would change a device or the system (`apply`, `request_access`, `remove_access`,
/// `resume_reapply`) is a stub on the real backend until the owner's hardware test confirms it.
pub trait Backend: Send + Sync {
    fn kind(&self) -> BackendKind;

    /// Whether `apply` reaches the device. While it doesn't, the app keeps choices on this computer and says so.
    fn sends_settings(&self) -> bool;

    /// Lists the devices from what the system already knows about them. Nothing is sent to any device.
    fn scan(&self) -> Result<ScanReport>;

    /// Sends one setting group of a device's saved settings.
    fn apply(&self, device_id: &str, group: SettingGroup) -> ApplyOutcome;

    /// Installs the access rule through the system's password window.
    fn request_access(&self) -> ActionOutcome;

    /// Removes the access rule.
    fn remove_access(&self) -> ActionOutcome;

    /// Starts re-applying settings again after the safety pause.
    fn resume_reapply(&self) -> ActionOutcome;

    fn set_mock_scenario(&self, _scenario: Scenario) -> Result<()> {
        Err(Error::NotMock)
    }
}
