# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tune (working name) is a Linux desktop app for SteelSeries devices, built on the ssgg Rust library
(`steelseries_gg`). There is no app code yet: the repository holds the Phase 0 hardware test guide and the udev rule.

- Planned stack: Tauri 2 + React/TypeScript; the Rust side calls the library in-process through one adapter module.
- During development the library comes from the sibling checkout `../steelseriesgg-rs` (branch
  `rival3-gen2/phase0`, not pushed), which also builds the `ssgg` CLI that the test guide uses.
- First device: the wired Rival 3 Gen 2. Settings live on the PC and are re-applied on plug-in; nothing is saved to
  the device's memory.

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
