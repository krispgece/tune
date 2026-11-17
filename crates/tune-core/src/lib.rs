//! Core of the Tune desktop app: the device backends and the settings store.
//!
//! Nothing here depends on the window toolkit, so it builds and tests without the WebKitGTK stack. Two backends
//! implement [`Backend`]: [`adapter::SsggBackend`] lists the real devices through the ssgg library, and
//! [`mock::MockBackend`] serves fake devices so the whole interface can be checked with no hardware.

pub mod access;
pub mod adapter;
pub mod backend;
pub mod error;
pub mod mock;
pub mod model;
pub mod settings;
pub mod sleep;

pub use backend::{Backend, BackendKind};
pub use error::{Error, Result};
