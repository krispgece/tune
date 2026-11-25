# Contributing to Tune

Thanks for helping. Tune is a small project kept by one person, so focused changes are the easiest to review.

## Before you start

- **Bugs and requests:** open an [issue](https://github.com/krispgece/tune/issues). Say which device (its name and
  the USB ID that `lsusb` shows), which distribution, and which Tune version (Settings › About).
- **Security problems:** follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
- **A new device:** support starts in the [ssgg](https://github.com/Ven0m0/steelseriesgg-rs) library, which talks to
  the devices. Once ssgg can drive a device, Tune can add screens for it.
- **Name suggestions:** see [About the name](README.md#about-the-name).

## Ground rules

- **No protocol details.** No command bytes, opcodes, report layouts, USB captures or reverse-engineering notes in
  code, comments, docs, UI text or commit messages. Public USB IDs (`vendor:product`) are fine. Device communication
  and its documentation belong in ssgg.
- **Tune's own look.** Tune must not resemble the device maker's software: no SteelSeries or GG logos, product photos
  or renders, the brand's orange, or GG's section names. Product names appear only to identify devices.
- **Interface text.** Every string lives in both `src/i18n/en.ts` and `src/i18n/tr.ts` (a test checks that both have
  the same keys), and uses `{app}` instead of the app's name. If you can't write the Turkish, copy the English text
  into `tr.ts` and say so in the pull request.
- **Dependencies.** Only ones under a license compatible with GPL-3.0: no GPL-2.0-only, proprietary or
  source-unavailable code. Fonts may also be under the SIL Open Font License 1.1, like the two Tune uses. After
  adding, removing or updating one, run `npm run notices` and commit the updated `THIRD-PARTY-NOTICES.txt`.
- **Hardware.** `npm run app` and a release build send settings to a plugged-in mouse. For work that doesn't need the
  device, use `npm run app:mock` or `npm run dev`, which run on fake devices. In the pull request, say what you tried
  on real hardware, with which device and distribution.

## Checks

Build requirements are in the [README](README.md#build-and-run). Before opening a pull request, run:

```sh
npm test
npm run check
npm run notices:check
cargo fmt --all -- --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
```

## Commits and pull requests

- Write commit messages in English, as [Conventional Commits](https://www.conventionalcommits.org/) (`feat: ...`,
  `fix: ...`, `docs: ...`).
- Pull requests are squash-merged: the pull request's title becomes the commit title and its description the commit
  body, so write the title as a Conventional Commit too.
- Keep one topic per pull request.
- Rust code follows `rustfmt` (`rustfmt.toml`, 120 columns); TypeScript follows the style of the files around it.

## License

Tune is licensed under the GNU General Public License, version 3 or any later version (see [LICENSE](LICENSE)). By
submitting a contribution, you agree that it is licensed under the same terms and that you have the right to submit
it. You keep the copyright in your contribution; together, the authors are "the Tune contributors".
