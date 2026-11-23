//! The app shell: the window and the commands the interface calls. Device work and settings live in `tune-core`.
//!
//! The backend is chosen at start: real devices by default, fake ones with `--mock` or `TUNE_BACKEND=mock`. The mock
//! backend keeps its settings and the start-at-login choice in memory, so checking the interface never touches the
//! real settings file or the login items.
//!
//! The app lives in the tray: closing the window hides it, so the app keeps sending settings when the mouse is plugged
//! in or the computer wakes, until Quit (in the tray menu or in Settings). With `--background` (how the login entry
//! starts it) the window stays hidden. Only one copy runs; a second start shows the first one's window and ends. Where
//! the tray icon cannot be made (no appindicator library), closing the window quits the app as before.

use std::path::PathBuf;

use serde::Serialize;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::path::BaseDirectory;
use tauri::tray::TrayIconBuilder;
use tauri::{App, AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent, Wry};
use tune_core::access::RULE_FILE_NAME;
use tune_core::adapter::SsggBackend;
use tune_core::autostart::{Autostart, AutostartStatus, BACKGROUND_ARG};
use tune_core::mock::MockBackend;
use tune_core::model::{ActionOutcome, ApplyOutcome, ScanReport, Scenario, SettingGroup};
use tune_core::settings::{DeviceSettings, Settings, SettingsStore};
use tune_core::{Backend, BackendKind};

/// The name of this copy's single-copy lock and of its tray icon, so the real app and the mock never share either.
fn copy_name(mock: bool) -> &'static str {
    if mock { "tune-mock" } else { "tune" }
}

/// The access rule among the app's resources; `bundle.resources` in `tauri.conf.json` puts it there.
const BUNDLED_RULE: &str = "udev/70-tune-rival3-gen2.rules";
/// Next to the settings file while sending is paused for safety, so the pause holds across restarts.
const PAUSE_FILE: &str = "reapply-paused";
const MAIN_WINDOW: &str = "main";
const TRAY_OPEN: &str = "open";
const TRAY_QUIT: &str = "quit";

struct AppState {
    backend: Box<dyn Backend>,
    store: SettingsStore,
    autostart: Autostart,
}

/// The tray menu's items, kept so their text can follow the interface language. Managed only when the tray icon
/// could be made; without it, closing the window quits the app as usual.
struct Tray {
    open: MenuItem<Wry>,
    quit: MenuItem<Wry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    name: String,
    version: String,
    backend: BackendKind,
    sends_settings: bool,
    /// True when the app has a tray icon and keeps running after its window is closed.
    tray: bool,
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
    let tray = app.try_state::<Tray>().is_some();
    blocking(app, move |state| {
        Ok(AppInfo {
            name,
            version,
            backend: state.backend.kind(),
            sends_settings: state.backend.sends_settings(),
            tray,
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
async fn autostart_status(app: AppHandle) -> CommandResult<AutostartStatus> {
    blocking(app, |state| Ok(state.autostart.status())).await
}

#[tauri::command]
async fn set_autostart(app: AppHandle, enabled: bool) -> CommandResult<AutostartStatus> {
    blocking(app, move |state| {
        state.autostart.set(enabled).map_err(|e| e.to_string())
    })
    .await
}

/// The tray menu in the interface language; the interface sends its texts when it loads and when the language changes.
#[tauri::command]
fn set_tray_texts(app: AppHandle, open: String, quit: String) -> CommandResult<()> {
    let Some(tray) = app.try_state::<Tray>() else {
        return Ok(());
    };
    tray.open.set_text(open).map_err(|e| e.to_string())?;
    tray.quit.set_text(quit).map_err(|e| e.to_string())
}

/// Ends the app, tray icon included: the window's own way out, also where the desktop shows no tray icons.
#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
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

fn show_main_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };
    for result in [window.show(), window.unminimize(), window.set_focus()] {
        if let Err(error) = result {
            eprintln!("could not show the window: {error}");
        }
    }
}

fn build_tray(app: &App, id: &str) -> tauri::Result<Tray> {
    let name = app.package_info().name.clone();
    let open = MenuItem::with_id(app, TRAY_OPEN, format!("Open {name}"), true, None::<&str>)?;
    let quit = MenuItem::with_id(app, TRAY_QUIT, format!("Quit {name}"), true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &PredefinedMenuItem::separator(app)?, &quit])?;
    let mut tray = TrayIconBuilder::with_id(id)
        .menu(&menu)
        .tooltip(&name)
        .on_menu_event(|app, event| match event.id().as_ref() {
            TRAY_OPEN => show_main_window(app),
            TRAY_QUIT => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(Tray { open, quit })
}

fn autostart_for(app: &App, app_id: &str) -> Autostart {
    let name = app.package_info().name.clone();
    // A development build loads its interface from the dev server, which does not run at login.
    let program = if tauri::is_dev() {
        None
    } else {
        std::env::current_exe().ok()
    };
    match Autostart::entry_path(app_id) {
        Some(entry) => Autostart::file(entry, program, name),
        // No home folder to keep the entry in: the choice shows as unavailable.
        None => Autostart::file(PathBuf::new(), None, name),
    }
}

/// Claims the single-copy lock in the user's runtime folder; `None` where there is none to claim, and the app then
/// runs without the check.
#[cfg(unix)]
fn claim_instance(app_id: &str, mock: bool) -> Option<tune_core::single_instance::Instance> {
    let dir = PathBuf::from(std::env::var_os("XDG_RUNTIME_DIR")?);
    if !dir.is_absolute() {
        return None;
    }
    match tune_core::single_instance::claim(&dir.join(app_id), copy_name(mock)) {
        Ok(instance) => Some(instance),
        Err(error) => {
            eprintln!("could not check for another running copy: {error}");
            None
        }
    }
}

pub fn run() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let mock =
        args.iter().any(|arg| arg == "--mock") || std::env::var("TUNE_BACKEND").is_ok_and(|value| value == "mock");
    let background = args.iter().any(|arg| arg == BACKGROUND_ARG);
    let context = tauri::generate_context!();
    let app_id = context.config().identifier.clone();

    #[cfg(unix)]
    let mut first = match claim_instance(&app_id, mock) {
        Some(tune_core::single_instance::Instance::Other { reached }) => {
            let name = &context.package_info().name;
            if reached {
                eprintln!("{name} is already running; its window opens.");
            } else {
                eprintln!("{name} is already running but did not answer.");
            }
            return;
        }
        Some(tune_core::single_instance::Instance::First(primary)) => Some(primary),
        None => None,
    };

    let result = tauri::Builder::default()
        .setup(move |app| {
            let state = if mock {
                AppState {
                    backend: Box::new(MockBackend::new()),
                    store: SettingsStore::memory(),
                    autostart: Autostart::memory(),
                }
            } else {
                let config = app.path().app_config_dir()?;
                AppState {
                    backend: Box::new(SsggBackend::with_pause_file(config.join(PAUSE_FILE))),
                    store: SettingsStore::file(config.join("settings.json")),
                    autostart: autostart_for(app, &app_id),
                }
            };
            app.manage(state);
            // The Linux tray loads its appindicator library on first use and panics when it is missing; the app then
            // runs without a tray instead of ending.
            let built = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| build_tray(app, copy_name(mock))));
            let tray = match built {
                Ok(Ok(tray)) => {
                    app.manage(tray);
                    true
                }
                Ok(Err(error)) => {
                    eprintln!("could not add the tray icon: {error}");
                    false
                }
                Err(_) => {
                    eprintln!("could not add the tray icon: no usable appindicator library");
                    false
                }
            };
            WebviewWindowBuilder::new(app, MAIN_WINDOW, WebviewUrl::default())
                .title(app.package_info().name.clone())
                .inner_size(1200.0, 860.0)
                .min_inner_size(720.0, 560.0)
                .center()
                // Without a tray icon a hidden window could not be opened again.
                .visible(!(background && tray))
                .build()?;
            #[cfg(unix)]
            if let Some(primary) = first.take() {
                let handle = app.handle().clone();
                primary.serve(move || show_main_window(&handle))?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event
                && window.label() == MAIN_WINDOW
                && window.app_handle().try_state::<Tray>().is_some()
            {
                // Keep running in the tray, so settings still go out on plug-in and wake.
                api.prevent_close();
                if let Err(error) = window.hide() {
                    eprintln!("could not hide the window: {error}");
                }
            }
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
            autostart_status,
            set_autostart,
            set_tray_texts,
            quit_app,
        ])
        .run(context);

    if let Err(error) = result {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
