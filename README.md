# Tune

Tune (working name) is a desktop app for configuring SteelSeries devices on Linux: DPI stages, polling rate and
lighting. Tune is only a graphical frontend. The [ssgg](https://github.com/Ven0m0/steelseriesgg-rs) library
(`steelseries_gg`) talks to the devices, so the devices Tune can detect depend on ssgg.

Unofficial. Not affiliated with or endorsed by SteelSeries; see the [legal notice](#legal-notice) below.

## Status

Early planning and hardware testing; there is no app to install yet.

- First supported device: the wired Rival 3 Gen 2.
- Settings stay on the computer and are applied again whenever the device is plugged in. Nothing is written to the
  device's own memory.

## Contents

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
