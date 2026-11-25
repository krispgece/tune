#!/bin/sh
# Runs after Tune's package is installed or removed (deb and rpm alike, so it ignores its arguments): reloads the udev
# rules and applies them to the hidraw devices already plugged in, so after an install the mouse gets its permission
# without a replug. After a removal the mouse keeps the permission until it is unplugged.
if command -v udevadm >/dev/null 2>&1; then
    udevadm control --reload-rules || true
    udevadm trigger --subsystem-match=hidraw || true
fi
exit 0
