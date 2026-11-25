# CoD Configurator

A black-and-red, liquid-glass Windows desktop app that detects your PC and applies the best-sourced settings for **Warzone, Black Ops 6, Black Ops 7 and Modern Warfare 4**.

- **Hardware detection** (CPU and performance cores, GPU, video memory, refresh rate, RAM, Secure Boot) through built-in Windows queries. No driver is installed or loaded, so nothing touches anti-cheat.
- **One click, automatic**: press OPTIMIZE ALL GAMES. The app detects your CPU, GPU, VRAM and refresh rate, picks the worker-count value itself (performance cores on Intel hybrid, cores minus 1 elsewhere, max 8), checks both settings locations (`Documents\Call of Duty\players` and `%LOCALAPPDATA%\Activision\Call of Duty\players`), backs the file up to `%APPDATA%\CoDConfigurator\backups`, applies, and offers UNDO. No pop-ups, no typing.
- **Re-apply detection**: if the game resets the value, the tile shows RE-APPLY when you come back to the app.
- **In-game checklist**: per game, best FPS and balanced presets (Modern Warfare 4: best FPS only for now) from the majority of the cited guides, tickable, with notes where guides disagree. MW4 has no config edit (none of its guides give one).
- **Windows check (read only)**: Game Mode, power plan, HAGS, Game Bar recording, RAM speed, Secure Boot, TPM, VBS, each with a one-click button that opens the right Windows page.
- **Best FPS / Balanced / Quality** presets per game, adjusted for your GPU maker, VRAM tier, refresh rate and resolution.
- **Sources & Safety** tab showing which claims are verified, single-source, or intentionally not applied.
- **Update button** under Settings (checks your GitHub releases; downloads only when you press the button).

## Run it

Double-click `dist\CoD-Configurator.hta`, or run `run.bat`. Close the game first. Keep the `assets` folder next to the `.hta` for the wallpapers.

## Build

`build.bat` joins `src\` into `dist\CoD-Configurator.hta` and copies `assets\` next to it. Windows only, nothing to install.

## Put it on GitHub

1. Create an empty repo on GitHub.
2. Run `push.bat`. First time it asks for the repo link, saves it into `src\config.js` (so the update button knows where to look), builds, commits and pushes. After that it is one double-click.

## Publish an update to users

Run `release.bat`. It asks for a version number and a one-line note, bumps the version, builds, tags, pushes and creates a GitHub release with the `.hta` and a zip. Needs the GitHub CLI once: `winget install GitHub.cli`, then `gh auth login`.

## Artwork

The wallpapers in `assets\` are Activision's, so they are git-ignored by default and stay on your PC. Without them the app falls back to built-in artwork. To change a picture, replace the file with the same name. To publish them anyway, edit `.gitignore`.

## Tests

`node tests/test-core.js` (Node only needed for this optional test of the pure logic).

Not affiliated with or endorsed by Activision.


## Opening the app
Double-click `build.bat`. It builds `dist\CoD-Configurator.hta`, makes a real `dist\CoD-Configurator.exe` launcher (using the C# compiler built into Windows), and opens the app through Windows' own `mshta.exe`, so it works even if Windows has no program linked to `.hta` files. After that, double-click `CoD-Configurator.exe` (keep it next to the `.hta` and the `assets` folder; pin it to the taskbar if you like).
