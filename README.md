# Tune

Tune (working name) is a desktop app for configuring SteelSeries devices on Linux: DPI stages, polling rate and
lighting. Tune is only a graphical frontend. The [ssgg](https://github.com/Ven0m0/steelseriesgg-rs) library
(`steelseries_gg`) talks to the devices, so the devices Tune can detect depend on ssgg.

Unofficial. Not affiliated with or endorsed by SteelSeries.

## Status

Early planning and hardware testing; there is no app to install yet.

- First supported device: the wired Rival 3 Gen 2.
- Settings stay on the computer and are applied again whenever the device is plugged in. Nothing is written to the
  device's own memory.

## Contents

- `docs/`: hardware test guides (in Turkish).
- `packaging/linux/`: a udev rule that gives the user signed in at the computer access to the mouse's settings
  interface only.
