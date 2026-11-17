//! Passive checks of the device access permission. Nothing here opens a device.

use std::path::{Path, PathBuf};

use crate::model::DeviceAccess;

/// File name of the udev rule that opens the mouse's settings interface to the signed-in user.
pub const RULE_FILE_NAME: &str = "70-tune-rival3-gen2.rules";

/// Where udev reads rules from, local administrator rules first.
pub const RULE_DIRS: [&str; 3] = ["/etc/udev/rules.d", "/usr/lib/udev/rules.d", "/lib/udev/rules.d"];

/// The installed copy of the access rule, if any.
pub fn installed_rule() -> Option<PathBuf> {
    find_rule(RULE_DIRS.iter().map(Path::new))
}

pub fn find_rule<'a>(dirs: impl IntoIterator<Item = &'a Path>) -> Option<PathBuf> {
    dirs.into_iter()
        .map(|dir| dir.join(RULE_FILE_NAME))
        .find(|path| path.is_file())
}

/// Whether the current user may read and write a device node, ACLs included.
#[cfg(unix)]
pub fn node_access(path: &str) -> DeviceAccess {
    use rustix::fs::{Access, access};

    match access(path, Access::READ_OK | Access::WRITE_OK) {
        Ok(()) => DeviceAccess::Allowed,
        Err(_) => DeviceAccess::Denied,
    }
}

#[cfg(not(unix))]
pub fn node_access(_path: &str) -> DeviceAccess {
    DeviceAccess::Allowed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_the_rule_in_the_first_directory_that_has_it() -> std::io::Result<()> {
        let etc = tempfile::tempdir()?;
        let lib = tempfile::tempdir()?;
        assert_eq!(find_rule([etc.path(), lib.path()]), None);

        std::fs::write(lib.path().join(RULE_FILE_NAME), "")?;
        assert_eq!(
            find_rule([etc.path(), lib.path()]),
            Some(lib.path().join(RULE_FILE_NAME))
        );

        std::fs::write(etc.path().join(RULE_FILE_NAME), "")?;
        assert_eq!(
            find_rule([etc.path(), lib.path()]),
            Some(etc.path().join(RULE_FILE_NAME))
        );
        Ok(())
    }

    #[test]
    fn a_directory_with_the_rule_name_is_not_a_rule() -> std::io::Result<()> {
        let etc = tempfile::tempdir()?;
        std::fs::create_dir(etc.path().join(RULE_FILE_NAME))?;
        assert_eq!(find_rule([etc.path()]), None);
        Ok(())
    }

    #[cfg(unix)]
    #[test]
    fn node_access_follows_the_file_permissions() -> std::io::Result<()> {
        let dir = tempfile::tempdir()?;
        let path = dir.path().join("node");
        std::fs::write(&path, "")?;
        let text = path.to_string_lossy();
        assert_eq!(node_access(&text), DeviceAccess::Allowed);
        assert_eq!(node_access(&format!("{text}-missing")), DeviceAccess::Denied);
        Ok(())
    }
}
