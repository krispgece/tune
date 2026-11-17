//! The app's settings, kept on this computer as one JSON file.
//!
//! Loading never fails on bad content: a file that does not parse is moved aside and the defaults are used, and
//! values out of range are brought back into range, so a hand-edited file cannot break the window.

use std::collections::BTreeMap;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};

use serde::{Deserialize, Serialize};

use crate::{Error, Result};

pub const SETTINGS_VERSION: u32 = 1;
/// The most DPI stages a device keeps.
pub const MAX_STAGES: usize = 5;
/// Bounds that any mouse could use. The device page keeps each value within its model's own range.
pub const DPI_BOUNDS: (u32, u32) = (50, 30_000);
pub const POLL_RATES: [u32; 4] = [125, 250, 500, 1000];

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Language {
    #[default]
    En,
    Tr,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Theme {
    #[default]
    System,
    Light,
    Dark,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LightMode {
    #[default]
    Single,
    Zones,
    Off,
}

/// Which setting groups Tune manages. A group Tune does not manage keeps the mouse's own value.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Managed {
    pub dpi: bool,
    pub rate: bool,
    pub light: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Zones {
    pub front: String,
    pub middle: String,
    pub rear: String,
}

impl Default for Zones {
    fn default() -> Self {
        Self {
            front: "#1fc8ff".to_owned(),
            middle: "#9a5bff".to_owned(),
            rear: "#ff4fa8".to_owned(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct DeviceSettings {
    pub managed: Managed,
    pub dpi_stages: Vec<u32>,
    /// Index into `dpi_stages` of the stage the mouse starts at.
    pub start_stage: usize,
    pub poll_rate_hz: u32,
    pub light_mode: LightMode,
    pub color: String,
    pub zones: Zones,
    /// The DPI stages changed and the mouse has not taken them yet. The mouse keeps its DPI stages itself, so they are
    /// sent on plug-in only while this is set; colour and polling rate are sent every time.
    pub dpi_pending: bool,
}

impl Default for DeviceSettings {
    fn default() -> Self {
        Self {
            managed: Managed::default(),
            dpi_stages: vec![400, 800, 1600, 3200],
            start_stage: 1,
            poll_rate_hz: 1000,
            light_mode: LightMode::Single,
            color: "#1fc8ff".to_owned(),
            zones: Zones::default(),
            dpi_pending: false,
        }
    }
}

impl DeviceSettings {
    pub fn sanitized(mut self) -> Self {
        let defaults = Self::default();
        self.dpi_stages.truncate(MAX_STAGES);
        for dpi in &mut self.dpi_stages {
            *dpi = (*dpi).clamp(DPI_BOUNDS.0, DPI_BOUNDS.1);
        }
        if self.dpi_stages.is_empty() {
            self.dpi_stages = defaults.dpi_stages;
            self.start_stage = defaults.start_stage;
        }
        if self.start_stage >= self.dpi_stages.len() {
            self.start_stage = 0;
        }
        if !POLL_RATES.contains(&self.poll_rate_hz) {
            self.poll_rate_hz = defaults.poll_rate_hz;
        }
        self.color = normalize_hex(&self.color).unwrap_or(defaults.color);
        self.zones = Zones {
            front: normalize_hex(&self.zones.front).unwrap_or(defaults.zones.front),
            middle: normalize_hex(&self.zones.middle).unwrap_or(defaults.zones.middle),
            rear: normalize_hex(&self.zones.rear).unwrap_or(defaults.zones.rear),
        };
        self
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    pub version: u32,
    pub language: Language,
    pub theme: Theme,
    pub first_run_done: bool,
    /// Keyed by the device's USB id, for example `1038:1870`.
    pub devices: BTreeMap<String, DeviceSettings>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            version: SETTINGS_VERSION,
            language: Language::default(),
            theme: Theme::default(),
            first_run_done: false,
            devices: BTreeMap::new(),
        }
    }
}

impl Settings {
    pub fn sanitized(mut self) -> Self {
        self.version = SETTINGS_VERSION;
        self.devices = self
            .devices
            .into_iter()
            .map(|(key, device)| (key.trim().to_ascii_lowercase(), device.sanitized()))
            .collect();
        self
    }
}

/// `#rgb` or `#rrggbb` in any case, as lower-case `#rrggbb`.
pub fn normalize_hex(value: &str) -> Option<String> {
    let digits = value.trim().strip_prefix('#')?;
    if !digits.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    let digits = digits.to_ascii_lowercase();
    match digits.len() {
        6 => Some(format!("#{digits}")),
        3 => Some(digits.chars().fold(String::from("#"), |mut out, c| {
            out.push(c);
            out.push(c);
            out
        })),
        _ => None,
    }
}

/// Where the settings live: a file for real use, memory for the mock backend.
#[derive(Debug)]
pub enum SettingsStore {
    File(PathBuf),
    Memory(Mutex<Settings>),
}

impl SettingsStore {
    pub fn file(path: impl Into<PathBuf>) -> Self {
        Self::File(path.into())
    }

    pub fn memory() -> Self {
        Self::Memory(Mutex::new(Settings::default()))
    }

    pub fn load(&self) -> Result<Settings> {
        match self {
            Self::File(path) => load_file(path),
            Self::Memory(settings) => Ok(settings.lock().unwrap_or_else(PoisonError::into_inner).clone()),
        }
    }

    /// Saves the settings and returns them as saved, after [`Settings::sanitized`].
    pub fn save(&self, settings: Settings) -> Result<Settings> {
        let settings = settings.sanitized();
        match self {
            Self::File(path) => save_file(path, &settings)?,
            Self::Memory(stored) => *stored.lock().unwrap_or_else(PoisonError::into_inner) = settings.clone(),
        }
        Ok(settings)
    }
}

fn load_file(path: &Path) -> Result<Settings> {
    let text = match std::fs::read_to_string(path) {
        Ok(text) => text,
        Err(e) if e.kind() == ErrorKind::NotFound => return Ok(Settings::default()),
        Err(source) => {
            return Err(Error::ReadSettings {
                path: path.to_owned(),
                source,
            });
        }
    };
    match serde_json::from_str::<Settings>(&text) {
        Ok(settings) => Ok(settings.sanitized()),
        Err(_) => {
            // Keep the unreadable file for the owner to look at; the next save writes a fresh one.
            let aside = path.with_extension("json.invalid");
            std::fs::rename(path, &aside).map_err(|source| Error::WriteSettings {
                path: aside.clone(),
                source,
            })?;
            Ok(Settings::default())
        }
    }
}

fn save_file(path: &Path, settings: &Settings) -> Result<()> {
    let write_error = |source| Error::WriteSettings {
        path: path.to_owned(),
        source,
    };
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(write_error)?;
    }
    let mut json = serde_json::to_string_pretty(settings)?;
    json.push('\n');
    // Write a sibling file and rename it over the old one, so a crash never leaves half a file.
    let partial = path.with_extension("json.partial");
    std::fs::write(&partial, json).map_err(write_error)?;
    std::fs::rename(&partial, path).map_err(write_error)
}

#[cfg(test)]
mod tests {
    use super::*;

    type TestResult = std::result::Result<(), Box<dyn std::error::Error>>;

    #[test]
    fn a_missing_file_gives_the_defaults() -> TestResult {
        let dir = tempfile::tempdir()?;
        let store = SettingsStore::file(dir.path().join("settings.json"));
        let settings = store.load()?;
        assert_eq!(settings, Settings::default());
        assert_eq!(settings.language, Language::En);
        assert_eq!(settings.theme, Theme::System);
        assert!(!settings.first_run_done);
        Ok(())
    }

    #[test]
    fn settings_survive_a_save_and_load() -> TestResult {
        let dir = tempfile::tempdir()?;
        let path = dir.path().join("nested").join("settings.json");
        let store = SettingsStore::file(&path);

        let mut settings = Settings {
            language: Language::Tr,
            theme: Theme::Dark,
            first_run_done: true,
            ..Settings::default()
        };
        let mouse = DeviceSettings {
            managed: Managed {
                dpi: true,
                rate: false,
                light: true,
            },
            dpi_stages: vec![800, 1600],
            start_stage: 1,
            poll_rate_hz: 500,
            light_mode: LightMode::Zones,
            color: "#FFFFFF".to_owned(),
            zones: Zones {
                front: "#f00".to_owned(),
                ..Zones::default()
            },
            dpi_pending: true,
        };
        settings.devices.insert("1038:1870".to_owned(), mouse);

        let saved = store.save(settings)?;
        assert_eq!(saved.devices["1038:1870"].color, "#ffffff");
        assert_eq!(saved.devices["1038:1870"].zones.front, "#ff0000");
        assert_eq!(store.load()?, saved);
        assert!(!path.with_extension("json.partial").exists());
        Ok(())
    }

    #[test]
    fn the_file_uses_the_frontend_names() -> TestResult {
        let dir = tempfile::tempdir()?;
        let path = dir.path().join("settings.json");
        let mut settings = Settings::default();
        settings
            .devices
            .insert("1038:1870".to_owned(), DeviceSettings::default());
        SettingsStore::file(&path).save(settings)?;
        let json: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&path)?)?;
        assert_eq!(json["firstRunDone"], false);
        assert_eq!(json["theme"], "system");
        assert_eq!(json["devices"]["1038:1870"]["pollRateHz"], 1000);
        assert_eq!(json["devices"]["1038:1870"]["lightMode"], "single");
        assert_eq!(json["devices"]["1038:1870"]["dpiPending"], false);
        Ok(())
    }

    #[test]
    fn missing_fields_take_their_defaults() -> TestResult {
        let dir = tempfile::tempdir()?;
        let path = dir.path().join("settings.json");
        std::fs::write(
            &path,
            r#"{ "language": "tr", "devices": { "1038:1870": { "pollRateHz": 250 } } }"#,
        )?;
        let settings = SettingsStore::file(&path).load()?;
        assert_eq!(settings.language, Language::Tr);
        assert_eq!(settings.theme, Theme::System);
        let mouse = &settings.devices["1038:1870"];
        assert_eq!(mouse.poll_rate_hz, 250);
        assert_eq!(mouse.dpi_stages, DeviceSettings::default().dpi_stages);
        assert_eq!(mouse.managed, Managed::default());
        assert!(!mouse.dpi_pending);
        Ok(())
    }

    #[test]
    fn an_unreadable_file_is_kept_aside_and_the_defaults_are_used() -> TestResult {
        let dir = tempfile::tempdir()?;
        let path = dir.path().join("settings.json");
        std::fs::write(&path, "{ not json")?;
        let store = SettingsStore::file(&path);
        assert_eq!(store.load()?, Settings::default());
        assert!(!path.exists());
        assert_eq!(
            std::fs::read_to_string(path.with_extension("json.invalid"))?,
            "{ not json"
        );
        Ok(())
    }

    #[test]
    fn out_of_range_values_are_brought_back_into_range() {
        let wild = DeviceSettings {
            dpi_stages: vec![10, 900, 99_999, 400, 500, 600, 700],
            start_stage: 9,
            poll_rate_hz: 333,
            color: "red".to_owned(),
            zones: Zones {
                front: "#12345".to_owned(),
                middle: "#ABCDEF".to_owned(),
                rear: "".to_owned(),
            },
            ..DeviceSettings::default()
        }
        .sanitized();
        assert_eq!(wild.dpi_stages, [50, 900, 30_000, 400, 500]);
        assert_eq!(wild.start_stage, 0);
        assert_eq!(wild.poll_rate_hz, 1000);
        assert_eq!(wild.color, "#1fc8ff");
        assert_eq!(wild.zones.front, "#1fc8ff");
        assert_eq!(wild.zones.middle, "#abcdef");
        assert_eq!(wild.zones.rear, "#ff4fa8");

        let empty = DeviceSettings {
            dpi_stages: Vec::new(),
            start_stage: 3,
            ..DeviceSettings::default()
        }
        .sanitized();
        assert_eq!(empty.dpi_stages, DeviceSettings::default().dpi_stages);
        assert_eq!(empty.start_stage, DeviceSettings::default().start_stage);
    }

    #[test]
    fn device_keys_are_normalized() {
        let mut settings = Settings::default();
        settings
            .devices
            .insert(" 1038:12AB ".to_owned(), DeviceSettings::default());
        let settings = settings.sanitized();
        assert!(settings.devices.contains_key("1038:12ab"));
    }

    #[test]
    fn hex_colours_are_normalized() {
        assert_eq!(normalize_hex("#1FC8FF").as_deref(), Some("#1fc8ff"));
        assert_eq!(normalize_hex(" #abc ").as_deref(), Some("#aabbcc"));
        assert_eq!(normalize_hex("1fc8ff"), None);
        assert_eq!(normalize_hex("#1fc8f"), None);
        assert_eq!(normalize_hex("#ggg"), None);
        assert_eq!(normalize_hex("#+1+2+3"), None);
    }

    #[test]
    fn the_memory_store_keeps_what_it_was_given() -> TestResult {
        let store = SettingsStore::memory();
        assert_eq!(store.load()?, Settings::default());
        let saved = store.save(Settings {
            first_run_done: true,
            ..Settings::default()
        })?;
        assert_eq!(store.load()?, saved);
        assert!(store.load()?.first_run_done);
        Ok(())
    }
}
