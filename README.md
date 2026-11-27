# CoD Configurator

A dark Windows desktop app that reads your PC and sets up **Warzone, Black Ops 6, Black Ops 7 and Modern Warfare 4** for the best frame rate, with one click and one-click undo.

## What it does

- **Reads your exact CPU layout from Windows** (performance vs efficiency cores, and how cores are split across chiplets on Ryzen), then picks the render-thread count (`RendererWorkerCount`) itself:
  - Intel hybrid (12th gen to Core Ultra): one per performance core
  - Ryzen with two chiplets (7900X, 9950X3D...): no more than one chiplet's cores
  - everything else: cores minus 1
  - never more than 8, never fewer than 2
  The Home page shows this as a core map so you can see why.
- **Understands the real settings files.** Each game writes the line differently:
  - `RendererWorkerCount:0.0 = "4" // -1 to 16` (Modern Warfare II)
  - `RendererWorkerCount@0;51989;59387 = 16 // -1 to 16` (MW III, Black Ops 6, Black Ops 7, often in both `.txt0` and `.txt1`)
  - `RendererWorkerCount = "8"` (how many guides write it)

  The app changes only the value on every live copy. It keeps the comment, the quote style, the file's encoding (UTF-8, UTF-8 with BOM or UTF-16) and every other byte. It ignores commented-out lines and hand-made copies such as `... - Copy.txt0` or `.bak`, stays inside the allowed range written in the file, and looks in both `Documents\Call of Duty\players` and `%LOCALAPPDATA%\Activision\Call of Duty\players` (and their sub-folders).
- **Safe writes**: a full backup first, then a write through a temp file, a read-back check, and an automatic put-back if anything goes wrong. Read-only files stay read-only. Backups keep the original plus the 10 newest per file.
- **Undo puts back only the values it changed**, as they were before the app first touched the file, so any in-game menu changes you made since stay.
- **Notices when the game resets the value** (when the app opens and whenever you switch back to it) and puts it back automatically. You can turn this off.
- **In-game checklist** per game (Best FPS / Balanced), matched to your GPU maker, video memory, resolution and refresh rate, with notes where guides disagree.
- **Windows check** (read only): Game Mode, power plan, HAGS, Game Bar recording, RAM speed, Secure Boot, TPM, VBS, each with a button that opens the right Windows page.
- **Sources and safety** page: what is verified, single-source, or deliberately not applied.
- No driver is installed or loaded, and the game process, its memory and its install folder are never touched.

## Run it

Double-click `build.bat` (it builds, then opens the app). After that, double-click `dist\CoD-Configurator.exe`. Close the game before optimizing.

## Build

`build.bat` joins `src\` into `dist\CoD-Configurator.hta`, copies `assets\` next to it, and makes the small `CoD-Configurator.exe` launcher with the C# compiler built into Windows. Nothing to install.

## Project layout

```
src\00-head.html, 10-mid.html, 99-tail.html   page shell
src\style.css                                  the whole look (palette listed at the top)
src\core.js                                    file parsing and CPU logic (no Windows calls; tested)
src\data.js                                    games, checklist values, sources, fact check
src\sys.js                                     everything that talks to Windows
src\ui.js                                      pages and buttons
tests\                                         node tests (optional)
assets\                                        game pictures, logo.png and app.ico
```

## Put it on GitHub

Run `push.bat`. The first time it asks for the repo link, saves it into `src\config.js` (so the update button knows where to look), builds, commits and pushes. After that it is one double-click.

## Publish an update to users

Run `release.bat`. It asks for a version number and a one-line note, bumps the version, builds, tags, pushes and creates a GitHub release with the `.hta` and a zip. Needs the GitHub CLI once: `winget install GitHub.cli`, then `gh auth login`.

## Artwork

The pictures in `assets\` are Activision's, so they are git-ignored by default and stay on your PC. Without them the app shows plain panels. To change one, replace the file with the same name; the app darkens it itself. To publish them anyway, edit `.gitignore`.

The app logo is `assets\logo.png` (square, transparent background) for the top-left corner, and `assets\app.ico` for the window, the taskbar and `CoD-Configurator.exe`. Both are git-ignored too. Without them the app uses its built-in reticle mark and `tools\app.ico`. Rebuild with `build.bat` after changing the icon.

## Tests

With Node installed (optional):

```
node tests/test-core.js
node tests/test-sys.js
node tests/test-files.js
```

`test-files.js` runs the real Windows file code against real files through a fake Windows layer: every file shape, every encoding, read-only files, failed writes being rolled back, and backup pruning.

Not affiliated with or endorsed by Activision.
