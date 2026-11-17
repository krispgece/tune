# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tune (working name) is a Linux desktop app for SteelSeries devices, built on the ssgg Rust library
(`steelseries_gg`). Phase 1 is in place: every screen of the approved mockup runs on fake devices; with real devices
the app only lists them, and every action that would send to a device is a stub until the Phase 0 hardware test.

- Stack: Tauri 2 + React/TypeScript (Vite). The Rust side calls the library in-process through one adapter module.
- During development the library comes from the sibling checkout `../steelseriesgg-rs` (branch
  `rival3-gen2/phase0`, not pushed), which also builds the `ssgg` CLI that the test guide uses.
- Build anything from that checkout with `RUSTFLAGS=-Ctarget-cpu=x86-64` (for example
  `RUSTFLAGS=-Ctarget-cpu=x86-64 cargo build --release --locked`). Its `.cargo/config.toml` targets x86-64-v3, and
  the owner's PC has no AVX2, so a default build crashes there. This repository's own `.cargo/config.toml` already
  sets the baseline; a `RUSTFLAGS` variable replaces it, so keep the flag in one you set.
- First device: the wired Rival 3 Gen 2. Settings live on the PC and are re-applied on plug-in; nothing is saved to
  the device's memory.

## Layout

```
crates/tune-core/   adapter.rs (the only module that calls steelseries_gg; read-only device list, apply stubbed),
                    mock.rs (fake devices and situations), settings.rs (settings file), access.rs (udev rule name)
src-tauri/          the window and the commands the interface calls; picks the mock with --mock or TUNE_BACKEND=mock
src/                React UI: app/useTune.ts (state and actions), screens/, components/, state/ (pure logic),
                    i18n/ (en.ts, tr.ts), theme/ (tokens computed for light and dark), backend/ (Tauri calls and
                    an in-page mock for `npm run dev`)
packaging/linux/    the udev rule, also bundled as an app resource
docs/               the Phase 0 hardware test guide (Turkish)
```

## Commands

| Step | Command |
|------|---------|
| App, fake devices | `npm run app:mock` |
| App, real devices (list only) | `npm run app` |
| Interface in a browser, in-page fake devices | `npm run dev` (port 1420) |
| Release binary | `npm run app:release` (`target/release/tune`) |
| Tests | `npm test`, `cargo test --locked` |
| Checks | `npm run check`, `cargo fmt --all -- --check`, `cargo clippy --all-targets --locked -- -D warnings` |

Building `src-tauri` needs `libwebkit2gtk-4.1-dev` (it pulls in GTK 3 and libsoup 3). The in-page mock
(`src/backend/browserMock.ts`) mirrors `crates/tune-core/src/mock.rs`; change both together.

## Renaming

"Tune" is a working name. The display name is `productName` and the bundle identifier is `identifier`, both in
`src-tauri/tauri.conf.json`; the UI, the page title and the window title read them from there. UI strings use
`{app}` instead of the name, and a test fails on a literal "Tune" in them. After a rename, check the Turkish
strings with a suffix after `{app}` (`{app}'a`, `{app}'u`, `{app}'un`): the suffix must follow the new name's
vowel harmony. Internal names (crate `tune`, `tune-core`, the rule file `70-tune-rival3-gen2.rules`) may stay.

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
  run device-writing commands, `sudo` or udev changes yourself.
- **udev rule.** hidraw of the one settings interface only, `TAG+="uaccess"`, no `GROUP`/`MODE`, numbered below 73;
  check it with `udevadm verify`.
- **Publishing.** No GitHub repository, push or release without the owner's explicit go-ahead.
- **Commits.** Conventional Commits.
