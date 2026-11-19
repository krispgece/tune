//! The app shell: the window and the commands the interface calls. Device work and settings live in `tune-core`.
//!
//! The backend is chosen at start: real devices by default, fake ones with `--mock` or `TUNE_BACKEND=mock`. The mock
//! backend keeps its settings in memory, so checking the interface never touches the real settings file.

use serde::Serialize;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tune_core::access::RULE_FILE_NAME;
use tune_core::adapter::SsggBackend;
use tune_core::mock::MockBackend;
use tune_core::model::{ActionOutcome, ApplyOutcome, ScanReport, Scenario, SettingGroup};
use tune_core::settings::{DeviceSettings, Settings, SettingsStore};
use tune_core::{Backend, BackendKind};

/// The access rule among the app's resources; `bundle.resources` in `tauri.conf.json` puts it there.
const BUNDLED_RULE: &str = "udev/70-tune-rival3-gen2.rules";
/// Next to the settings file while sending is paused for safety, so the pause holds across restarts.
const PAUSE_FILE: &str = "reapply-paused";

struct AppState {
    backend: Box<dyn Backend>,
    store: SettingsStore,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    name: String,
    version: String,
    backend: BackendKind,
    sends_settings: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AccessRuleInfo {
    file_name: &'static str,
    /// The rule file that ships with the app, for installing it by hand.
    source: Option<String>,
}

type CommandResult<T> = Result<T, String>;

/// Runs `work` on a blocking thread: scans and the mock's simulated waits must not hold up the window.
async fn blocking<T: Send + 'static>(
    app: AppHandle,
    work: impl FnOnce(&AppState) -> CommandResult<T> + Send + 'static,
) -> CommandResult<T> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.try_state::<AppState>().ok_or("the app is still starting")?;
        work(&state)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn app_info(app: AppHandle) -> CommandResult<AppInfo> {
    let info = app.package_info();
    let (name, version) = (info.name.clone(), info.version.to_string());
    blocking(app, move |state| {
        Ok(AppInfo {
            name,
            version,
            backend: state.backend.kind(),
            sends_settings: state.backend.sends_settings(),
        })
    })
    .await
}

#[tauri::command]
async fn scan_devices(app: AppHandle) -> CommandResult<ScanReport> {
    blocking(app, |state| state.backend.scan().map_err(|e| e.to_string())).await
}

#[tauri::command]
async fn load_settings(app: AppHandle) -> CommandResult<Settings> {
    blocking(app, |state| state.store.load().map_err(|e| e.to_string())).await
}

#[tauri::command]
async fn save_settings(app: AppHandle, settings: Settings) -> CommandResult<Settings> {
    blocking(app, move |state| state.store.save(settings).map_err(|e| e.to_string())).await
}

#[tauri::command]
async fn apply_settings(
    app: AppHandle,
    device_id: String,
    group: SettingGroup,
    settings: DeviceSettings,
) -> CommandResult<ApplyOutcome> {
    blocking(app, move |state| {
        state
            .backend
            .apply(&device_id, group, &settings.sanitized())
            .map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
async fn request_access(app: AppHandle) -> CommandResult<ActionOutcome> {
    blocking(app, |state| Ok(state.backend.request_access())).await
}

#[tauri::command]
async fn remove_access(app: AppHandle) -> CommandResult<ActionOutcome> {
    blocking(app, |state| Ok(state.backend.remove_access())).await
}

#[tauri::command]
async fn resume_reapply(app: AppHandle) -> CommandResult<ActionOutcome> {
    blocking(app, |state| Ok(state.backend.resume_reapply())).await
}

#[tauri::command]
async fn set_mock_scenario(app: AppHandle, scenario: Scenario) -> CommandResult<()> {
    blocking(app, move |state| {
        state.backend.set_mock_scenario(scenario).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
fn access_rule(app: AppHandle) -> AccessRuleInfo {
    let source = app
        .path()
        .resolve(BUNDLED_RULE, BaseDirectory::Resource)
        .ok()
        .filter(|path| path.is_file())
        .map(|path| path.to_string_lossy().into_owned());
    AccessRuleInfo {
        file_name: RULE_FILE_NAME,
        source,
    }
}

pub fn run() {
    let mock = std::env::args().skip(1).any(|arg| arg == "--mock")
        || std::env::var("TUNE_BACKEND").is_ok_and(|value| value == "mock");

    let result = tauri::Builder::default()
        .setup(move |app| {
            let state = if mock {
                AppState {
                    backend: Box::new(MockBackend::new()),
                    store: SettingsStore::memory(),
                }
            } else {
                let config = app.path().app_config_dir()?;
                AppState {
                    backend: Box::new(SsggBackend::with_pause_file(config.join(PAUSE_FILE))),
                    store: SettingsStore::file(config.join("settings.json")),
                }
            };
            app.manage(state);
            WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title(app.package_info().name.clone())
                .inner_size(1200.0, 860.0)
                .min_inner_size(720.0, 560.0)
                .center()
                .build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_info,
            scan_devices,
            load_settings,
            save_settings,
            apply_settings,
            request_access,
            remove_access,
            resume_reapply,
            set_mock_scenario,
            access_rule,
        ])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
