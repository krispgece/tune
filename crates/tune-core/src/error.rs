use std::path::PathBuf;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("could not list the devices: {0}")]
    Scan(String),
    #[error("could not read {path}: {source}")]
    ReadSettings {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("could not save {path}: {source}")]
    WriteSettings {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("could not encode the settings: {0}")]
    EncodeSettings(#[from] serde_json::Error),
    #[error("the settings store is unavailable")]
    StoreUnavailable,
    #[error("this works only with the mock backend")]
    NotMock,
    #[error("the device is not plugged in")]
    DeviceGone,
    #[error("could not send the setting: {0}")]
    Send(String),
    #[error("could not change {path}: {source}")]
    Autostart {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("starting at login is not available in this build")]
    AutostartUnavailable,
}

pub type Result<T> = std::result::Result<T, Error>;
