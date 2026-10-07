# COR3 Helper for Android

An Android app that runs the [COR3 Helper](https://github.com/Femtoce11/cor3-helper) browser extension
(an unofficial helper for the game at cor3.gg) on a phone. It uses Mozilla's GeckoView engine, because
Android Chrome cannot load extensions.

> Unofficial, unaffiliated with cor3.gg or the original COR3 Helper author.
> The helper automates parts of the game; check the game's rules and use it at your own risk.

## What the app does

- Shows the game (`https://cor3.gg/`) in one GeckoView and the helper's popup in another, switched with the top bar.
- Loads the bundled extension into the game page so its automation works.
- Keeps the screen on and asks once to be exempt from battery optimisation so it can keep running.

It requests only: `INTERNET`, `ACCESS_NETWORK_STATE`, `WAKE_LOCK`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.
The extension is limited to `cor3.gg`, `os.cor3.gg`, `svc-corie.cor3.gg` and `raw.githubusercontent.com`
(see `app/src/main/assets/ext/manifest.json`). Your game login stays in the app on your phone; nothing is
sent anywhere else by this project's code.

## Privacy and security

- **Your password** is typed into cor3.gg itself, inside the embedded browser. This project has no code that reads or stores it, and it never reads cookies.
- **The game login token** is captured by the extension and kept in the extension's storage inside the app's private data, so it can call the game's daily-ops API. It is sent only back to `svc-corie.cor3.gg`. It is not encrypted at rest, which is normal for browsers, but means a rooted phone or malware with root could read it.
- **Network:** the code only contacts `cor3.gg`, `os.cor3.gg`, `svc-corie.cor3.gg`, `cdn.cor3.gg` and `raw.githubusercontent.com` (a read-only version check against the upstream repo). No analytics, no tracking, no other servers. You can check this yourself with a search for `fetch(` in `app/src/main/assets/ext/`.
- **Remote debugging** is disabled in release builds, so the APKs on the Releases page can't be inspected over adb. It is only on for debug builds made from Android Studio.
- **Loader bridge:** two small files, `app-bridge.js` and `app-bridge-bg.js` (sources in `tools/android-bridge/`), watch for the game's own "Preparing your workspace" loader and tell the app when it is gone, using the extension's `nativeMessaging` and `geckoViewAddons` permissions (the latter is what lets GeckoView hand extension messages to the app). The only receiver is this app; the message contains just the word `loading` or `ready`.
- **Backups:** Android cloud/device backup is disabled for the app (`allowBackup=false`), so the token doesn't end up in a backup.
- **Logs may contain job and server details.** Don't post screenshots of the Logs tab unless you've looked at them first.
- Use your own account, and only install APKs from this repository's Releases page (verify the checksum, see below).

## Verify the APK you download

Releases are built automatically by [GitHub Actions](.github/workflows/build.yml) from the code in this
repository, not on a personal computer.

1. Download `cor3-helper.apk` and `cor3-helper.apk.sha256` from the latest
   [Release](../../releases).
2. Check the checksum (Windows PowerShell): `(Get-FileHash cor3-helper.apk -Algorithm SHA256).Hash`
   and compare it with the value in the `.sha256` file.
3. Optional, proves it was built by this repo's workflow (needs the [GitHub CLI](https://cli.github.com/)):
   `gh attestation verify cor3-helper.apk --repo ArucadLabs/cor3-helper-app`

Or build it yourself (needs Android Studio / JDK 17+):

```
./gradlew assembleRelease      # Windows: .\gradlew.bat assembleRelease
```

Every release is signed with the same release key (stored in GitHub Secrets), so a new release installs over
the previous one and keeps your game login. The signing certificate's fingerprint is published with each
release (`cor3-helper.signing-cert.txt`); it must be identical across releases. Your own local builds use the
debug key unless you provide a `keystore.properties`, so they can't update over a GitHub release: uninstall one
before installing the other. ARM64 phones only.

Releasing (maintainer): bump `appVersionName` in `gradle.properties`, commit, then push a tag `v<that version>`.

## What was changed from the original extension

`app/src/main/assets/ext/` is the upstream extension converted for Firefox/GeckoView by
[`tools/patch_extension.py`](tools/patch_extension.py) (manifest changes, phone layout) plus a few edits on
top: failure reasons in the Jobs list, a "Clear Logs" button, and always picking the maximum-power hardware
before a job. The Android shell is in `app/src/main/java/app/cor3/helper/MainActivity.kt`.

## Updating when the extension updates

1. Download the new ZIP from https://github.com/Femtoce11/cor3-helper (Code -> Download ZIP) and extract it.
2. Run `python tools/patch_extension.py <path-to-extracted-folder>` (this overwrites `assets/ext/`, so the
   extra edits above need to be re-applied).
3. Read any WARNING lines, raise the `version` in `assets/ext/manifest.json` (the app only reloads the bundled
   extension when its version changes), then build.

## Licence

The extension code comes from the upstream project, described there as MIT licensed (the upstream download
does not include a licence file; credit and thanks to its author). See [NOTICE.md](NOTICE.md).
The Android wrapper code in this repository: see the licence file once the maintainer adds one.
