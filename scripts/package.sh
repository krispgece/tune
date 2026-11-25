#!/bin/sh
# Builds the .deb and .rpm packages. The rpm takes each file's mode from disk, so the files it packs get the usual
# modes here whatever the user's umask (for example 002 or 077) made them.
set -eu
umask 022
cd "$(dirname "$0")/.."
chmod u+rw,go=rX LICENSE THIRD-PARTY-NOTICES.txt packaging/linux/* src-tauri/icons/*
if [ -e target/release/tune ]; then
    chmod 0755 target/release/tune
fi
exec tauri build --bundles deb,rpm -- --locked "$@"
