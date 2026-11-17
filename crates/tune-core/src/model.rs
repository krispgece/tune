//! Plain data that the backends hand to the app shell and, through it, to the window.

use serde::{Deserialize, Serialize};

/// The kinds of device Tune lists. Devices that ssgg does not recognize are left out.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DeviceKind {
    Mouse,
    Keyboard,
    Headset,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Connection {
    Wired,
    /// Through a wireless USB receiver.
    Receiver,
    Unknown,
}

/// Whether the signed-in user may use a device's settings interface.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DeviceAccess {
    Allowed,
    Denied,
    /// Not checked: Tune has no page for the device and never talks to it.
    NotChecked,
}

/// The device pages Tune has. A device without one is listed as not supported yet, and Tune sends it nothing.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DevicePage {
    Rival3Gen2,
}

/// What the mouse page may offer for one model.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MouseCaps {
    pub dpi_min: u32,
    pub dpi_max: u32,
    pub dpi_step: u32,
    pub max_stages: usize,
    pub poll_rates: Vec<u32>,
    pub zones: u8,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceSummary {
    /// Unique within one scan and stable across scans of the same device.
    pub id: String,
    /// `vendor:product` in hexadecimal, for example `1038:1870`. Also the key of the device's settings.
    pub usb_id: String,
    pub name: String,
    pub kind: DeviceKind,
    pub connection: Connection,
    pub page: Option<DevicePage>,
    pub access: DeviceAccess,
    pub caps: Option<MouseCaps>,
    /// Changes each time the device is plugged in again and stays the same while it stays plugged in. The app sends
    /// the settings the mouse forgets again when it changes.
    pub instance: String,
}

/// The mock backend's states. They match the states of the approved mockup.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Scenario {
    /// First launch: the mouse is plugged in and the permission is missing.
    #[default]
    Setup,
    /// Everything works and Tune manages every setting group.
    Normal,
    /// Everything works and the mouse keeps its own settings.
    Own,
    /// A keyboard and a headset that Tune has no page for are plugged in as well.
    Multi,
    Unplugged,
    #[serde(rename = "noperm")]
    NoPermission,
    /// The access rule is installed, but it has not reached the mouse yet: that takes plugging the mouse in again
    /// or asking udev to apply its rules to the devices already plugged in.
    Replug,
    /// Re-applying stopped after the mouse disconnected twice in a short time.
    Guard,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanReport {
    pub devices: Vec<DeviceSummary>,
    /// Where the access rule is installed, if it is.
    pub access_rule: Option<String>,
    /// Re-applying settings is paused for safety.
    pub reapply_paused: bool,
    /// The mock backend's current state; `None` with real devices.
    pub mock_scenario: Option<Scenario>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SettingGroup {
    Dpi,
    Rate,
    Light,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ApplyOutcome {
    /// Sent, but the device did not answer every part of it.
    Sent,
    /// The device answered that it took the setting.
    Echoed,
    /// The device reported the value back, and it is the one just sent.
    Verified,
    /// Nothing was sent: re-applying is paused for safety.
    NotSent,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ActionOutcome {
    Done,
    /// The action is not connected yet in this version.
    NotAvailable,
}

pub fn usb_id(vendor_id: u16, product_id: u16) -> String {
    format!("{vendor_id:04x}:{product_id:04x}")
}

/// Devices with a page first, then mice, keyboards and headsets, each by name.
pub fn sort_devices(devices: &mut [DeviceSummary]) {
    devices.sort_by(|a, b| {
        b.page
            .is_some()
            .cmp(&a.page.is_some())
            .then(a.kind.cmp(&b.kind))
            .then_with(|| a.name.cmp(&b.name))
            .then_with(|| a.id.cmp(&b.id))
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn device(id: &str, name: &str, kind: DeviceKind, page: Option<DevicePage>) -> DeviceSummary {
        DeviceSummary {
            id: id.to_owned(),
            usb_id: id.to_owned(),
            name: name.to_owned(),
            kind,
            connection: Connection::Unknown,
            page,
            access: DeviceAccess::NotChecked,
            caps: None,
            instance: id.to_owned(),
        }
    }

    #[test]
    fn usb_id_is_lower_case_and_padded() {
        assert_eq!(usb_id(0x1038, 0x1870), "1038:1870");
        assert_eq!(usb_id(0x1038, 0x0616), "1038:0616");
        assert_eq!(usb_id(0x1038, 0x12AB), "1038:12ab");
    }

    #[test]
    fn supported_devices_come_first_then_kind_then_name() {
        let mut list = vec![
            device("c", "Arctis", DeviceKind::Headset, None),
            device("b", "Apex", DeviceKind::Keyboard, None),
            device("d", "Aerox", DeviceKind::Mouse, None),
            device("a", "Rival", DeviceKind::Mouse, Some(DevicePage::Rival3Gen2)),
        ];
        sort_devices(&mut list);
        let order: Vec<&str> = list.iter().map(|d| d.id.as_str()).collect();
        assert_eq!(order, ["a", "d", "b", "c"]);
    }

    #[test]
    fn wire_names_match_the_frontend() -> std::result::Result<(), serde_json::Error> {
        assert_eq!(serde_json::to_string(&Scenario::NoPermission)?, "\"noperm\"");
        assert_eq!(serde_json::to_string(&Scenario::Replug)?, "\"replug\"");
        assert_eq!(serde_json::to_string(&DevicePage::Rival3Gen2)?, "\"rival3Gen2\"");
        assert_eq!(serde_json::to_string(&ApplyOutcome::NotSent)?, "\"notSent\"");
        assert_eq!(serde_json::to_string(&ApplyOutcome::Verified)?, "\"verified\"");
        let report = ScanReport::default();
        let json = serde_json::to_value(&report)?;
        assert!(json.get("accessRule").is_some());
        assert!(json.get("reapplyPaused").is_some());
        Ok(())
    }
}
