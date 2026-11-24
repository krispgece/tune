# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tune (working name) is a Linux desktop app for SteelSeries devices, built on the ssgg Rust library
(`steelseries_gg`). Every screen runs on fake devices, and with the wired
Rival 3 Gen 2 the app sends DPI stages, polling rate and lighting. Installing or removing the access rule from the app
(the system's password window) is still a stub; the app shows the terminal commands instead.

- Stack: Tauri 2 + React/TypeScript (Vite). The Rust side calls the library in-process through one adapter module.
- The library comes from the fork `krispgece/steelseriesgg-rs`, pinned to a commit in `crates/tune-core/Cargo.toml`,
  until its mouse changes are in an upstream release. To try a local ssgg change, add a temporary `[patch]` for that
  git URL pointing at a local checkout; never commit the patch, nor `Cargo.lock` while it is on.
- Build an ssgg checkout itself with `RUSTFLAGS=-Ctarget-cpu=x86-64` (for example
  `RUSTFLAGS=-Ctarget-cpu=x86-64 cargo build --release --locked`). Its `.cargo/config.toml` targets x86-64-v3, which
  crashes on CPUs without AVX2. This repository's own `.cargo/config.toml` already
  sets the baseline; a `RUSTFLAGS` variable replaces it, so keep the flag in one you set.
- First device: the wired Rival 3 Gen 2. Colour and polling rate live on the PC and are sent again at app start and,
  while the app runs, on plug-in and after the computer wakes (the mouse forgets them). The mouse stores DPI stages and
  the stage it was last on by itself, so the app sends DPI only when it changes, and shows stages as on the mouse only
  after the mouse confirmed them (`dpiSync` in the settings). The app sends no save command. A mouse that drops off
  twice soon after a send pauses sending until the user tries again, also across restarts (the file `reapply-paused`
  next to the settings file).
- The app lives in the tray: closing the window hides it and the re-sends go on; Quit (tray menu, or Settings ›
  Start-up) ends it. Without an appindicator library the tray build panics inside the library; the shell catches that
  and runs with no tray, where closing the window quits. `--background` starts it with the window hidden, which is how
  the login entry (`~/.config/autostart/io.github.krispgece.tune.desktop`, named after the app id, release builds
  only) starts it.
  One copy runs at a time: a lock and a socket in `$XDG_RUNTIME_DIR/<app id>/` (`tune.*`, `tune-mock.*` for the mock;
  the tray icon's id uses the same name); a second start asks the first to show its window and ends.

## Layout

```
crates/tune-core/   adapter.rs (the only module that calls steelseries_gg: device list, sending, re-apply pause),
                    mock.rs (fake devices and situations), settings.rs (settings file), access.rs (udev rule name,
                    node access, which plug-in a node belongs to), autostart.rs (login entry),
                    previous_id.rs (moves what the pre-release app id left),
                    single_instance.rs (one copy at a time)
src-tauri/          the window, the tray and the commands the interface calls; picks the mock with --mock or
                    TUNE_BACKEND=mock
src/                React UI: app/useTune.ts (state and actions), screens/, components/, state/ (pure logic),
                    i18n/ (en.ts, tr.ts), theme/ (tokens computed for light and dark), backend/ (Tauri calls and
                    an in-page mock for `npm run dev`)
packaging/linux/    the udev rule, also bundled as an app resource
docs/               local try-out guides (Turkish), not tracked: listed in `.git/info/exclude`
```

## Commands

| Step | Command |
|------|---------|
| App, fake devices | `npm run app:mock` |
| App, real devices (sends to the mouse: the owner runs it) | `npm run app` |
| Interface in a browser, in-page fake devices | `npm run dev` (port 1420) |
| Release binary | `npm run app:release` (`target/release/tune`) |
| Tests | `npm test`, `cargo test --locked` |
| Checks | `npm run check`, `npm run notices:check`, `cargo fmt --all -- --check`, `cargo clippy --all-targets --locked -- -D warnings` |
| Third-party notices | `npm run notices` (after any dependency change; writes `THIRD-PARTY-NOTICES.txt`) |

Building `src-tauri` needs `libwebkit2gtk-4.1-dev` (it pulls in GTK 3 and libsoup 3). The in-page mock
(`src/backend/browserMock.ts`) mirrors `crates/tune-core/src/mock.rs`; change both together.

## Renaming

"Tune" is a working name. The display name is `productName` and the bundle identifier is `identifier`, both in
`src-tauri/tauri.conf.json`; the UI, the page title and the window title read them from there. UI strings use
`{app}` instead of the name, and a test fails on a literal "Tune" in them. After a rename, check the Turkish
strings with a suffix after `{app}` (`{app}'a`, `{app}'u`, `{app}'un`): the suffix must follow the new name's
vowel harmony. Internal names (crate `tune`, `tune-core`, the rule file `70-tune-rival3-gen2.rules`) may stay.
Keep the identifier (`io.github.krispgece.tune`) through a rename: it names the settings folder, the login entry and
the single-copy lock folder. It replaced the pre-release `local.tune.desktop`; `previous_id.rs` moves what that id
left on first start, and a release build then points a moved login entry at itself.

## Rules

- **No protocol information in this repository.** No command bytes, opcodes, report layouts, captures or
  reverse-engineering notes in code comments, docs, the README, UI text or commit messages. Device communication and
  its documentation stay in ssgg. Public USB IDs (`vendor:product`) are fine.
- **Own identity.** Tune must not resemble SteelSeries GG: no SteelSeries or GG logos, product photos or renders,
  SteelSeries orange, or GG section names (Engine, Sonar, Moments, Prism). Product names appear only to identify
  devices.
- **Legal notice.** Keep the full notice in the README and on the app's About screen (English and Turkish), and the
  short line on the first-run screen. Name no single company as the trademark owner: ownership moves within the
  SteelSeries/GN group.
- **English names.** Identifiers, file and folder names, ids and the words inside commands are English. Guides for
  the owner may be in Turkish.
- **UI language.** English by default; every UI string also ships in Turkish.
- **Hardware steps.** Prepare the exact commands and let the owner run them; record only results they confirm. Never
  run device-writing commands, `sudo` or udev changes yourself. The app on real devices (`npm run app`,
  `target/release/tune` without `--mock`) sends settings to a plugged-in mouse, so it counts as device-writing; check
  your work with `npm run app:mock` or `npm run dev`.
- **The owner's running app.** `npm run app` rebuilds and restarts on Rust edits and takes frontend edits live; some,
  such as `index.html`, `vite.config.ts` or `tsconfig.json`, reload the window. Every start or reload sends the saved
  settings to the mouse. Before editing anything but Markdown files, check that no real-backend Tune runs: run
  `pgrep -af '[t]auri dev|target/(debug|release)/[t]une'` as a command of its own, and it prints nothing then (the
  brackets keep it from matching its own command line). If it lists a Tune you did not start, ask the owner to stop
  it first. A Tune in the tray runs with no window (also one started at login), so it shows here, not on screen; the
  owner ends it with Quit in the tray menu. The real app's lock is shared by development and release builds: while a
  release copy runs, `npm run app` only brings up that copy's window and ends.
- **Login items.** Turning on Start at login writes the user's autostart folder. Check it with the fake devices,
  which keep the choice in memory; never turn it on in a real-backend run yourself.
- **udev rule.** hidraw of the one settings interface only, `TAG+="uaccess"`, no `GROUP`/`MODE`, numbered below 73;
  check it with `udevadm verify`.
- **License.** GPL-3.0-or-later: `LICENSE`, the `license` fields in `Cargo.toml` and `package.json`, the bundle
  fields in `tauri.conf.json`, the README section and the About screen (English and Turkish). A new dependency must
  be GPL-3.0-compatible: no GPL-2.0-only, no proprietary or source-unavailable code. `THIRD-PARTY-NOTICES.txt`
  ships with the app (bundle resource, and the About screen loads it): regenerate it after every dependency change.
- **Publishing.** No GitHub repository, push or release without the owner's explicit go-ahead.
- **Commits.** Conventional Commits.
