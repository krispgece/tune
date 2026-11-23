# Tune

Tune (working name) is a desktop app for configuring SteelSeries devices on Linux: DPI stages, polling rate and
lighting. Tune is only a graphical frontend. The [ssgg](https://github.com/Ven0m0/steelseriesgg-rs) library
(`steelseries_gg`) talks to the devices, so the devices Tune can detect depend on ssgg.

Unofficial. Not affiliated with or endorsed by SteelSeries; see the [legal notice](#legal-notice) below.

## Status

Phase 1: the app's screens are built and also run on fake devices. With a wired Rival 3 Gen 2 the app sends DPI
stages, the polling rate and the lighting (one colour, by zone or off), and shows what the mouse answered. These were
tried on one mouse, first by hand in the Phase 0 hardware test and then from the app in the Phase 1 try-out
(2026-11-23, `docs/`). Sending again after the computer wakes from sleep was not tried on the mouse.

- First supported device: the wired Rival 3 Gen 2. Other SteelSeries devices that ssgg recognizes show up as "Not
  supported yet", and nothing is sent to them.
- The mouse forgets its colour and polling rate when it's unplugged, so the app keeps them on the computer and sends
  them again when it starts and, while it runs, whenever the mouse is plugged in or the computer wakes from sleep.
  The mouse stores its DPI stages itself, so the app sends them only when they change. The app sends no command to
  save settings into the mouse.
- Closing the window keeps the app running in the tray; Quit in the tray menu stops it, and then nothing is sent.
  It can also start when you log in (Settings › Start-up), in the tray without its window. Only one copy runs at a
  time: starting the app again opens the window of the one that runs.
- If the mouse drops off twice right after the app sent it something, the app stops sending until you try again,
  also after a restart.
- Features keep an "Experimental" badge until testing beyond that one mouse confirms them.
- The interface is in English by default and also in Turkish, with light and dark themes.

## Build and run

Requirements:

- Rust (the version in `Cargo.toml`) and Node.js 18 or newer with npm.
- The ssgg checkout next to this one, at `../steelseriesgg-rs`, on the branch `rival3-gen2/phase0`.
- On Debian or Ubuntu: `sudo apt install build-essential pkg-config libwebkit2gtk-4.1-dev`.

`.cargo/config.toml` builds for the baseline x86-64 CPU, so the app also runs on processors without AVX2. If you
set `RUSTFLAGS` yourself, keep `-Ctarget-cpu=x86-64` in it.

```sh
npm install
npm run app:mock     # the app with fake devices; real hardware is not touched
npm run app          # the app with the plugged-in devices; it sends settings to the Rival 3 Gen 2
npm run app:release  # release build, written to target/release/tune
npm run dev          # the interface alone in a browser (http://localhost:1420), with built-in fake devices
```

Starting at login works with the release build only: a development build loads its interface from the dev server,
which does not run then. Start `target/release/tune` and turn on Settings › Start-up › Start at login. That writes
`~/.config/autostart/local.tune.desktop`, which starts the same program with `--background`; turning the switch off
removes the file. The fake devices keep this choice in memory too.

With fake devices, a bar at the top switches between the situations the app handles (first launch, several devices,
mouse unplugged, no permission, and so on). The app keeps its settings in `~/.config/local.tune.desktop/`; the fake
devices keep theirs in memory only.

Tests: `npm test` and `cargo test --locked`.

## Contents

- `src/`: the interface (React, TypeScript), its English and Turkish strings and both themes.
- `src-tauri/`: the desktop shell (Tauri 2): the window, the tray icon and the commands the interface calls.
- `crates/tune-core/`: the adapter to the ssgg library, the fake devices, the settings file, the login entry and the
  single-copy lock.
- `docs/`: hardware test guides (in Turkish).
- `packaging/linux/`: a udev rule that gives the user signed in at the computer access to the mouse's settings
  interface only.

## Legal notice

Tune is an independent, unofficial project. It is not affiliated with, endorsed, sponsored or supported by
SteelSeries or any of its affiliated companies.

SteelSeries, the SteelSeries logo, SteelSeries GG and SteelSeries product names such as Rival, Apex and Arctis are
trademarks or registered trademarks of SteelSeries, its affiliated companies or their respective owners.

All trademarks, logos, product names, product images, designs and other intellectual and industrial property rights
mentioned here belong to their respective owners. Product names appear only to identify compatible devices. Tune
uses no SteelSeries logos or product images. It is not SteelSeries GG and does not include any part of it.

Tune changes device settings without the manufacturer's software or support. Use it at your own risk.

## Credits

Tune talks to devices through [steelseriesgg-rs](https://github.com/Ven0m0/steelseriesgg-rs) (ssgg), developed by
Ven0m0 and started by ScepticDope, used under the MIT License (Copyright (c) 2024 ScepticDope). Thank you.
