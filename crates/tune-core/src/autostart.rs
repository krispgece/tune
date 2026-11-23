//! Starting the app when the user logs in, through an XDG autostart entry (`~/.config/autostart/<app id>.desktop`)
//! that starts it with [`BACKGROUND_ARG`]: in the tray, with no window, so it can send the mouse its settings.

use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};

use serde::Serialize;

use crate::error::{Error, Result};

/// Starts the app in the tray without showing its window.
pub const BACKGROUND_ARG: &str = "--background";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutostartStatus {
    /// False where starting at login cannot work, as in a development build, which needs its dev server.
    pub available: bool,
    pub enabled: bool,
}

/// Where the autostart choice lives: the entry file for real use, memory for the mock backend.
#[derive(Debug)]
pub enum Autostart {
    File {
        entry: PathBuf,
        /// The program the entry starts; `None` where it cannot be started at login.
        program: Option<PathBuf>,
        name: String,
    },
    Memory(Mutex<bool>),
}

impl Autostart {
    pub fn file(entry: impl Into<PathBuf>, program: Option<PathBuf>, name: impl Into<String>) -> Self {
        Self::File {
            entry: entry.into(),
            program,
            name: name.into(),
        }
    }

    pub fn memory() -> Self {
        Self::Memory(Mutex::new(false))
    }

    /// `$XDG_CONFIG_HOME/autostart/<app id>.desktop`, or the same under `~/.config`.
    pub fn entry_path(app_id: &str) -> Option<PathBuf> {
        let config = std::env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .filter(|dir| dir.is_absolute())
            .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")))?;
        Some(config.join("autostart").join(format!("{app_id}.desktop")))
    }

    pub fn status(&self) -> AutostartStatus {
        match self {
            Self::File { entry, program, .. } => AutostartStatus {
                available: program.as_deref().and_then(exec_line).is_some(),
                enabled: entry_enabled(entry),
            },
            Self::Memory(enabled) => AutostartStatus {
                available: true,
                enabled: *enabled.lock().unwrap_or_else(PoisonError::into_inner),
            },
        }
    }

    /// Adds or removes the entry and returns the status afterwards.
    pub fn set(&self, enabled: bool) -> Result<AutostartStatus> {
        match self {
            Self::File { entry, program, name } => {
                if enabled {
                    let exec = program
                        .as_deref()
                        .and_then(exec_line)
                        .ok_or(Error::AutostartUnavailable)?;
                    write_entry(entry, &desktop_entry(name, &exec))?;
                } else {
                    remove_entry(entry)?;
                }
            }
            Self::Memory(stored) => *stored.lock().unwrap_or_else(PoisonError::into_inner) = enabled,
        }
        Ok(self.status())
    }
}

fn desktop_entry(name: &str, exec: &str) -> String {
    // A name with a line break would end the key early; the app's own name never has one.
    let name: String = name.chars().filter(|c| !c.is_control()).collect();
    format!(
        "[Desktop Entry]\nType=Application\nName={name}\nExec={exec}\nTerminal=false\nX-GNOME-Autostart-enabled=true\n"
    )
}

/// The `Exec` value that starts `program` in the background, quoted and escaped as the Desktop Entry
/// specification asks; `None` for a path it cannot carry.
fn exec_line(program: &Path) -> Option<String> {
    let path = program.to_str()?;
    if !program.is_absolute() || path.chars().any(char::is_control) {
        return None;
    }
    let mut quoted = String::from("\"");
    for c in path.chars() {
        match c {
            '"' | '`' | '$' | '\\' => {
                quoted.push('\\');
                quoted.push(c);
            }
            '%' => quoted.push_str("%%"),
            _ => quoted.push(c),
        }
    }
    quoted.push('"');
    // The string escape of the key file comes on top of the quoting: every backslash is written twice.
    Some(format!("{} {BACKGROUND_ARG}", quoted.replace('\\', "\\\\")))
}

/// Whether the entry exists and is switched on; desktops turn an entry off with `Hidden` or the GNOME key.
fn entry_enabled(entry: &Path) -> bool {
    let Ok(text) = std::fs::read_to_string(entry) else {
        return false;
    };
    !text.lines().map(str::trim).any(|line| {
        let compact: String = line.chars().filter(|c| !c.is_whitespace()).collect();
        compact.eq_ignore_ascii_case("Hidden=true") || compact.eq_ignore_ascii_case("X-GNOME-Autostart-enabled=false")
    })
}

fn write_entry(entry: &Path, text: &str) -> Result<()> {
    let error = |source| Error::Autostart {
        path: entry.to_owned(),
        source,
    };
    if let Some(dir) = entry.parent() {
        std::fs::create_dir_all(dir).map_err(error)?;
    }
    let partial = entry.with_extension("desktop.partial");
    std::fs::write(&partial, text).map_err(error)?;
    std::fs::rename(&partial, entry).map_err(error)
}

fn remove_entry(entry: &Path) -> Result<()> {
    match std::fs::remove_file(entry) {
        Err(e) if e.kind() != ErrorKind::NotFound => Err(Error::Autostart {
            path: entry.to_owned(),
            source: e,
        }),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    type TestResult = std::result::Result<(), Box<dyn std::error::Error>>;

    #[test]
    fn the_entry_starts_the_program_in_the_background() -> TestResult {
        let dir = tempfile::tempdir()?;
        let entry = dir.path().join("autostart").join("local.tune.desktop");
        let autostart = Autostart::file(&entry, Some(PathBuf::from("/opt/tune/tune")), "Tune");
        assert_eq!(
            autostart.status(),
            AutostartStatus {
                available: true,
                enabled: false
            }
        );

        assert!(autostart.set(true)?.enabled);
        let text = std::fs::read_to_string(&entry)?;
        assert!(text.starts_with("[Desktop Entry]\n"));
        assert!(text.contains("\nName=Tune\n"));
        assert!(text.contains("\nExec=\"/opt/tune/tune\" --background\n"));
        assert!(!dir.path().join("autostart").join("local.tune.desktop.partial").exists());

        assert!(!autostart.set(false)?.enabled);
        assert!(!entry.exists());
        // Removing an entry that is already gone is fine.
        assert!(!autostart.set(false)?.enabled);
        Ok(())
    }

    #[test]
    fn odd_program_paths_are_quoted_and_escaped() {
        assert_eq!(
            exec_line(Path::new("/home/a b/50% \"x\"/$t`\\")).as_deref(),
            Some(r#""/home/a b/50%% \\"x\\"/\\$t\\`\\\\" --background"#)
        );
        assert_eq!(exec_line(Path::new("relative/tune")), None);
        assert_eq!(exec_line(Path::new("/a\nb")), None);
    }

    #[test]
    fn a_development_build_cannot_start_at_login() -> TestResult {
        let dir = tempfile::tempdir()?;
        let entry = dir.path().join("tune.desktop");
        let autostart = Autostart::file(&entry, None, "Tune");
        assert!(!autostart.status().available);
        assert!(matches!(autostart.set(true), Err(Error::AutostartUnavailable)));
        assert!(!entry.exists());
        // An entry left by an earlier build still shows, and can be removed.
        std::fs::write(&entry, "[Desktop Entry]\nExec=/x\n")?;
        assert!(autostart.status().enabled);
        assert!(!autostart.set(false)?.enabled);
        Ok(())
    }

    #[test]
    fn an_entry_switched_off_by_the_desktop_counts_as_off() -> TestResult {
        let dir = tempfile::tempdir()?;
        for off in [
            "Hidden=true",
            "X-GNOME-Autostart-enabled=false",
            "X-GNOME-Autostart-enabled = false",
        ] {
            let entry = dir.path().join("tune.desktop");
            std::fs::write(&entry, format!("[Desktop Entry]\nExec=/x\n{off}\n"))?;
            assert!(!Autostart::file(&entry, None, "Tune").status().enabled, "{off}");
        }
        Ok(())
    }

    #[test]
    fn the_mock_keeps_the_choice_in_memory() -> Result<()> {
        let autostart = Autostart::memory();
        assert!(autostart.status().available);
        assert!(autostart.set(true)?.enabled);
        assert!(autostart.status().enabled);
        Ok(())
    }
}
