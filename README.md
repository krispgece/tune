# Tune

Tune ([working name](#about-the-name)) is a desktop app for configuring SteelSeries devices on Linux: DPI stages,
polling rate and lighting. It is an early version: so far it supports one mouse, the wired Rival 3 Gen 2, and runs on
Linux only. Tune is only a graphical frontend. The [ssgg](https://github.com/Ven0m0/steelseriesgg-rs) library
(`steelseries_gg`) talks to the devices, so the devices Tune can detect depend on ssgg.

Unofficial. Not affiliated with or endorsed by SteelSeries; see the [legal notice](#legal-notice) below.

## About the name

"Tune" is a working name, made up on the spot. If you object to it, for example because the name is yours or is
already in use for something else, please [open an issue](https://github.com/krispgece/tune/issues) and say why.
Every request is considered, and it can lead to a new name. Name suggestions are taken only from people who have
already contributed to the project, for example with a merged pull request; please link your contribution in the
issue.

## Status

The app's screens also run on fake devices. With a wired Rival 3 Gen 2 the app sends DPI stages, the polling rate
and the lighting (one colour, by zone or off), and shows what the mouse answered. These were tried on one mouse, first
by hand and then from the app. Sending again after the computer wakes from sleep was not tried on the mouse.

- First supported device: the wired Rival 3 Gen 2. Other SteelSeries devices that ssgg recognizes show up as "Not
  supported yet", and nothing is sent to them.
- The mouse forgets its colour and polling rate when it's unplugged, so the app keeps them on the computer and sends
  them again when it starts and, while it runs, whenever the mouse is plugged in or the computer wakes from sleep.
  The mouse stores its DPI stages itself, so the app sends them only when they change. The app sends no command to
  save settings into the mouse.
- Closing the window keeps the app running in the tray; Quit (in the tray menu or in Settings › Start-up) stops it,
  and then nothing is sent.
  It can also start when you log in (Settings › Start-up), in the tray without its window. Only one copy runs at a
  time: starting the app again opens the window of the one that runs.
- If the mouse drops off twice right after the app sent it something, the app stops sending until you try again,
  also after a restart.
- Features keep an "Experimental" badge until testing beyond that one mouse confirms them.
- The interface is in English by default and also in Turkish, with light and dark themes.

## Install

Download the package for your system from the [latest release](https://github.com/krispgece/tune/releases/latest):
the `.deb` for Ubuntu, Debian and Linux Mint, or the `.rpm` for Fedora (not tested yet). The release notes show how
to check the download and install it. The package also sets up the mouse permission. To build Tune yourself, see
below.

## Build and run

Requirements:

- Rust (the version in `Cargo.toml`) and Node.js 18 or newer with npm.
- Network access on the first build: Cargo fetches the ssgg library from
  [a fork](https://github.com/krispgece/steelseriesgg-rs) at a fixed commit, which adds the mouse features Tune needs
  until they are in an upstream release.
- On Debian or Ubuntu: `sudo apt install build-essential pkg-config libwebkit2gtk-4.1-dev`. Building the install
  packages also needs `libayatana-appindicator3-dev`.
- To run: the tray icon needs `libayatana-appindicator3-1` (Ubuntu's desktop has it; otherwise
  `sudo apt install libayatana-appindicator3-1`). Without it the app runs with no tray icon, and closing the window
  quits it. On GNOME the icon shows only with the AppIndicator extension, which Ubuntu turns on.

`.cargo/config.toml` builds for the baseline x86-64 CPU, so the app also runs on processors without AVX2. If you
set `RUSTFLAGS` yourself, keep `-Ctarget-cpu=x86-64` in it.

```sh
npm install
npm run app:mock     # the app with fake devices; real hardware is not touched
npm run app          # the app with the plugged-in devices; it sends settings to the Rival 3 Gen 2
npm run app:release  # release build, written to target/release/tune
npm run package      # .deb and .rpm packages, written to target/release/bundle/
npm run dev          # the interface alone in a browser (http://localhost:1420), with built-in fake devices
```

Starting at login works with the release build only: a development build loads its interface from the dev server,
which does not run then. Start `target/release/tune` and turn on Settings › Start-up › Start at login. That writes
`~/.config/autostart/io.github.krispgece.tune.desktop`, which starts the same program with `--background`; turning
the switch off removes the file. The fake devices keep this choice in memory too.

With fake devices, a bar at the top switches between the situations the app handles (first launch, several devices,
mouse unplugged, no permission, and so on). The app keeps its settings in `~/.config/io.github.krispgece.tune/`; the
fake devices keep theirs in memory only.

The packages install the program as `/usr/bin/tune` with a menu entry, and the udev rule as
`/usr/lib/udev/rules.d/70-tune-rival3-gen2.rules`; installing a package gives the permission to a mouse that is
already plugged in, and after removal the mouse keeps it until it is unplugged. Install with
`sudo apt install ./target/release/bundle/deb/Tune_0.1.0_amd64.deb` (or `sudo dnf install` with the .rpm). If you
copied the rule to `/etc/udev/rules.d/` by hand before, delete that copy: it hides the package's rule.

Tests: `npm test` and `cargo test --locked`. After changing dependencies, run `npm run notices` to update
`THIRD-PARTY-NOTICES.txt`; `npm run notices:check` fails while it is out of date.

## Contents

- `src/`: the interface (React, TypeScript), its English and Turkish strings and both themes.
- `src-tauri/`: the desktop shell (Tauri 2): the window, the tray icon and the commands the interface calls.
- `crates/tune-core/`: the adapter to the ssgg library, the fake devices, the settings file, the login entry and the
  single-copy lock.
- `scripts/third-party-notices.mjs`: writes `THIRD-PARTY-NOTICES.txt` (`npm run notices`).
- `scripts/package.sh`: builds the .deb and .rpm (`npm run package`).
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

## License

Copyright (C) 2026 the Tune contributors.

Tune is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as
published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
It comes with no warranty. The full text is in [LICENSE](LICENSE).

Whoever shares a changed version of Tune, or a program that includes its code, has to share it under the same
license, with its source code. The libraries and fonts Tune uses keep their own licenses: their texts are in
[THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt), and the app shows both files under Settings › About ›
Open-source licenses.
