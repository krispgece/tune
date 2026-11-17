//! The one place that calls the ssgg library (`steelseries_gg`).
//!
//! For now it only lists devices: enumeration reads what the system already knows about each USB device and opens
//! none of them. Every action that would send something stays a stub until the owner's hardware test confirms it.

use steelseries_gg::devices::hid_reports::MouseDpiStagesCommand;
use steelseries_gg::devices::mice::modern::{MouseModel, model_for};
use steelseries_gg::devices::{DeviceInfo, DeviceManager, DeviceType, product_ids};

use crate::access::{installed_rule, node_access};
use crate::backend::{Backend, BackendKind};
use crate::model::{
    ActionOutcome, ApplyOutcome, Connection, DeviceAccess, DeviceKind, DevicePage, DeviceSummary, MouseCaps,
    ScanReport, SettingGroup, sort_devices, usb_id,
};
use crate::{Error, Result};

/// Polling rates a Rival 3 Gen 2 offers, in Hz.
const POLL_RATES: [u32; 4] = [125, 250, 500, 1000];

/// Real devices through ssgg. Read-only for now.
#[derive(Debug, Default)]
pub struct SsggBackend;

impl SsggBackend {
    pub fn new() -> Self {
        Self
    }
}

impl Backend for SsggBackend {
    fn kind(&self) -> BackendKind {
        BackendKind::Device
    }

    fn sends_settings(&self) -> bool {
        false
    }

    fn scan(&self) -> Result<ScanReport> {
        let manager = DeviceManager::new().map_err(|e| Error::Scan(e.to_string()))?;
        let mut devices: Vec<DeviceSummary> = [DeviceType::Mouse, DeviceType::Keyboard, DeviceType::Headset]
            .into_iter()
            .flat_map(|device_type| manager.devices_by_type(device_type))
            .filter_map(|info| summarize(info, node_access))
            .collect();
        sort_devices(&mut devices);
        Ok(ScanReport {
            devices,
            access_rule: installed_rule().map(|path| path.to_string_lossy().into_owned()),
            reapply_paused: false,
            mock_scenario: None,
        })
    }

    fn apply(&self, _device_id: &str, _group: SettingGroup) -> ApplyOutcome {
        ApplyOutcome::NotSent
    }

    fn request_access(&self) -> ActionOutcome {
        ActionOutcome::NotAvailable
    }

    fn remove_access(&self) -> ActionOutcome {
        ActionOutcome::NotAvailable
    }

    fn resume_reapply(&self) -> ActionOutcome {
        ActionOutcome::NotAvailable
    }
}

/// Maps one device that ssgg recognized to what the app shows. `check_access` is only asked about devices Tune has a
/// page for, with the path of their settings interface. Devices of an unknown type are left out.
pub fn summarize(info: &DeviceInfo, check_access: impl Fn(&str) -> DeviceAccess) -> Option<DeviceSummary> {
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
    let usb = usb_id(info.vendor_id, info.product_id);
    let id = match info.serial_number.as_deref().map(str::trim) {
        Some(serial) if !serial.is_empty() => format!("{usb}/{serial}"),
        _ => usb.clone(),
    };
    Some(DeviceSummary {
        id,
        usb_id: usb,
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

    use super::*;

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

    #[test]
    fn the_rival_3_gen_2_gets_its_page_caps_and_an_access_check() -> std::result::Result<(), String> {
        let asked = RefCell::new(Vec::new());
        let check = |path: &str| {
            asked.borrow_mut().push(path.to_owned());
            DeviceAccess::Denied
        };
        let summary = summarize(&info(DeviceType::Mouse, 0x1870, "Rival 3 Gen 2", None), check)
            .ok_or("the mouse was left out")?;

        assert_eq!(summary.id, "1038:1870");
        assert_eq!(summary.usb_id, "1038:1870");
        assert_eq!(summary.name, "Rival 3 Gen 2");
        assert_eq!(summary.kind, DeviceKind::Mouse);
        assert_eq!(summary.connection, Connection::Wired);
        assert_eq!(summary.page, Some(DevicePage::Rival3Gen2));
        assert_eq!(summary.access, DeviceAccess::Denied);
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
        let keyboard = summarize(&info(DeviceType::Keyboard, 0x1628, "Apex Pro TKL (2023)", None), check)
            .ok_or("the keyboard was left out")?;
        assert_eq!(keyboard.kind, DeviceKind::Keyboard);
        assert_eq!(keyboard.page, None);
        assert_eq!(keyboard.access, DeviceAccess::NotChecked);
        assert_eq!(keyboard.connection, Connection::Unknown);
        assert_eq!(keyboard.caps, None);

        let headset = summarize(&info(DeviceType::Headset, 0x227E, "Arctis Nova 7 Gen 2", None), check)
            .ok_or("the headset was left out")?;
        assert_eq!(headset.kind, DeviceKind::Headset);
        assert_eq!(headset.access, DeviceAccess::NotChecked);
        Ok(())
    }

    #[test]
    fn other_mice_show_their_connection_but_get_no_page() -> std::result::Result<(), String> {
        let check = |_: &str| -> DeviceAccess { panic!("an unsupported mouse was checked") };
        // Aerox 3 Wireless through its 2.4 GHz receiver.
        let mouse = summarize(&info(DeviceType::Mouse, 0x1838, "Aerox 3 Wireless", None), check)
            .ok_or("the mouse was left out")?;
        assert_eq!(mouse.connection, Connection::Receiver);
        assert_eq!(mouse.page, None);
        assert_eq!(mouse.caps, None);
        Ok(())
    }

    #[test]
    fn unknown_devices_are_left_out() {
        let summary = summarize(&info(DeviceType::Unknown, 0x0001, "Unknown", None), |_| {
            DeviceAccess::Allowed
        });
        assert_eq!(summary, None);
    }

    #[test]
    fn a_serial_number_keeps_two_identical_devices_apart() -> std::result::Result<(), String> {
        let with_serial = summarize(
            &info(DeviceType::Mouse, 0x1870, "Rival 3 Gen 2", Some(" ABC123 ")),
            |_| DeviceAccess::Allowed,
        )
        .ok_or("left out")?;
        assert_eq!(with_serial.id, "1038:1870/ABC123");
        assert_eq!(with_serial.usb_id, "1038:1870");

        let blank_serial = summarize(&info(DeviceType::Mouse, 0x1870, "Rival 3 Gen 2", Some("  ")), |_| {
            DeviceAccess::Allowed
        })
        .ok_or("left out")?;
        assert_eq!(blank_serial.id, "1038:1870");
        Ok(())
    }

    #[test]
    fn every_action_is_a_stub() {
        let backend = SsggBackend::new();
        assert_eq!(backend.kind(), BackendKind::Device);
        assert!(!backend.sends_settings());
        assert_eq!(backend.apply("1038:1870", SettingGroup::Dpi), ApplyOutcome::NotSent);
        assert_eq!(backend.request_access(), ActionOutcome::NotAvailable);
        assert_eq!(backend.remove_access(), ActionOutcome::NotAvailable);
        assert_eq!(backend.resume_reapply(), ActionOutcome::NotAvailable);
        assert!(backend.set_mock_scenario(crate::model::Scenario::Normal).is_err());
    }
}
