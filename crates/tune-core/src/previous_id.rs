//! Before its first release the app id changed from [`PREVIOUS_APP_ID`] to the published one. A copy that ran under the
//! old id kept its settings folder and its login entry under that id; the first start under the new id moves both, so
//! the settings and the start-at-login choice carry over.

use std::path::{Path, PathBuf};

use crate::error::{Error, Result};

pub const PREVIOUS_APP_ID: &str = "local.tune.desktop";

/// Where one app id keeps its settings folder and its login entry.
#[derive(Debug, Clone)]
pub struct IdPaths {
    pub settings_dir: PathBuf,
    pub login_entry: Option<PathBuf>,
}

/// What was moved from the previous id's places.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct Moved {
    pub settings: bool,
    pub login_entry: bool,
}

/// Moves the previous settings folder to the current one when only the previous one exists; settings already under the
/// current id are never replaced. Moves the previous login entry to its new name, or removes it when an entry under the
/// new name exists, so the app is not started twice at login.
pub fn move_over(previous: &IdPaths, current: &IdPaths) -> Result<Moved> {
    let mut moved = Moved::default();
    if previous.settings_dir.is_dir() && !exists(&current.settings_dir) {
        rename(&previous.settings_dir, &current.settings_dir)?;
        moved.settings = true;
    }
    if let (Some(old), Some(new)) = (&previous.login_entry, &current.login_entry)
        && old != new
        && exists(old)
    {
        if exists(new) {
            std::fs::remove_file(old).map_err(|source| Error::Autostart {
                path: old.clone(),
                source,
            })?;
        } else {
            std::fs::rename(old, new).map_err(|source| Error::Autostart {
                path: old.clone(),
                source,
            })?;
            moved.login_entry = true;
        }
    }
    Ok(moved)
}

/// Whether anything is at `path`, a broken link included.
fn exists(path: &Path) -> bool {
    std::fs::symlink_metadata(path).is_ok()
}

fn rename(from: &Path, to: &Path) -> Result<()> {
    let error = |source| Error::WriteSettings {
        path: to.to_owned(),
        source,
    };
    if let Some(parent) = to.parent() {
        std::fs::create_dir_all(parent).map_err(error)?;
    }
    std::fs::rename(from, to).map_err(error)
}

#[cfg(test)]
mod tests {
    use super::*;

    type TestResult = std::result::Result<(), Box<dyn std::error::Error>>;

    fn paths(config: &Path, id: &str) -> IdPaths {
        IdPaths {
            settings_dir: config.join(id),
            login_entry: Some(config.join("autostart").join(format!("{id}.desktop"))),
        }
    }

    #[test]
    fn settings_and_login_entry_move_to_the_new_id() -> TestResult {
        let dir = tempfile::tempdir()?;
        let (old, new) = (paths(dir.path(), "old.id"), paths(dir.path(), "new.id"));
        std::fs::create_dir_all(&old.settings_dir)?;
        std::fs::write(old.settings_dir.join("settings.json"), "{\"version\":1}")?;
        std::fs::write(old.settings_dir.join("reapply-paused"), "")?;
        let (Some(old_entry), Some(new_entry)) = (&old.login_entry, &new.login_entry) else {
            return Err("test paths have entries".into());
        };
        std::fs::create_dir_all(dir.path().join("autostart"))?;
        std::fs::write(old_entry, "[Desktop Entry]\nExec=\"/opt/tune\" --background\n")?;

        let moved = move_over(&old, &new)?;
        assert_eq!(
            moved,
            Moved {
                settings: true,
                login_entry: true
            }
        );
        assert_eq!(
            std::fs::read_to_string(new.settings_dir.join("settings.json"))?,
            "{\"version\":1}"
        );
        assert!(new.settings_dir.join("reapply-paused").exists());
        assert!(!old.settings_dir.exists());
        assert!(std::fs::read_to_string(new_entry)?.contains("--background"));
        assert!(!old_entry.exists());

        // A second start finds nothing left to move.
        assert_eq!(move_over(&old, &new)?, Moved::default());
        Ok(())
    }

    #[test]
    fn settings_under_the_new_id_are_kept() -> TestResult {
        let dir = tempfile::tempdir()?;
        let (old, new) = (paths(dir.path(), "old.id"), paths(dir.path(), "new.id"));
        std::fs::create_dir_all(&old.settings_dir)?;
        std::fs::write(old.settings_dir.join("settings.json"), "old")?;
        std::fs::create_dir_all(&new.settings_dir)?;
        std::fs::write(new.settings_dir.join("settings.json"), "new")?;

        assert!(!move_over(&old, &new)?.settings);
        assert_eq!(std::fs::read_to_string(new.settings_dir.join("settings.json"))?, "new");
        assert_eq!(std::fs::read_to_string(old.settings_dir.join("settings.json"))?, "old");
        Ok(())
    }

    #[test]
    fn an_old_login_entry_goes_when_a_new_one_exists() -> TestResult {
        let dir = tempfile::tempdir()?;
        let (old, new) = (paths(dir.path(), "old.id"), paths(dir.path(), "new.id"));
        let (Some(old_entry), Some(new_entry)) = (&old.login_entry, &new.login_entry) else {
            return Err("test paths have entries".into());
        };
        std::fs::create_dir_all(dir.path().join("autostart"))?;
        std::fs::write(old_entry, "old")?;
        std::fs::write(new_entry, "new")?;

        assert!(!move_over(&old, &new)?.login_entry);
        assert!(!old_entry.exists());
        assert_eq!(std::fs::read_to_string(new_entry)?, "new");
        Ok(())
    }

    #[test]
    fn nothing_to_move_is_fine() -> TestResult {
        let dir = tempfile::tempdir()?;
        let (old, new) = (paths(dir.path(), "old.id"), paths(dir.path(), "new.id"));
        assert_eq!(move_over(&old, &new)?, Moved::default());
        assert!(!new.settings_dir.exists());
        Ok(())
    }
}
